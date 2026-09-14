import { createServer } from 'node:http';
import { AppError } from './app.mjs';

const JSON_TYPE = 'application/json; charset=utf-8';

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': JSON_TYPE,
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

function bearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

async function readJson(req, maxBytes) {
  const chunks = [];
  let n = 0;
  for await (const chunk of req) {
    n += chunk.length;
    if (n > maxBytes) {
      throw new AppError({
        contract_version: '0.1.0',
        code: 'VALIDATION_ERROR',
        message_key: 'http.body_too_large',
        retryable: false,
        details: { limit: maxBytes },
      }, 413);
    }
    chunks.push(chunk);
  }
  if (n === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AppError({
      contract_version: '0.1.0',
      code: 'VALIDATION_ERROR',
      message_key: 'http.invalid_json',
      retryable: false,
      details: { field: 'body' },
    }, 400);
  }
}

async function discardBody(req, maxBytes) {
  let n = 0;
  for await (const chunk of req) {
    n += chunk.length;
    if (n > maxBytes) {
      throw new AppError({
        contract_version: '0.1.0',
        code: 'UPLOAD_REJECTED',
        message_key: 'upload.rejected',
        retryable: false,
        details: { field: 'image_ref', limit: maxBytes },
      }, 400);
    }
  }
  return n;
}

export function createHttpServer(app, config) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const path = url.pathname;
      const method = req.method || 'GET';
      if (method === 'GET' && path === '/health') return send(res, 200, app.health());
      if (method === 'POST' && path === '/session') {
        const body = await readJson(req, 4096);
        const out = app.createSession(body.role, body.passcode);
        return send(res, 200, out);
      }
      if (method === 'GET' && path === '/context') return send(res, 200, app.context(bearer(req)));
      if (method === 'POST' && path === '/turns') {
        const body = await readJson(req, 8192);
        return send(res, 200, app.submitTurn(bearer(req), body));
      }
      if (method === 'POST' && path.startsWith('/actions/')) {
        await readJson(req, 1024);
        return send(res, 200, app.executeAction(bearer(req), path.slice('/actions/'.length)));
      }
      if (method === 'POST' && path === '/consents') {
        const body = await readJson(req, 2048);
        return send(res, 200, app.grantConsent(bearer(req), body.kind, body.granted_via));
      }
      if (method === 'POST' && /^\/consents\/[^/]+\/revoke$/.test(path)) {
        const id = path.split('/')[2];
        await readJson(req, 1024);
        return send(res, 200, app.revokeConsent(bearer(req), id));
      }
      if (method === 'GET' && path === '/preferences') {
        return send(res, 200, { preferences: app.listPreferences(bearer(req)) });
      }
      if (method === 'POST' && path === '/preferences') {
        const body = await readJson(req, 2048);
        return send(res, 200, app.savePreference(bearer(req), body));
      }
      if (method === 'POST' && /^\/preferences\/[^/]+\/revoke$/.test(path)) {
        const id = path.split('/')[2];
        await readJson(req, 1024);
        return send(res, 200, app.deletePreference(bearer(req), id));
      }
      if (method === 'POST' && path === '/briefs') {
        const body = await readJson(req, 4096);
        return send(res, 200, app.createBrief(bearer(req), body));
      }
      if (method === 'GET' && path === '/staff/briefs') {
        return send(res, 200, { briefs: app.staffBriefs(bearer(req)) });
      }
      if (method === 'POST' && /^\/staff\/briefs\/[^/]+\/ack$/.test(path)) {
        const id = path.split('/')[3];
        await readJson(req, 1024);
        return send(res, 200, app.acknowledgeBrief(bearer(req), id));
      }
      if (method === 'GET' && path === '/booking/handoff') {
        return send(res, 200, app.issueBookingAction(bearer(req)));
      }
      if (method === 'POST' && path === '/uploads') {
        const type = req.headers['content-type'] || '';
        const bytes = await discardBody(req, config.WEEKEND_UPLOAD_MAX_BYTES);
        return send(res, 200, app.registerUpload(bearer(req), { byteLength: bytes, contentType: type }));
      }
      return send(res, 404, {
        contract_version: '0.1.0',
        code: 'NOT_FOUND',
        message_key: 'http.not_found',
        retryable: false,
        details: {},
      });
    } catch (err) {
      if (err instanceof AppError) return send(res, err.status, err.shape);
      send(res, 500, {
        contract_version: '0.1.0',
        code: 'CAPABILITY_UNAVAILABLE',
        message_key: 'http.internal',
        retryable: true,
        details: {},
      });
    }
  });
}

export function listen(app, config, port = 8787) {
  const server = createHttpServer(app, config);
  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}
