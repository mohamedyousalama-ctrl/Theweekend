import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError } from './app.mjs';
import { newId } from './ids.mjs';

const JSON_TYPE = 'application/json; charset=utf-8';
const UI_ROOT = resolve(join(fileURLToPath(new URL('../ui', import.meta.url))));
const CONTENT_SECURITY_POLICY = "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

function securityHeaders(extra = {}) {
  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'cache-control': 'no-store',
    'content-security-policy': CONTENT_SECURITY_POLICY,
    ...extra,
  };
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, securityHeaders({
    'content-type': JSON_TYPE,
    'content-length': Buffer.byteLength(payload),
  }));
  res.end(payload);
}

function bearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

/**
 * Client address for the passcode limiter. Without a trusted proxy the socket address is the only
 * value the client cannot choose. Behind Railway's proxy (WEEKEND_TRUST_PROXY=1) the platform appends
 * the real client address as the LAST entry of X-Forwarded-For; earlier entries are client-supplied
 * and are never used (rotating them would otherwise bypass the limiter or lock out a victim).
 */
export function clientKey(req, config = {}) {
  const socketAddress = req.socket?.remoteAddress || 'unknown';
  if (!config.WEEKEND_TRUST_PROXY) return socketAddress;
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const parts = forwarded.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return socketAddress;
}

