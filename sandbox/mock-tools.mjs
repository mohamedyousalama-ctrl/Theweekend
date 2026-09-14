/** In-process synthetic tool adapter; no network, model, HTTP server or Kivo access.
 * Trusted context and approveQuote are test-harness inputs, never model arguments.
 * State is memory-only: no claim of durable idempotency or distributed scheduling.
 */
import { readFileSync } from 'node:fs';
const load = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
export const contracts = load('./tools.schema.json');
const fixture = load('./catalog.synthetic.json');
const clone = value => structuredClone(value);
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v)
  && [Object.prototype, null].includes(Object.getPrototypeOf(v));
const validDate = x => /^\d{4}-\d{2}-\d{2}$/.test(x)
  && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0,10) === x;
class Fault extends Error { constructor(code) { super(code); this.code=code; } }
const fail = code => { throw new Fault(code); };

// Intentionally limited to this pack's schema subset, not a general validator.
// Schemas and emitted envelopes are also checked with Draft 2020-12 externally.
export function validateInput(toolName, input) {
  const tool=contracts.tools.find(t=>t.name===toolName);
  if (!tool) fail('UNSUPPORTED_OPERATION');
  function check(s,v) {
    if (s.type==='object') {
      if (!plain(v)) fail('VALIDATION_ERROR');
      const keys=Object.keys(v);
      if (keys.some(k=>!Object.hasOwn(s.properties,k)) || s.required.some(k=>!Object.hasOwn(v,k))) fail('VALIDATION_ERROR');
      if ((s.minProperties!=null && keys.length<s.minProperties) || (s.maxProperties!=null && keys.length>s.maxProperties)) fail('VALIDATION_ERROR');
      for(const k of keys) check(s.properties[k],v[k]);
    } else if (s.type==='string') {
      if(typeof v!=='string' || (s.minLength!=null && [...v].length<s.minLength)
        || (s.maxLength!=null && [...v].length>s.maxLength)
        || (s.pattern && !new RegExp(s.pattern).test(v))
        || (s.enum && !s.enum.includes(v)) || (s.format==='date' && !validDate(v))) fail('VALIDATION_ERROR');
    } else if (s.type==='integer') {
      if(!Number.isSafeInteger(v) || (s.minimum!=null && v<s.minimum) || (s.maximum!=null && v>s.maximum)) fail('VALIDATION_ERROR');
    } else if (s.type==='array') {
      if(!Array.isArray(v) || v.length<s.minItems || v.length>s.maxItems
        || (s.uniqueItems && new Set(v).size!==v.length)) fail('VALIDATION_ERROR');
      for(const item of v) check(s.items,item);
    } else fail('VALIDATION_ERROR');
  }
  check(tool.input_schema,input);
  return true;
}

