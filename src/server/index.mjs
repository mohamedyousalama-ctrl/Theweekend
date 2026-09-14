/**
 * Local/owner-review shell. Binds 127.0.0.1:8787 only.
 * Required env names are in .env.example; missing names fail at start.
 */
import { loadConfig } from './config.mjs';
import { createApp } from './app.mjs';
import { listen } from './http.mjs';

const config = loadConfig(process.env);
const app = createApp(config);
const server = await listen(app, config, 8787);
const address = server.address();
process.stdout.write(`weekend listening on 127.0.0.1:${address.port} env=${config.WEEKEND_ENV}\n`);
