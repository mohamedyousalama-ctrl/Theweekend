/**
 * Internal model seam. Stream A owns real prompts/inference.
 * This adapter never calls a provider. Missing real wiring stays unavailable.
 */
import { newId } from '../../server/ids.mjs';

function usage(sessionId, turnId, outcome, now) {
  return {
    contract_version: '0.1.0',
    usage_id: newId('use_'),
    session_id: sessionId,
    turn_id: turnId,
    provider: 'none',
    model_id: 'unavailable',
    prompt_version: 'none',
    input_tokens: 0,
    output_tokens: 0,
    latency_ms: 0,
    cost_estimate_minor: null,
    outcome,
    created_at: now,
  };
}

function message(text, lang = 'ar') {
  return { text, lang };
}

export function runModelTurn({ context, input, now, image_bytes }) {
  void image_bytes;
  const model = context.capabilities.model;
  if (model === 'unavailable' || model === 'real') {
    const record = usage(context.session_id, input.turn_id, model === 'real' ? 'error' : 'error', now);
    return {
      usage: record,
      output: {
        contract_version: '0.1.0',
        turn_id: input.turn_id,
        state: 'unavailable',
        messages: [message('المحادثة بالنموذج غير متاحة في هذا الإعداد.')],
        observations: null,
        style_options: [],
        proposed_actions: [],
        knowledge_refs: [],
        brief_draft: null,
        usage_ref: record.usage_id,
        flags: [],
        error: {
          contract_version: '0.1.0',
          code: 'MODEL_UNAVAILABLE',
          message_key: 'model.unavailable',
          retryable: true,
          details: { capability: 'model' },
        },
      },
    };
  }

  const record = usage(context.session_id, input.turn_id, 'ok', now);
  record.provider = 'mock';
  record.model_id = 'local-script';
  record.prompt_version = 'local.mock.0';
  return {
    usage: record,
    output: {
      contract_version: '0.1.0',
      turn_id: input.turn_id,
      state: 'ok',
      messages: [message('هذا رد محلي للاختبار فقط، وليس استشارة حقيقية.')],
      observations: null,
      style_options: [],
      proposed_actions: [
        {
          kind: 'open_official_booking',
          label_ar: 'صفحة الحجز الرسمية',
          label_en: 'Official booking page',
          payload: {},
        },
        {
          kind: 'talk_to_staff',
          label_ar: 'تحدث مع الفريق',
          label_en: 'Talk to staff',
          payload: {},
        },
      ],
      knowledge_refs: [],
      brief_draft: null,
      usage_ref: record.usage_id,
      flags: [],
      error: null,
    },
  };
}
