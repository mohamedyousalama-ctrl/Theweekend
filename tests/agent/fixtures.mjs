import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { loadKnowledge } from '../../src/agent/adapter.mjs';

export const knowledge = loadKnowledge();
export const PRICE_REF = 'kno_mrs_price_haircut';
export const BOOKING_REF = 'kno_mrs_booking_url';

export function context(overrides = {}) {
  return {
    contract_version: '0.1.0',
    session_id: 'ses_test_a',
    subject_id: 'sub_test_a',
    role: 'customer',
    verified: true,
    branch_id: 'br_marsiya',
    locale: 'ar',
    capabilities: { model: 'real', photo: 'enabled', booking_handoff: 'official_link', staff_inbox: 'enabled', preferences: 'enabled' },
    consents: [],
    issued_at: '2026-09-14T06:00:00Z',
    ...overrides,
  };
}

export function photoConsent() {
  return {
    contract_version: '0.1.0',
    receipt_id: 'rcp_test_photo',
    subject_id: 'sub_test_a',
    kind: 'photo_analysis',
    notice_version: 'notice_photo_v1',
    granted_at: '2026-09-14T06:00:00Z',
    revoked_at: null,
    retention_policy_key: 'ret_photo_v1',
    granted_via: 'customer_ui',
  };
}

export function input(text = 'تمام', overrides = {}) {
  return {
    contract_version: '0.1.0',
    session_id: 'ses_test_a',
    turn_id: randomUUID(),
    text,
    image_ref: null,
    client_action_id: null,
    locale_hint: 'auto',
    ...overrides,
  };
}

export function modelJson(overrides = {}) {
  return {
    reply: [{ text: 'قص الشعر بـ30 ريال شامل الضريبة، والمدة 35 دقيقة. تبي تحجز؟', lang: 'ar' }],
    observations: { present: false, hair_length: 'uncertain', hair_texture: 'uncertain', beard: 'uncertain', top_density_visible: 'uncertain', face_visible: 'covered', limitations: [], confidence: 'low' },
    style_options: [],
    proposed_actions: [{ kind: 'open_official_booking', label_ar: 'صفحة الحجز', label_en: 'Booking page', payload: { preference_kind: 'none', value_text: '' } }],
    knowledge_refs: [PRICE_REF, BOOKING_REF],
    brief_draft: { present: false, barber_preference: '', requested_look_ar: '', do_not: [] },
    flags: [],
    ...overrides,
  };
}

export function response(json, extra = {}) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: typeof json === 'string' ? json : JSON.stringify(json) }],
    usage: { input_tokens: 1200, output_tokens: 180, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 },
    ...extra,
  };
}

/** Fake Anthropic client: `script` is an array of responses or functions(params) → response|throw. */
export function fakeClient(script) {
  const calls = [];
  let i = 0;
  return {
    calls,
    messages: {
      async create(params) {
        calls.push(params);
        const step = script[Math.min(i, script.length - 1)];
        i += 1;
        const out = typeof step === 'function' ? step(params) : step;
        if (out instanceof Error) throw out;
        return out;
      },
    },
  };
}

export function badRequest() {
  return new Anthropic.BadRequestError(400, { type: 'error', error: { type: 'invalid_request_error', message: 'bad' } }, 'bad', new Headers());
}

export const PNG_BYTES = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000101f2d3d0140000000049454e44ae426082', 'hex');

export function realConfig(overrides = {}) {
  return {
    WEEKEND_ENV: 'local',
    WEEKEND_MODEL_MODE: 'real',
    WEEKEND_MODEL_PROVIDER: 'anthropic',
    WEEKEND_MODEL_ID: 'claude-opus-5',
    WEEKEND_VISION_MODEL_ID: 'claude-opus-5',
    WEEKEND_MODEL_API_KEY: 'test-key-not-real',
    WEEKEND_REQUEST_TIMEOUT_MS: 8000,
    ...overrides,
  };
}
