import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createSandbox, contracts, validateInput } from '../sandbox/mock-tools.mjs';
const read=n=>JSON.parse(readFileSync(new URL('../sandbox/'+n,import.meta.url),'utf8'));
const catalog=read('catalog.synthetic.json'), golden=read('golden-conversations.json');
const responses=[];
const context={subject_id:'cu_demo_salem',session_id:'session_demo_a',verified:true,booking_adult:true,recipient_kind:'adult'};
const other={...context,subject_id:'cu_demo_other',session_id:'session_demo_b'};
const proposal={branch_id:'br_demo_01',service_id:'svc_haircut',slot_id:'slot_2026_09_17_2100_fahad'};
const setup=()=>createSandbox({mode:'DEMO'});
function call(s,name,args,c=context,fault=null){const r=s.invoke(name,args,c,fault);responses.push({name,args,response:r});return r;}
function quote(s,c=context,patch={}){return call(s,'create_booking_quote',{...proposal,...patch},c).data;}
function book(s,c=context){const q=quote(s,c);s.approveQuote(c,q.quote_id,q.version);return call(s,'create_booking',{quote_id:q.quote_id,quote_version:q.version},c);}
const inputExamples={get_branches:{},get_services:{branch_id:'br_demo_01'},get_available_slots:{branch_id:'br_demo_01',service_id:'svc_haircut'},
 create_booking_quote:proposal,create_booking:{quote_id:'quo_demo_0001',quote_version:1},get_booking:{operation_id:'op_demo_0002'},
 create_human_handoff:{reason:'customer_asked',summary_ar:'Synthetic help request'},get_customer_profile:{fields:['display_name']}};