export function createSandbox({mode, clockMs=Date.parse(fixture.meta.fixture_clock)}={}) {
  if(mode!=='DEMO') throw new Error('Explicit DEMO mode required; no real-service fallback');
  if(!Number.isFinite(clockMs)) throw new TypeError('Invalid test clock');
  const catalog=clone(fixture), quotes=new Map(), bookings=new Map(), cases=new Map();
  let clock=clockMs, serial=0;
  const id=p=>p+(++serial).toString().padStart(4,'0');
  const localMs=s=>Date.parse(s+'+03:00');
  const iso=ms=>new Date(ms).toISOString();
  const owns=(r,c)=>r && r.subject_id===c.subject_id && r.session_id===c.session_id;
  const scope=c=>{
    if(!plain(c) || c.verified!==true || typeof c.subject_id!=='string' || !c.subject_id
      || typeof c.session_id!=='string' || !c.session_id) fail('UNAUTHORIZED');
  };
  const response=(status,data,operation=null,expiry=null)=>({ok:true,status,mode:'DEMO',source:'sandbox_fixture',operation_id:operation,
    provider_reference:data?.provider_reference??null,observed_at:iso(clock),expires_at:expiry,data:clone(data),error:null});
  const error=(code,operation=null)=>({ok:false,status:code==='UNKNOWN_OUTCOME'?'UNKNOWN_OUTCOME':'ERROR',mode:'DEMO',source:'sandbox_fixture',operation_id:operation,
    provider_reference:null,observed_at:iso(clock),expires_at:null,data:null,error:{code,message:code,retryable:false}});
  const serviceFor=(branchId,serviceId)=>{
    const branch=catalog.branches.find(b=>b.id===branchId && b.active);
    const service=catalog.services.find(s=>s.id===serviceId && s.active);
    if(!branch || !service || !branch.enabled_service_ids.includes(serviceId)) fail('NOT_FOUND');
    return service;
  };
  function fits(slot,service) {
    const staff=catalog.staff.find(s=>s.id===slot.staff_id && s.active && s.branch_ids.includes(slot.branch_id));
    if(!staff || !service.eligible_staff_ids.includes(staff.id) || !slot.service_ids.includes(service.id) || slot.status!=='open') return false;
    const start=localMs(slot.start_local), end=start+(service.duration_min+service.buffer_min)*60000;
    if(start<=clock || end>localMs(slot.capacity_until_local)) return false;
    return ![...bookings.values()].some(b=>b.staff_id===staff.id && start<b.occupied_until_ms && end>b.start_ms);
  }
  const publicBooking=b=>{
    const {subject_id,session_id,start_ms,occupied_until_ms,...view}=b;
    return clone(view);
  };
  const roleAllowed=(service,c)=>{
    if(c.booking_adult!==true || !['adult','child'].includes(c.recipient_kind)) fail('CONSENT_REQUIRED');
    if(service.age_rule==='child_with_booking_adult' && c.recipient_kind!=='child') fail('VALIDATION_ERROR');
    if(service.age_rule==='adult' && c.recipient_kind!=='adult') fail('VALIDATION_ERROR');
  };
  function ownedQuote(c,quoteId,version) {
    scope(c); const q=quotes.get(quoteId);
    if(!owns(q,c)) fail('NOT_FOUND');
    if(q.view.version!==version) fail('QUOTE_CHANGED');
    return q;
  }
  function run(name,a,c,fault) {
    validateInput(name,a);
    if(name==='get_branches') return response('OK',{branches:catalog.branches.filter(b=>b.active && (!a.city || b.city.toLowerCase()===a.city.toLowerCase()))});
    if(name==='get_services') {
      const branch=catalog.branches.find(b=>b.id===a.branch_id && b.active);
      if(!branch) fail('NOT_FOUND');
      return response('OK',{services:catalog.services.filter(s=>s.active && branch.enabled_service_ids.includes(s.id)
        && (!a.query || [s.name_ar,s.name_en].some(x=>x.toLowerCase().includes(a.query.toLowerCase()))))});
    }
    if(name==='get_available_slots') {
      const s=serviceFor(a.branch_id,a.service_id);
      if(a.date_from_local && a.date_to_local && a.date_to_local<a.date_from_local) fail('VALIDATION_ERROR');
      const slots=catalog.demo_slots.filter(x=>x.branch_id===a.branch_id && (!a.staff_id || a.staff_id===x.staff_id)
        && (!a.date_from_local || x.start_local.slice(0,10)>=a.date_from_local)
        && (!a.date_to_local || x.start_local.slice(0,10)<=a.date_to_local) && fits(x,s))
        .sort((x,y)=>x.start_local.localeCompare(y.start_local)).slice(0,a.limit??5)
        .map(x=>({id:x.id,staff_id:x.staff_id,start_local:x.start_local,timezone:'Asia/Riyadh',duration_min:s.duration_min,buffer_min:s.buffer_min}));
      return response('OK',{slots,timezone:'Asia/Riyadh'},null,iso(clock+60000));
    }
    scope(c);
    if(name==='create_booking_quote') {
      const s=serviceFor(a.branch_id,a.service_id); roleAllowed(s,c);
      const slot=catalog.demo_slots.find(x=>x.id===a.slot_id && x.branch_id===a.branch_id);
      if(!slot || (a.staff_id && a.staff_id!==slot.staff_id)) fail('NOT_FOUND');
      if(!fits(slot,s)) fail('SLOT_TAKEN');
      const quoteId=id('quo_demo_'), expiry=iso(clock+catalog.meta.quote_ttl_seconds*1000);
      const view={quote_id:quoteId,version:1,status:'QUOTED',mode:'DEMO',branch_id:a.branch_id,service_id:s.id,staff_id:slot.staff_id,
        slot_id:slot.id,start_local:slot.start_local,timezone:'Asia/Riyadh',duration_min:s.duration_min,buffer_min:s.buffer_min,
        service_end_at:iso(localMs(slot.start_local)+s.duration_min*60000),occupied_until:iso(localMs(slot.start_local)+(s.duration_min+s.buffer_min)*60000),
        price_minor:s.price_minor,deposit_minor:s.deposit_minor,currency:'SAR',tax_display:s.tax_display,
        cancellation_summary_ar:catalog.policies.cancellation_ar,expires_at:expiry};
      quotes.set(quoteId,{subject_id:c.subject_id,session_id:c.session_id,recipient_kind:c.recipient_kind,view,approved:false,booking_id:null,operation_id:id('op_demo_')});
      return response('QUOTED',view,null,expiry);
    }
    if(name==='create_booking') {
      const q=ownedQuote(c,a.quote_id,a.quote_version);
      if(q.recipient_kind!==c.recipient_kind) fail('QUOTE_CHANGED');
      // Replays return the existing operation even after quote expiry.
      if(q.booking_id) return response('CONFIRMED',publicBooking(bookings.get(q.booking_id)),q.operation_id);
      if(!q.approved) fail('CONSENT_REQUIRED');
      if(clock>=Date.parse(q.view.expires_at)) fail('QUOTE_EXPIRED');
      const s=serviceFor(q.view.branch_id,q.view.service_id); roleAllowed(s,c);
      const slot=catalog.demo_slots.find(x=>x.id===q.view.slot_id);
      if(!fits(slot,s)) fail('SLOT_TAKEN');
      const bookingId=id('bk_demo_');
      const b={...q.view,booking_id:bookingId,status:'CONFIRMED',provider_reference:'DEMO-'+bookingId.slice(8),operation_id:q.operation_id,
        subject_id:c.subject_id,session_id:c.session_id,start_ms:localMs(slot.start_local),occupied_until_ms:Date.parse(q.view.occupied_until)};
      bookings.set(bookingId,b); q.booking_id=bookingId;
      if(fault==='timeout_after_commit') return error('UNKNOWN_OUTCOME',q.operation_id);
      return response('CONFIRMED',publicBooking(b),q.operation_id);
    }
    if(name==='get_booking') {
      const b=[...bookings.values()].find(x=>a.booking_id?x.booking_id===a.booking_id:a.operation_id?x.operation_id===a.operation_id:x.provider_reference===a.provider_reference);
      if(!owns(b,c)) fail('NOT_FOUND');
      return response('CONFIRMED',publicBooking(b),b.operation_id);
    }
    if(name==='create_human_handoff') {
      if(a.booking_id && !owns(bookings.get(a.booking_id),c)) fail('NOT_FOUND');
      const existing=[...cases.values()].find(x=>owns(x,c) && x.reason===a.reason && x.booking_id===(a.booking_id??null));
      const row=existing??{case_id:id('case_demo_'),status:'queued',reason:a.reason,summary_ar:a.summary_ar,booking_id:a.booking_id??null,subject_id:c.subject_id,session_id:c.session_id};
      cases.set(row.case_id,row);
      return response('queued',{case_id:row.case_id,status:'queued',mode:'DEMO',staffed:false});
    }
    if(name==='get_customer_profile') {
      const u=catalog.demo_customers.find(x=>x.id===c.subject_id);
      if(!u) fail('NOT_FOUND');
      const data={};
      for(const f of a.fields) if(f==='display_name') data[f]=u.display_name_ar; else if(Object.hasOwn(u,f)) data[f]=clone(u[f]);
      return response('OK',data);
    }
    fail('UNSUPPORTED_OPERATION');
  }
  return Object.freeze({
    invoke(name,args,context={},testFault=null) {
      try { return run(name,args,context,testFault); }
      catch(e) { if(e instanceof Fault) return error(e.code); throw e; }
    },
    // Trusted harness action. NEVER expose this as a model tool or public endpoint.
    approveQuote(context,quoteId,version) {
      const q=ownedQuote(context,quoteId,version);
      if(clock>=Date.parse(q.view.expires_at)) fail('QUOTE_EXPIRED');
      q.approved=true;
    },
    advanceClock(ms) { if(!Number.isFinite(ms)||ms<0) throw new TypeError('Invalid time advance'); clock+=ms; },
    counts() { return {quotes:quotes.size,bookings:bookings.size,cases:cases.size}; }
  });
}