async function readLimitedBytes(req, maxBytes, onTooLarge) {
  const chunks = [];
  let n = 0;
  for await (const chunk of req) {
    n += chunk.length;
    if (n > maxBytes) {
      throw onTooLarge(maxBytes);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req, maxBytes) {
  const buf = await readLimitedBytes(req, maxBytes, (limit) => new AppError({
    contract_version: '0.1.0',
    code: 'VALIDATION_ERROR',
    message_key: 'http.body_too_large',
    retryable: false,
    details: { limit },
  }, 413));
  if (buf.length === 0) return {};
  let value;
  try {
    value = JSON.parse(buf.toString('utf8'));
  } catch {
    throw new AppError({
      contract_version: '0.1.0',
      code: 'VALIDATION_ERROR',
      message_key: 'http.invalid_json',
      retryable: false,
      details: { field: 'body' },
    }, 400);
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError({
      contract_version: '0.1.0',
      code: 'VALIDATION_ERROR',
      message_key: 'http.invalid_json',
      retryable: false,
      details: { field: 'body' },
    }, 400);
  }
  return value;
}

function tryServeUi(req, res, pathname) {
  if ((req.method || 'GET') !== 'GET') return false;
  if (!existsSync(UI_ROOT) || !statSync(UI_ROOT).isDirectory()) return false;
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = resolve(join(UI_ROOT, rel));
  if (target !== UI_ROOT && !target.startsWith(`${UI_ROOT}/`)) return false;
  if (!existsSync(target) || !statSync(target).isFile()) return false;
  res.writeHead(200, securityHeaders({
    'content-type': STATIC_TYPES[extname(target)] || 'application/octet-stream',
  }));
  createReadStream(target).pipe(res);
  return true;
}

function normalizeRoute(pathname) {
  return String(pathname || '/')
    .replace(/\/actions\/[^/]+/g, '/actions/:action_id')
    .replace(/\/briefs\/[^/]+\/share-actions/g, '/briefs/:brief_id/share-actions')
    .replace(/\/consents\/[^/]+\/revoke/g, '/consents/:receipt_id/revoke')
    .replace(/\/preferences\/[^/]+\/revoke/g, '/preferences/:preference_id/revoke')
    .replace(/\/staff\/briefs\/[^/]+\/ack/g, '/staff/briefs/:brief_id/ack')
    .replace(/\/staff\/handoffs\/[^/]+\/accept/g, '/staff/handoffs/:handoff_id/accept')
    .replace(/\/staff\/handoffs\/[^/]+\/release/g, '/staff/handoffs/:handoff_id/release');
}

export function createHttpServer(app, config) {
  return createServer(async (req, res) => {
    const requestId = newId('rid_');
    const method = req.method || 'GET';
    let route = '/';
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const path = url.pathname;
      route = normalizeRoute(path);
      if (method === 'GET' && path === '/health') {
        const state = app.health();
        return send(res, state.store === 'ok' ? 200 : 503, state);
      }
      if (method === 'POST' && path === '/session') {
        const body = await readJson(req, 4096);
        const out = app.createSession(body.role, body.passcode, { clientKey: clientKey(req, config) });
        return send(res, 200, out);
      }
      if (method === 'GET' && path === '/context') return send(res, 200, app.context(bearer(req)));
      if (method === 'POST' && path === '/turns') {
        const body = await readJson(req, 8192);
        return send(res, 200, await app.submitTurn(bearer(req), body));
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
      if (method === 'POST' && /^\/briefs\/[^/]+\/share-actions$/.test(path)) {
        await readJson(req, 1024);
        const briefId = path.split('/')[2];
        return send(res, 200, app.issueShareActionsForBrief(bearer(req), briefId));
      }
      if (method === 'GET' && path === '/staff/briefs') {
        return send(res, 200, { briefs: app.staffBriefs(bearer(req)) });
      }
      if (method === 'POST' && /^\/staff\/briefs\/[^/]+\/ack$/.test(path)) {
        const id = path.split('/')[3];
        await readJson(req, 1024);
        return send(res, 200, app.acknowledgeBrief(bearer(req), id));
      }
      if (method === 'GET' && path === '/staff/handoffs') {
        return send(res, 200, {
          contract_version: '0.1.0',
          handoffs: app.staffHandoffs(bearer(req)),
        });
      }
      if (method === 'POST' && /^\/staff\/handoffs\/[^/]+\/accept$/.test(path)) {
        const id = path.split('/')[3];
        await readJson(req, 1024);
        return send(res, 200, app.acceptStaffHandoff(bearer(req), id));
      }
      if (method === 'POST' && /^\/staff\/handoffs\/[^/]+\/release$/.test(path)) {
        const id = path.split('/')[3];
        await readJson(req, 1024);
        return send(res, 200, app.releaseStaffHandoff(bearer(req), id));
      }
      if (method === 'GET' && path === '/booking/handoff') {
        return send(res, 200, app.issueBookingAction(bearer(req)));
      }
      if (method === 'POST' && path === '/uploads') {
        const type = req.headers['content-type'] || '';
        const bytes = await readLimitedBytes(req, config.WEEKEND_UPLOAD_MAX_BYTES, (limit) => new AppError({
          contract_version: '0.1.0',
          code: 'UPLOAD_REJECTED',
          message_key: 'upload.rejected',
          retryable: false,
          details: { field: 'image_ref', limit },
        }, 400));
        return send(res, 200, app.registerUpload(bearer(req), {
          byteLength: bytes.length,
          contentType: type,
          bytes,
        }));
      }
      if (tryServeUi(req, res, path)) return;
      return send(res, 404, {
        contract_version: '0.1.0',
        code: 'NOT_FOUND',
        message_key: 'http.not_found',
        retryable: false,
        details: {},
      });
    } catch (err) {
      if (err instanceof AppError) return send(res, err.status, err.shape);
      console.error(JSON.stringify({
        request_id: requestId,
        method,
        route,
        stack: err?.stack || String(err),
      }));
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

export function listenTarget() {
  const raw = process.env.PORT;
  if (typeof raw === 'string' && raw.trim()) {
    const port = Number.parseInt(raw, 10);
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
      throw new AppError({
        contract_version: '0.1.0',
        code: 'VALIDATION_ERROR',
        message_key: 'http.port',
        retryable: false,
        details: { field: 'port' },
      }, 500);
    }
    return { host: '0.0.0.0', port };
  }
  return { host: '127.0.0.1', port: 8787 };
}

export function listen(app, config, port) {
  const target = port === undefined ? listenTarget() : { host: '127.0.0.1', port };
  const server = createHttpServer(app, config);
  return new Promise((resolve, reject) => {
    server.listen(target.port, target.host, () => resolve(server));
    server.on('error', reject);
  });
}
