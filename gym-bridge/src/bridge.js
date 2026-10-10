// Syncro gym bridge: keeps the Hikvision face reader in sync with Syncro and reports every entry.
// Runs on the gym's local server. Only makes outgoing connections (to Syncro and to the reader).
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { Isapi } from './isapi.js';

// ── Config ───────────────────────────────────────────────────────────────────

function loadEnv(file = new URL('../.env', import.meta.url)) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();
const env = (k, d) => process.env[k] ?? d;
const required = ['SYNCRO_URL', 'DEVICE_KEY', 'DEVICE_HOST', 'DEVICE_USER', 'DEVICE_PASS'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Faltan variables en .env: ${missing.join(', ')}`);
  process.exit(1);
}
const CFG = {
  syncro: env('SYNCRO_URL').replace(/\/$/, ''),
  key: env('DEVICE_KEY'),
  library: env('FACE_LIBRARY', '1'),
  eventPoll: Number(env('EVENT_POLL_SECONDS', 2)) * 1000,
  rosterEvery: Number(env('ROSTER_SYNC_SECONDS', 60)) * 1000,
  pass: env('PASS_MINORS', '1,38,75').split(',').map(Number),
  fail: env('FAIL_MINORS', '6,9,10,21,76').split(',').map(Number),
  stateFile: env('STATE_FILE', new URL('../state.json', import.meta.url).pathname),
};
const device = new Isapi({ host: env('DEVICE_HOST'), user: env('DEVICE_USER'), pass: env('DEVICE_PASS') });
const VERSION = '1.0.0';

// ── State (survives restarts) ────────────────────────────────────────────────

let state = { members: {}, lastEventTime: null, seen: [] };
try { state = { ...state, ...JSON.parse(readFileSync(CFG.stateFile, 'utf8')) }; } catch {}
const save = () => { writeFileSync(CFG.stateFile + '.tmp', JSON.stringify(state)); renameSync(CFG.stateFile + '.tmp', CFG.stateFile); };

const log = (...a) => console.log(new Date().toISOString(), ...a);
const status = { bridgeVersion: VERSION, deviceOnline: false, device: null, usersOnDevice: null, lastError: null, lastRosterSync: null, pendingEvents: 0 };
let server = { mode: 'VALIDITY', doorNo: Number(env('DOOR_NO', 1)), timeZone: 'America/Caracas' };

// ── Syncro API ───────────────────────────────────────────────────────────────

async function syncro(method, path, body) {
  const res = await fetch(`${CFG.syncro}/gym/bridge${path}`, {
    method,
    headers: { 'x-device-key': CFG.key, ...(body && { 'Content-Type': 'application/json' }) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('Syncro rechazó la clave del lector (DEVICE_KEY). Genera una nueva en Syncro');
  if (!res.ok) throw new Error(`Syncro ${path} → ${res.status} ${data.message || ''}`);
  return data;
}

// ── Time helpers (the reader works in the gym's local time) ─────────────────

function offset(date, timeZone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}
function localIso(date, timeZone) {
  const off = offset(date, timeZone);
  const d = new Date(date.getTime() + off * 60000);
  const sign = off >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0');
  const mm = String(Math.abs(off) % 60).padStart(2, '0');
  return `${d.toISOString().slice(0, 19)}${sign}${hh}:${mm}`;
}

// ── Photos: the reader wants a JPEG under 200 KB ────────────────────────────

let sharp = null;
try { sharp = (await import('sharp')).default; } catch { log('Aviso: sharp no está instalado; solo se cargarán fotos JPEG pequeñas'); }

async function facePhoto(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error('No se pudo descargar la foto del socio');
  let buf = Buffer.from(await res.arrayBuffer());
  if (sharp) {
    buf = await sharp(buf).rotate().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    if (buf.length > 200_000) buf = await sharp(buf).jpeg({ quality: 65 }).toBuffer();
  } else if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf.length > 200_000) {
    throw new Error('La foto debe ser JPEG de menos de 200 KB (instala sharp para convertirla)');
  }
  return buf;
}

const deviceError = (e) => {
  const sub = e?.data?.subStatusCode || '';
  if (/faceNotDetected|noFace|face.*fail/i.test(sub)) return 'El lector no encontró una cara en la foto. Toma una foto de frente, con buena luz';
  if (/multipleFace/i.test(sub)) return 'La foto tiene más de una cara';
  if (/lowScore|quality/i.test(sub)) return 'La foto tiene poca calidad para el reconocimiento';
  return String(e.message || e).slice(0, 180);
};

// ── Roster sync: Syncro → reader ────────────────────────────────────────────

let syncing = false;
async function syncRoster(force = false) {
  if (syncing) return;
  syncing = true;
  try {
    const roster = await syncro('GET', '/roster');
    server.mode = roster.mode;
    server.timeZone = roster.timeZone;
    const results = [];
    const seenNow = new Set();
    let changed = 0;
    for (const m of roster.members) {
      seenNow.add(m.employeeNo);
      const prev = state.members[m.employeeNo];
      // The hash includes the photo: a rejected face is retried only when the photo changes
      if (!force && prev?.hash === m.hash) continue;
      try {
        await device.setupUser(m, server.doorNo);
        let face = 'skipped';
        let error;
        if (m.photoUrl && (force || prev?.photoUrl !== m.photoUrl || prev?.face !== 'ok')) {
          try {
            await device.setupFace(m.employeeNo, await facePhoto(m.photoUrl), CFG.library);
            face = 'ok';
          } catch (e) {
            face = 'error';
            error = deviceError(e);
          }
        } else if (m.photoUrl && prev?.face === 'ok') face = 'ok';
        state.members[m.employeeNo] = { hash: m.hash, photoUrl: m.photoUrl, face, memberId: m.memberId };
        results.push({ memberId: m.memberId, face, error });
        changed++;
      } catch (e) {
        results.push({ memberId: m.memberId, face: 'error', error: `No se pudo cargar a la persona: ${deviceError(e)}` });
      }
    }
    // People removed from Syncro leave the reader too
    const gone = Object.keys(state.members).filter((no) => !seenNow.has(no));
    if (gone.length) {
      try { await device.deleteUsers(gone); } catch (e) { log('No se pudieron borrar del lector:', gone.join(', '), e.message); }
      for (const no of gone) delete state.members[no];
    }
    save();
    if (results.length) await syncro('POST', '/roster/result', { results });
    status.lastRosterSync = new Date().toISOString();
    status.usersOnDevice = await device.userCount().catch(() => status.usersOnDevice);
    if (changed || gone.length) log(`Padrón: ${changed} actualizados, ${gone.length} eliminados (${roster.members.length} en total)`);
  } finally {
    syncing = false;
  }
}

// ── Events: reader → Syncro ─────────────────────────────────────────────────

let polling = false;
async function pollEvents() {
  if (polling) return;
  polling = true;
  try {
    const now = new Date();
    const since = state.lastEventTime ? new Date(new Date(state.lastEventTime).getTime() - 1000) : new Date(now.getTime() - 60_000);
    const items = [];
    for (let pos = 0, more = true; more && pos < 300; pos += 30) {
      const page = await device.searchEvents(localIso(since, server.timeZone), localIso(new Date(now.getTime() + 60_000), server.timeZone), pos);
      items.push(...page.items);
      more = page.more;
    }
    const seen = new Set(state.seen);
    const fresh = items
      .filter((e) => e.serialNo != null && !seen.has(String(e.serialNo)) && (CFG.pass.includes(e.minor) || CFG.fail.includes(e.minor)))
      .map((e) => ({ serialNo: String(e.serialNo), employeeNo: e.employeeNoString || null, time: new Date(e.time).toISOString(), minor: e.minor, granted: CFG.pass.includes(e.minor) }));
    if (!fresh.length) return;
    status.pendingEvents = fresh.length;
    const r = await syncro('POST', '/events', { events: fresh });
    // Strict mode: Syncro said yes where the reader said no → open the door
    for (const serial of r.open || []) {
      try { await device.openDoor(server.doorNo); log(`Puerta abierta por Syncro (evento ${serial})`); } catch (e) { log('No se pudo abrir la puerta:', e.message); }
    }
    for (const x of r.results || []) log(`Entrada ${x.granted ? 'permitida' : 'negada'} · ${x.reason}`);
    for (const e of fresh) seen.add(e.serialNo);
    state.seen = [...seen].slice(-500);
    state.lastEventTime = fresh.map((e) => e.time).sort().pop();
    status.pendingEvents = 0;
    save();
  } finally {
    polling = false;
  }
}

// ── Heartbeat and orders from Syncro ────────────────────────────────────────

async function heartbeat() {
  try {
    status.device = status.device || (await device.deviceInfo());
    status.deviceOnline = true;
  } catch (e) {
    status.deviceOnline = false;
    status.lastError = `Lector sin respuesta: ${e.message}`;
  }
  const r = await syncro('POST', '/heartbeat', { status });
  server = { ...server, mode: r.mode, doorNo: r.doorNo, timeZone: r.timeZone };
  for (const c of r.commands || []) {
    if (c.type === 'OPEN_DOOR') {
      await device.openDoor(server.doorNo).then(() => log('Puerta abierta desde Syncro')).catch((e) => log('No se pudo abrir la puerta:', e.message));
    }
    if (c.type === 'RESYNC') {
      log('Syncro pidió volver a cargar todo el padrón');
      await syncRoster(true).catch((e) => log('Error al sincronizar:', e.message));
    }
  }
}

function every(ms, fn, name) {
  const run = async () => {
    try {
      await fn();
      if (status.lastError?.startsWith(name)) status.lastError = null;
    } catch (e) {
      status.lastError = `${name}: ${e.message}`;
      log(`${name}:`, e.message);
    }
    setTimeout(run, ms);
  };
  run();
}

log(`Syncro gym bridge ${VERSION} · Syncro ${CFG.syncro} · lector ${env('DEVICE_HOST')}`);
every(5000, heartbeat, 'Heartbeat');
every(CFG.rosterEvery, () => syncRoster(false), 'Padrón');
every(CFG.eventPoll, pollEvents, 'Eventos');
