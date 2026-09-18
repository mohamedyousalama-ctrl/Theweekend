import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson } from './helpers.mjs';
import { createRoot } from './dom-shim.mjs';
import { renderHandoffList } from '../../src/ui/staff/handoff-list.js';
import { renderBriefPanel } from '../../src/ui/staff/brief-panel.js';
import { renderInboxList } from '../../src/ui/staff/inbox-list.js';
import { renderPhotoNotes } from '../../src/ui/staff/photo-notes.js';
import { messageFromKey } from '../../src/ui/copy.js';

const { createRakanUi } = await import('../../src/ui/app.js');

const brief = { ...readJson('valid/barber-brief.json'), status: 'delivered' };
const observations = readJson('valid/cosmetic-observations.json');
const staffContext = {
  ...readJson('valid/trusted-context.json'),
  role: 'staff',
  subject_id: 'sub_syn_staff_a',
  capabilities: {
    ...readJson('valid/trusted-context.json').capabilities,
    staff_inbox: 'enabled',
  },
};
const healthOk = { ...readJson('valid/health-state.json'), staff_inbox: 'ok' };

const received = {
  contract_version: '0.1.0',
  handoff_id: 'hnd_syn_a',
  subject_id: 'sub_syn_customer_a',
  session_id: 'ses_syn_a',
  status: 'received',
  received_at: '2026-09-17T10:00:00Z',
  assigned_at: null,
  accepted_at: null,
  accepted_by: null,
  timed_out_at: null,
  released_at: null,
};

test('handoff.queued copy is dedicated, not generic pending', () => {
  const ar = messageFromKey('handoff.queued', 'ar');
  const en = messageFromKey('handoff.queued', 'en');
  assert.match(ar, /ما استلمه أحد/);
  assert.match(en, /has accepted it yet/);
  assert.notEqual(ar, messageFromKey('booking.pending_unconfirmed', 'ar'));
});

test('received handoff offers accept and does not claim staff already took it', () => {
  const view = renderHandoffList({
    handoffs: [received],
    locale: 'ar',
    selfSubjectId: 'sub_syn_staff_a',
  });
  assert.equal(view.meta.claimedAcceptance, false);
  assert.match(view.html, /data-handoff-accept="true"/);
  assert.match(view.html, /data-handoff-release="true"/);
  assert.match(view.html, /data-accepted="false"/);
  assert.match(view.html, /ما انقبل بعد/);
  assert.match(view.html, /data-handoff-warning="not_accepted_until_click"/);
  assert.match(view.html, /ما نقول إن الفريق استلم إلا بعد زر القبول/);
});

test('accepted copy depends on mine and hides the not-accepted warning', () => {
  const acceptedByOther = {
    ...received,
    status: 'accepted',
    accepted_at: '2026-09-17T10:05:00Z',
    accepted_by: 'sub_syn_staff_b',
  };
  const other = renderHandoffList({
    handoffs: [acceptedByOther],
    locale: 'en',
    selfSubjectId: 'sub_syn_staff_a',
  });
  assert.match(other.html, /Accepted by another staff member/);
  assert.doesNotMatch(other.html, /data-handoff-warning="not_accepted_until_click"/);
  assert.doesNotMatch(other.html, /Do not treat this as staff-accepted until Accept is pressed/);

  const otherAr = renderHandoffList({
    handoffs: [acceptedByOther],
    locale: 'ar',
    selfSubjectId: 'sub_syn_staff_a',
  });
  assert.match(otherAr.html, /موظف ثاني قبل الطلب/);
  assert.doesNotMatch(otherAr.html, /قبل الطلب موظف آخر/);

  const mine = renderHandoffList({
    handoffs: [{ ...acceptedByOther, accepted_by: 'sub_syn_staff_a' }],
    locale: 'ar',
    selfSubjectId: 'sub_syn_staff_a',
  });
  assert.match(mine.html, /قبلت الطلب/);
  assert.doesNotMatch(mine.html, /موظف ثاني قبل الطلب/);
  assert.doesNotMatch(mine.html, /data-handoff-warning="not_accepted_until_click"/);
});

test('another staff member cannot steal an accepted handoff', () => {
  const view = renderHandoffList({
    handoffs: [{
      ...received,
      status: 'accepted',
      accepted_at: '2026-09-17T10:05:00Z',
      accepted_by: 'sub_syn_staff_b',
    }],
    selfSubjectId: 'sub_syn_staff_a',
  });
  assert.doesNotMatch(view.html, /data-handoff-accept="true"/);
  assert.match(view.html, /data-handoff-release="true"/);
  assert.match(view.html, /data-accepted="true"/);
});