test('exactly eight typed tools',()=>{assert.equal(contracts.tools.length,8);assert.equal(new Set(contracts.tools.map(t=>t.name)).size,8);});
for(const [name,args] of Object.entries(inputExamples)) {
 test('valid input '+name,()=>assert.equal(validateInput(name,args),true));
 test('unknown input field '+name,()=>assert.throws(()=>validateInput(name,{...args,customer_confirmed:true})));
}
for(const name of ['get_handoff_status','get_products','execute_sql','cancel_booking']) test('unsupported '+name,()=>assert.equal(call(setup(),name,{}).error.code,'UNSUPPORTED_OPERATION'));
for(const mode of [undefined,'INTEGRATED','REQUEST_ONLY','live']) test('no synthetic fallback '+mode,()=>assert.throws(()=>createSandbox({mode})));
test('catalog never merchant approved',()=>{assert.equal(catalog.meta.mode,'DEMO');assert.equal(catalog.meta.merchant_approved,false);assert.equal(catalog.meta.photo_analysis,false);assert.equal(catalog.meta.product_recommendation,false);});
test('branch has no navigable map',()=>{const r=call(setup(),'get_branches',{});assert.equal(r.mode,'DEMO');assert.equal(r.data.branches[0].maps_url,null);});
test('four synthetic services',()=>assert.equal(call(setup(),'get_services',{branch_id:'br_demo_01'}).data.services.length,4));
test('unknown branch does not fall back to all services',()=>assert.equal(call(setup(),'get_services',{branch_id:'br_wrong'}).error.code,'NOT_FOUND'));
test('kids slots only eligible Nasser',()=>{const r=call(setup(),'get_available_slots',{branch_id:'br_demo_01',service_id:'svc_kids_cut'});assert.equal(r.data.slots.length,1);assert.equal(r.data.slots[0].staff_id,'st_nasser');});
test('inverted dates rejected',()=>assert.equal(call(setup(),'get_available_slots',{...inputExamples.get_available_slots,date_from_local:'2026-09-18',date_to_local:'2026-09-17'}).error.code,'VALIDATION_ERROR'));
test('impossible date rejected',()=>assert.equal(call(setup(),'get_available_slots',{...inputExamples.get_available_slots,date_from_local:'2026-02-30'}).error.code,'VALIDATION_ERROR'));
test('past fixture slots not recycled into future',()=>{const s=createSandbox({mode:'DEMO',clockMs:Date.parse('2026-09-20T00:00:00Z')});assert.equal(call(s,'get_available_slots',inputExamples.get_available_slots).data.slots.length,0);});
test('quote includes service price timing cleanup terms',()=>{const q=quote(setup());assert.equal(q.price_minor,8000);assert.equal(q.duration_min,45);assert.equal(q.buffer_min,10);assert.equal(q.occupied_until,'2026-09-17T18:55:00.000Z');assert.ok(q.cancellation_summary_ar);});
test('70 minute combo excluded from 60 minute capacities',()=>assert.equal(call(setup(),'get_available_slots',{branch_id:'br_demo_01',service_id:'svc_hair_beard'}).data.slots.length,0));
test('cannot quote combination that exceeds capacity',()=>assert.equal(call(setup(),'create_booking_quote',{...proposal,service_id:'svc_hair_beard'}).error.code,'SLOT_TAKEN'));
test('quote is not a hold',()=>{const s=setup();quote(s);assert.equal(call(s,'get_available_slots',inputExamples.get_available_slots).data.slots.length,3);assert.equal(s.counts().bookings,0);});
test('create without trusted approval denied',()=>{const s=setup(),q=quote(s);assert.equal(call(s,'create_booking',{quote_id:q.quote_id,quote_version:1}).error.code,'CONSENT_REQUIRED');assert.equal(s.counts().bookings,0);});
for(const patch of [{customer_confirmed:true},{customer_id:'cu_demo_other'},{idempotency_key:'new-key'},{style_note_ar:'unauthorized photo sharing'}]) test('model authority field denied '+Object.keys(patch)[0],()=>{const s=setup(),q=quote(s);assert.equal(call(s,'create_booking',{quote_id:q.quote_id,quote_version:1,...patch}).error.code,'VALIDATION_ERROR');});
test('approved happy path',()=>{const r=book(setup());assert.equal(r.status,'CONFIRMED');assert.ok(r.data.booking_id.startsWith('bk_demo_'));assert.ok(r.provider_reference.startsWith('DEMO-'));assert.equal(r.data.mode,'DEMO');});
test('duplicate confirms reuse booking and operation',()=>{const s=setup(),r=book(s),again=call(s,'create_booking',{quote_id:r.data.quote_id,quote_version:1});assert.equal(again.data.booking_id,r.data.booking_id);assert.equal(again.operation_id,r.operation_id);assert.equal(s.counts().bookings,1);});
test('completed quote replay after expiry returns original result',()=>{const s=setup(),r=book(s);s.advanceClock(700000);assert.equal(call(s,'create_booking',{quote_id:r.data.quote_id,quote_version:1}).data.booking_id,r.data.booking_id);assert.equal(s.counts().bookings,1);});
test('unexecuted expired quote cannot create',()=>{const s=setup(),q=quote(s);s.approveQuote(context,q.quote_id,1);s.advanceClock(600000);assert.equal(call(s,'create_booking',{quote_id:q.quote_id,quote_version:1}).error.code,'QUOTE_EXPIRED');});
test('version mismatch rejected',()=>{const s=setup(),q=quote(s);s.approveQuote(context,q.quote_id,1);assert.equal(call(s,'create_booking',{quote_id:q.quote_id,quote_version:2}).error.code,'QUOTE_CHANGED');});
test('cross-subject approval denied',()=>{const s=setup(),q=quote(s);assert.throws(()=>s.approveQuote(other,q.quote_id,1),/NOT_FOUND/);});
test('cross-subject create denied',()=>{const s=setup(),q=quote(s);s.approveQuote(context,q.quote_id,1);assert.equal(call(s,'create_booking',{quote_id:q.quote_id,quote_version:1},other).error.code,'NOT_FOUND');});
test('different session cannot reuse approval',()=>{const s=setup(),q=quote(s);assert.throws(()=>s.approveQuote({...context,session_id:'different'},q.quote_id,1),/NOT_FOUND/);});
test('competing quotes cannot allocate one resource twice',()=>{const s=setup(),q1=quote(s),q2=quote(s,other,{service_id:'svc_beard'});s.approveQuote(context,q1.quote_id,1);s.approveQuote(other,q2.quote_id,1);assert.equal(call(s,'create_booking',{quote_id:q1.quote_id,quote_version:1}).status,'CONFIRMED');assert.equal(call(s,'create_booking',{quote_id:q2.quote_id,quote_version:1},other).error.code,'SLOT_TAKEN');assert.equal(s.counts().bookings,1);});
test('post-write timeout reconciles stable operation',()=>{const s=setup(),q=quote(s);s.approveQuote(context,q.quote_id,1);const r=call(s,'create_booking',{quote_id:q.quote_id,quote_version:1},context,'timeout_after_commit');assert.equal(r.status,'UNKNOWN_OUTCOME');assert.equal(r.error.retryable,false);assert.equal(call(s,'get_booking',{operation_id:r.operation_id}).status,'CONFIRMED');assert.equal(s.counts().bookings,1);});
test('empty lookup rejected',()=>assert.equal(call(setup(),'get_booking',{}).error.code,'VALIDATION_ERROR'));
test('multiple lookup selectors rejected',()=>assert.equal(call(setup(),'get_booking',{booking_id:'bk_demo_1',operation_id:'op_demo_1'}).error.code,'VALIDATION_ERROR'));
test('unowned read conceals existence',()=>{const s=setup(),r=book(s);assert.equal(call(s,'get_booking',{booking_id:r.data.booking_id},other).error.code,'NOT_FOUND');});
test('verified context required',()=>assert.equal(call(setup(),'get_customer_profile',{fields:['display_name']},{...context,verified:false}).error.code,'UNAUTHORIZED'));
test('profile fields minimized with consistent name key',()=>assert.deepEqual(Object.keys(call(setup(),'get_customer_profile',{fields:['display_name']}).data),['display_name']));
test('style record is preference not executed result',()=>assert.equal(call(setup(),'get_customer_profile',{fields:['confirmed_style']}).data.confirmed_style.record_kind,'confirmed_preference'));
test('empty profile selection rejected',()=>assert.equal(call(setup(),'get_customer_profile',{}).error.code,'VALIDATION_ERROR'));
test('handoff simulated queued and idempotent in session',()=>{const s=setup(),a={reason:'customer_asked',summary_ar:'Please help'},r=call(s,'create_human_handoff',a),again=call(s,'create_human_handoff',a);assert.equal(r.status,'queued');assert.equal(r.data.staffed,false);assert.equal(r.data.case_id,again.data.case_id);assert.equal(s.counts().cases,1);});
test('handoff rejects unowned booking reference',()=>{const s=setup(),r=book(s);assert.equal(call(s,'create_human_handoff',{reason:'complaint',summary_ar:'Concern',booking_id:r.data.booking_id},other).error.code,'NOT_FOUND');});
test('kids booking requires adult booking context',()=>{const a={...proposal,service_id:'svc_kids_cut',slot_id:'slot_2026_09_17_2115_nasser'};assert.equal(call(setup(),'create_booking_quote',a,{...context,booking_adult:false,recipient_kind:'child'}).error.code,'CONSENT_REQUIRED');});
test('adult can book supported child service without photo',()=>{const s=setup(),c={...context,recipient_kind:'child'},q=quote(s,c,{service_id:'svc_kids_cut',slot_id:'slot_2026_09_17_2115_nasser'});s.approveQuote(c,q.quote_id,1);assert.equal(call(s,'create_booking',{quote_id:q.quote_id,quote_version:1},c).status,'CONFIRMED');});
test('adult-only service denied for child recipient',()=>assert.equal(call(setup(),'create_booking_quote',{...proposal,service_id:'svc_beard'},{...context,recipient_kind:'child'}).error.code,'VALIDATION_ERROR'));
test('changed recipient invalidates quote approval',()=>{const s=setup(),q=quote(s);s.approveQuote(context,q.quote_id,1);assert.equal(call(s,'create_booking',{quote_id:q.quote_id,quote_version:1},{...context,recipient_kind:'child'}).error.code,'QUOTE_CHANGED');});
test('mutating response cannot change authoritative quote',()=>{const s=setup(),q=quote(s);q.price_minor=1;s.approveQuote(context,q.quote_id,1);assert.equal(call(s,'create_booking',{quote_id:q.quote_id,quote_version:1}).data.price_minor,8000);});
test('add-ons explicitly unsupported not ignored',()=>assert.equal(call(setup(),'create_booking_quote',{...proposal,add_on_service_ids:['svc_beard']}).error.code,'VALIDATION_ERROR'));
test('ten original intents retained, model tests not run',()=>{assert.equal(golden.cases.length,10);assert.ok(golden.cases.every(c=>c.model_review_status==='NOT_RUN'));});
test('golden quote precedes summary approval and create',()=>{const s=golden.cases[0].required_event_order;assert.ok(s.indexOf('create_booking_quote')<s.indexOf('show_complete_quote'));assert.ok(s.indexOf('customer_approves_exact_quote')<s.indexOf('create_booking'));});
test('source receipt has all five uploaded hashes',()=>{const m=read('source-manifest.json');assert.equal(m.files.length,5);assert.ok(m.files.every(f=>/^[a-f0-9]{64}$/.test(f.sha256)));});
test('no model-controlled identity approval key or priority',()=>{for(const t of contracts.tools)for(const k of ['customer_confirmed','customer_id','idempotency_key','priority'])assert.ok(!Object.hasOwn(t.input_schema.properties,k));});
test('fixture has no real map or phone',()=>{assert.ok(catalog.branches.every(b=>b.maps_url===null));assert.ok(catalog.demo_customers.every(c=>!Object.hasOwn(c,'phone')));});
after(()=>{if(process.env.SANDBOX_TRACE_PATH)writeFileSync(process.env.SANDBOX_TRACE_PATH,JSON.stringify({responses,inputExamples},null,2));});
