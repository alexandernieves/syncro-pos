// Quick check before installing the service: can we reach the reader and Syncro?
import { readFileSync, existsSync } from 'node:fs';
import { Isapi } from './isapi.js';

const file = new URL('../.env', import.meta.url);
if (existsSync(file)) for (const line of readFileSync(file, 'utf8').split('\n')) {
  const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const e = process.env;
const step = async (label, fn) => {
  try { const r = await fn(); console.log(`✅ ${label}${r ? `: ${r}` : ''}`); return true; } catch (err) { console.log(`❌ ${label}: ${err.message}`); return false; }
};

const device = new Isapi({ host: e.DEVICE_HOST, user: e.DEVICE_USER, pass: e.DEVICE_PASS });
let ok = true;
ok = (await step('Lector responde', async () => { const i = await device.deviceInfo(); return `${i.model} · serie ${i.serialNumber} · firmware ${i.firmware}`; })) && ok;
ok = (await step('Usuario y clave del lector', async () => `${await device.userCount()} personas cargadas`)) && ok;
ok = (await step('Lectura de eventos', async () => {
  const end = new Date(), start = new Date(end.getTime() - 3600_000);
  const iso = (d) => d.toISOString().slice(0, 19) + 'Z';
  const r = await device.searchEvents(iso(start), iso(end));
  return `${r.items.length} eventos en la última hora`;
})) && ok;
ok = (await step('Conexión con Syncro y clave del lector', async () => {
  const res = await fetch(`${e.SYNCRO_URL.replace(/\/$/, '')}/gym/bridge/heartbeat`, { method: 'POST', headers: { 'x-device-key': e.DEVICE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: { check: true } }) });
  if (res.status === 401) throw new Error('la clave no es válida');
  if (!res.ok) throw new Error(`respondió ${res.status}`);
  const r = await res.json();
  return `modo ${r.mode === 'STRICT' ? 'estricto' : 'por fechas'} · zona ${r.timeZone}`;
})) && ok;
console.log(ok ? '\nTodo listo. Inicia el servicio con: sudo systemctl start syncro-gym-bridge' : '\nCorrige lo marcado con ❌ y vuelve a probar.');
process.exit(ok ? 0 : 1);