test('a row accepted by another subject still offers Release and Release posts /staff/handoffs/:id/release', async () => {
  const acceptedByOther = {
    ...received,
    status: 'accepted',
    accepted_at: '2026-09-17T10:05:00Z',
    accepted_by: 'sub_syn_staff_b',
  };
  const view = renderHandoffList({
    handoffs: [acceptedByOther],
    selfSubjectId: 'sub_syn_staff_a',
  });
  assert.match(view.html, /data-handoff-release="true"/);
  assert.doesNotMatch(view.html, /data-handoff-accept="true"/);

  const calls = [];
  const fetchImpl = async (path, opts = {}) => {
    calls.push({ path, method: opts.method || 'GET' });
    if (path === '/staff/briefs') {
      return { ok: true, status: 200, json: async () => ({ briefs: [] }) };
    }
    if (path === '/staff/handoffs') {
      return { ok: true, status: 200, json: async () => ({ handoffs: [acceptedByOther] }) };
    }
    if (path === '/staff/handoffs/hnd_syn_a/release') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ...acceptedByOther, status: 'released', released_at: '2026-09-17T10:10:00Z' }),
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const root = createRoot();
  const app = createRakanUi(root, { fetchImpl });
  app.state.context = staffContext;
  app.state.token = 'tok_syn';
  app.state.health = healthOk;
  app.state.surface = 'staff_inbox';
  app.paint();
  const inboxBtn = root.querySelector('[data-surface="staff_inbox"]');
  assert.ok(inboxBtn);
  inboxBtn.click();
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  const release = root.querySelector('[data-handoff-release="true"]');
  assert.ok(release);
  assert.equal(release.click(), 1);
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  assert.equal(calls.filter((c) => c.path === '/staff/handoffs/hnd_syn_a/release' && c.method === 'POST').length, 1);
});

test('staff brief panel renders written photo notes and never an image', () => {
  const view = renderBriefPanel({
    brief: { ...brief, observations },
    locale: 'ar',
  });
  assert.equal(view.meta.photoNotes, true);
  assert.equal(view.meta.photoBytes, false);
  assert.match(view.html, /data-photo-notes="true"/);
  assert.match(view.html, /data-photo-bytes="false"/);
  assert.match(view.html, /ذقن خفيفة/);
  assert.doesNotMatch(view.html, />stubble</);
  const en = renderBriefPanel({
    brief: { ...brief, observations },
    locale: 'en',
  });
  assert.match(en.html, /light stubble/);
  assert.doesNotMatch(view.html, /<img/i);
  const card = renderInboxList({
    context: staffContext,
    health: healthOk,
    briefs: [{ ...brief, observations }],
  });
  assert.match(card.html, /data-photo-notes="true"/);
  assert.doesNotMatch(card.html, /<img/i);
});

test('unknown photo-note limitation is labelled, not printed as a raw token', () => {
  const view = renderPhotoNotes({
    observations: { ...observations, limitations: ['low_resolution', 'covered'] },
    locale: 'en',
  });
  assert.match(view.html, /note: low resolution/);
  assert.doesNotMatch(view.html, /low_resolution/);
  assert.match(view.html, /covered/);
  assert.doesNotMatch(view.html, /note: covered/);
  const ar = renderPhotoNotes({
    observations: { ...observations, limitations: ['low_resolution'] },
    locale: 'ar',
  });
  assert.match(ar.html, /ملاحظة: low resolution/);
  assert.doesNotMatch(ar.html, /low_resolution/);
});

test('staff inbox loads briefs and handoffs then accept posts once', async () => {
  const calls = [];
  const fetchImpl = async (path, opts = {}) => {
    calls.push({ path, method: opts.method || 'GET' });
    if (path === '/staff/briefs') {
      return { ok: true, status: 200, json: async () => ({ briefs: [] }) };
    }
    if (path === '/staff/handoffs') {
      return { ok: true, status: 200, json: async () => ({ handoffs: [received] }) };
    }
    if (path === '/staff/handoffs/hnd_syn_a/accept') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ...received,
          status: 'accepted',
          accepted_at: '2026-09-17T10:06:00Z',
          accepted_by: 'sub_syn_staff_a',
        }),
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const root = createRoot();
  const app = createRakanUi(root, { fetchImpl });
  app.state.context = staffContext;
  app.state.token = 'tok_syn';
  app.state.health = healthOk;
  app.state.surface = 'staff_inbox';
  app.paint();
  const inboxBtn = root.querySelector('[data-surface="staff_inbox"]');
  assert.ok(inboxBtn);
  inboxBtn.click();
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  assert.ok(calls.some((c) => c.path === '/staff/briefs'));
  assert.ok(calls.some((c) => c.path === '/staff/handoffs'));
  const accept = root.querySelector('[data-handoff-accept="true"]');
  assert.ok(accept);
  assert.equal(accept.click(), 1);
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  assert.equal(calls.filter((c) => c.path === '/staff/handoffs/hnd_syn_a/accept' && c.method === 'POST').length, 1);
  assert.equal(app.state.handoffs[0].status, 'accepted');
});
