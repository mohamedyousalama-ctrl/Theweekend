/**
 * Local default: 127.0.0.1:8787. When PORT is set (Railway), bind 0.0.0.0.
 * Required env names are in .env.example; missing names fail at start.
 */
import { loadConfig } from './config.mjs';
import { createApp } from './app.mjs';
import { listen, listenTarget } from './http.mjs';
import { createRakanAdapter } from '../agent/adapter.mjs';

const config = loadConfig(process.env);
// Stream A owns the real model adapter; mock mode keeps the local labelled script (docs/16 §4).
const adapter = config.WEEKEND_MODEL_MODE === 'real' ? createRakanAdapter(config) : undefined;
// Cost ceiling of one turn, reserved before each paid call: the adapter's own declaration when it has one,
// otherwise a tenth of the daily cap (a turn costs cents; the ceiling is released as soon as the call returns).
const costCeilingMinor = adapter
  ? (Number.isInteger(adapter.costCeilingMinor) && adapter.costCeilingMinor > 0
    ? adapter.costCeilingMinor
    : Math.max(1, Math.ceil((config.WEEKEND_SPEND_CAP_USD_PER_DAY * 100) / 10)))
  : 0;
const app = createApp(config, adapter ? { adapter, costCeilingMinor } : {});
const target = listenTarget();
const server = await listen(app, config);
const address = server.address();
process.stdout.write(
  `weekend listening on ${target.host}:${address.port} env=${config.WEEKEND_ENV}\n`,
);
