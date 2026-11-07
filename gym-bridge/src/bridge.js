// Syncro gym bridge as a service on a Linux server (systemd). The Syncro desktop app runs the same
// core on the reception computer, which is the easier option for most gyms.
import { readFileSync, existsSync } from 'node:fs';
import { createBridge } from './core.js';

function loadEnv(file = new URL('../.env', import.meta.url)) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();
const env = (k, d) => process.env[k] ?? d;
const missing = ['SYNCRO_URL', 'DEVICE_KEY', 'DEVICE_HOST', 'DEVICE_USER', 'DEVICE_PASS'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Faltan variables en .env: ${missing.join(', ')}`);
  process.exit(1);
}

const bridge = createBridge({
  syncroUrl: env('SYNCRO_URL'),
  deviceKey: env('DEVICE_KEY'),
  host: env('DEVICE_HOST'),
  user: env('DEVICE_USER'),
  pass: env('DEVICE_PASS'),
  doorNo: Number(env('DOOR_NO', 1)),
  library: env('FACE_LIBRARY', '1'),
  eventPollSeconds: Number(env('EVENT_POLL_SECONDS', 2)),
  rosterSyncSeconds: Number(env('ROSTER_SYNC_SECONDS', 60)),
  passMinors: env('PASS_MINORS', '1,38,75').split(','),
  failMinors: env('FAIL_MINORS', '6,9,10,21,76').split(','),
  stateFile: env('STATE_FILE', new URL('../state.json', import.meta.url).pathname),
});
bridge.start();
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { bridge.stop(); process.exit(0); });
