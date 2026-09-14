/**
 * Pure presentation policy, NOT authentication or a transaction executor.
 * Only call with server-validated state. The click handler must revalidate
 * identity, ownership, consent, capability, quote version and expiry.
 * No network, credentials, database, model calls, or Kivo dependency.
 */
const PHASES = new Set(['start', 'style_options', 'style_selected', 'photo',
  'quote', 'unknown_outcome', 'pending', 'confirmed', 'complaint']);
const CAPS = new Set(['consultation', 'photo', 'slots', 'book', 'request',
  'products', 'handoff', 'contact', 'booking_read', 'brief']);
const BOOLS = ['ownerVerified', 'quoteCurrent', 'bookingConfirmed',
  'photoConsent', 'adultConfirmed', 'productDeclined', 'medicalConcern', 'humanOwned'];
const KEYS = new Set(['phase','mode','capabilities','catalogKind','styleOptionCount',...BOOLS]);
export function nextActionIds(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Invalid context');
  if (Object.keys(input).some(k => !KEYS.has(k))) throw new TypeError('Unknown context key');
  if (!PHASES.has(input.phase)) throw new TypeError('Unknown phase');
  if (!['DEMO','REQUEST_ONLY','INTEGRATED'].includes(input.mode)) throw new TypeError('Unknown mode');
  if (!['synthetic','merchant_approved','unavailable'].includes(input.catalogKind)) throw new TypeError('Invalid catalog kind');
  if (!Array.isArray(input.capabilities) || input.capabilities.some(c => !CAPS.has(c))) throw new TypeError('Invalid capabilities');
  for (const k of BOOLS) if (k in input && typeof input[k] !== 'boolean') throw new TypeError('Boolean required: '+k);
  if ('styleOptionCount' in input && ![0,1,2].includes(input.styleOptionCount)) throw new TypeError('Invalid option count');
  const has = c => input.capabilities.includes(c);
  const truth = input.catalogKind === 'merchant_approved' || (input.mode === 'DEMO' && input.catalogKind === 'synthetic');
  const help = () => has('handoff') ? ['request_staff'] : has('contact') ? ['official_contact'] : [];
  const book = () => !truth ? help() : input.mode === 'REQUEST_ONLY'
    ? (has('request') ? ['prepare_booking_request'] : help())
    : (has('slots') ? ['view_slots'] : help());
  const done = xs => [...new Set(xs)].slice(0,3);
  if (input.humanOwned === true) return [];
  if (input.medicalConcern === true) return done(['professional_assessment_guidance',...help()]);
  if (input.phase === 'complaint') return done([...help(),'add_complaint_details']);
  if (['unknown_outcome','pending'].includes(input.phase)) {
    return done([...(input.ownerVerified === true && has('booking_read') ? ['check_existing_operation'] : []),...help()]);
  }
  if (input.phase === 'quote') {
    if (!truth || input.ownerVerified !== true || input.quoteCurrent !== true) return done(['refresh_proposal',...help()]);
    const commit = input.mode === 'REQUEST_ONLY'
      ? (has('request') ? ['submit_booking_request'] : [])
      : (has('book') ? [input.mode === 'DEMO' ? 'simulate_booking' : 'confirm_booking'] : []);
    return done([...commit,'edit_proposal','go_back']);
  }
  if (input.phase === 'confirmed') {
    if (input.bookingConfirmed !== true || input.ownerVerified !== true || !truth) return done(help());
    return done([...(has('booking_read') ? ['booking_details'] : []),...(has('brief') ? ['prepare_barber_brief'] : []),...help()]);
  }
  if (input.phase === 'photo') {
    if (!has('photo') || input.adultConfirmed !== true) return done(['text_style_help',...help()]);
    return done([input.photoConsent === true ? 'submit_photo_for_analysis' : 'review_photo_permission','text_style_help',...help()]);
  }
  if (input.phase === 'style_options') {
    const n=input.styleOptionCount ?? 0;
    return n ? done([...Array.from({length:n},(_,i)=>'choose_style_'+(i+1)),'adjust_style']) : ['describe_style_goal'];
  }
  if (input.phase === 'style_selected') {
    return done([...book(),'styling_instructions',...(truth && has('products') && input.productDeclined !== true ? ['view_product_options'] : [])]);
  }
  return done([...book(),...(has('consultation') ? ['start_style_consultation'] : []),'ask_question']);
}
