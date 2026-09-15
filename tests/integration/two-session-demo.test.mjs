import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpServer } from '../../src/server/http.mjs';
import { OWNER_PASS, STAFF_PASS, testApp } from '../platform/helpers.mjs';

const JPEG_HEAD = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    server.on('error', reject);
  });
}

async function withServer(overrides, fn, deps = {}) {
  const { app, config } = testApp(overrides, deps);
  const server = createHttpServer(app, config);
  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn({ app, config, base });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.close();
  }
}

async function req(base, path, { method = 'GET', token, body, headers, raw } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined || raw !== undefined ? { 'content-type': headers?.['content-type'] || 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: raw !== undefined ? raw : (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

test('two-session customer to staff demo: share, inbox, ack, withdraw, booking is not confirmed', async () => {
  await withServer({ WEEKEND_PHOTO_ENABLED: 'true' }, async ({ base, config }) => {
    const customer = await req(base, '/session', {
      method: 'POST',
      body: { role: 'customer', passcode: OWNER_PASS },
    });
    const staff = await req(base, '/session', {
      method: 'POST',
      body: { role: 'staff', passcode: STAFF_PASS },
    });
    const other = await req(base, '/session', {
      method: 'POST',
      body: { role: 'customer', passcode: OWNER_PASS },
    });
    assert.equal(customer.status, 200);
    assert.equal(staff.status, 200);
    const customerToken = customer.json.token;
    const staffToken = staff.json.token;

    const brief = await req(base, '/briefs', {
      method: 'POST',
      token: customerToken,
      body: { text_ar: 'قصة قصيرة من الجوانب، بدون عطر', do_not: ['عطر'] },
    });
    assert.equal(brief.status, 200);
    assert.equal(brief.json.status, 'approved');

    const otherInbox = await req(base, '/staff/briefs', { token: other.json.token });
    assert.equal(otherInbox.status, 401);

    const empty = await req(base, '/staff/briefs', { token: staffToken });
    assert.equal(empty.json.briefs.some((b) => b.brief_id === brief.json.brief_id), false);

    const needShare = await req(base, `/briefs/${brief.json.brief_id}/share-actions`, {
      method: 'POST',
      token: customerToken,
      body: {},
    });
    const textShare = needShare.json.allowed_actions.find((a) => a.kind === 'share_brief_text');
    const blocked = await req(base, `/actions/${textShare.action_id}`, {
      method: 'POST',
      token: customerToken,
      body: {},
    });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.json.code, 'CONSENT_REQUIRED');

    const consent = await req(base, '/consents', {
      method: 'POST',
      token: customerToken,
      body: { kind: 'staff_sharing_text', granted_via: 'customer_ui' },
    });
    assert.equal(consent.status, 200);

    const retryShare = await req(base, `/actions/${textShare.action_id}`, {
      method: 'POST',
      token: customerToken,
      body: {},
    });
    assert.equal(retryShare.json.outcome, 'done');

    const inbox = await req(base, '/staff/briefs', { token: staffToken });
    assert.equal(inbox.json.briefs.length, 1);
    assert.equal(inbox.json.briefs[0].brief_id, brief.json.brief_id);
    assert.equal(inbox.json.briefs[0].status, 'delivered');
    assert.equal(inbox.json.briefs[0].observations, null);

    const ack = await req(base, `/staff/briefs/${brief.json.brief_id}/ack`, {
      method: 'POST',
      token: staffToken,
      body: {},
    });
    assert.equal(ack.status, 200);
    assert.ok(ack.json.acknowledged_at);
    assert.equal(JSON.stringify(ack.json).toLowerCase().includes('confirm'), false);

    const photoConsent = await req(base, '/consents', {
      method: 'POST',
      token: customerToken,
      body: { kind: 'photo_analysis', granted_via: 'customer_ui' },
    });
    assert.equal(photoConsent.status, 200);
    const sharePhotoConsent = await req(base, '/consents', {
      method: 'POST',
      token: customerToken,
      body: { kind: 'staff_sharing_photo', granted_via: 'customer_ui' },
    });
    assert.equal(sharePhotoConsent.status, 200);

    const upload = await fetch(`${base}/uploads`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${customerToken}`,
        'content-type': 'image/jpeg',
      },
      body: JPEG_HEAD,
    });
    assert.equal(upload.status, 200);
    const uploaded = await upload.json();
    assert.match(uploaded.image_ref, /^img_/);

    const shareActions = await req(base, `/briefs/${brief.json.brief_id}/share-actions`, {
      method: 'POST',
      token: customerToken,
      body: {},
    });
    const photoShare = shareActions.json.allowed_actions.find((a) => a.kind === 'share_photo_ref');
    assert.ok(photoShare);
    const photoResult = await req(base, `/actions/${photoShare.action_id}`, {
      method: 'POST',
      token: customerToken,
      body: {},
    });
    assert.equal(photoResult.json.outcome, 'done');

    const withPhoto = await req(base, '/staff/briefs', { token: staffToken });
    assert.equal(withPhoto.json.briefs[0].reference.kind, 'photo_ref');
    assert.equal(withPhoto.json.briefs[0].reference.image_ref, uploaded.image_ref);
    const packed = JSON.stringify(withPhoto.json);
    assert.equal(packed.includes('image_bytes'), false);
    assert.equal(/https?:\/\//.test(packed), false);

    const withdraw = await req(base, `/consents/${consent.json.receipt_id}/revoke`, {
      method: 'POST',
      token: customerToken,
      body: {},
    });
    assert.equal(withdraw.status, 200);
    const afterWithdraw = await req(base, '/staff/briefs', { token: staffToken });
    assert.equal(afterWithdraw.json.briefs.length, 0);
    const resurrect = await req(base, `/staff/briefs/${brief.json.brief_id}/ack`, {
      method: 'POST',
      token: staffToken,
      body: {},
    });
    assert.equal(resurrect.status, 404);

    const handoff = await req(base, '/booking/handoff', { token: customerToken });
    assert.equal(handoff.json.url, config.WEEKEND_OFFICIAL_BOOKING_URL);
    const clicked = await req(base, `/actions/${handoff.json.action_id}`, {
      method: 'POST',
      token: customerToken,
      body: {},
    });
    assert.equal(clicked.json.outcome, 'external_handoff');
    assert.equal(clicked.json.outcome === 'done', false);
  });
});
