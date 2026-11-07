// Quick check before installing the service: can we reach the reader and Syncro?
import { readFileSync, existsSync } from 'node:fs';
import { checkConnection } from './core.js';

const file = new URL('../.env', import.meta.url);
if (existsSync(file)) for (const line of readFileSync(file, 'utf8').split('\n')) {
  const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const e = process.env;
const steps = await checkConnection({ syncroUrl: e.SYNCRO_URL, deviceKey: e.DEVICE_KEY, host: e.DEVICE_HOST, user: e.DEVICE_USER, pass: e.DEVICE_PASS });
for (const s of steps) console.log(`${s.ok ? '✅' : '❌'} ${s.label}${s.detail ? `: ${s.detail}` : ''}`);
const ok = steps.every((s) => s.ok);
console.log(ok ? '\nTodo listo. Inicia el servicio con: sudo systemctl start syncro-gym-bridge' : '\nCorrige lo marcado con ❌ y vuelve a probar.');
process.exit(ok ? 0 : 1);
