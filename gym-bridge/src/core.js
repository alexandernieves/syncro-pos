// Syncro gym bridge core: keeps the Hikvision face reader in sync with Syncro and reports every entry.
// Used by the command-line service (bridge.js, on a Linux server) and by the Syncro desktop app.
// Only makes outgoing connections (to Syncro and to the reader).
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Isapi } from './isapi.js';

export const VERSION = '1.1.0';

/**
 * @param {object} c
 * @param {string} c.syncroUrl   Syncro API, e.g. https://syncro.example.com/api
 * @param {string} c.deviceKey   the reader's key (gymk_…)
 * @param {string} c.host        the reader on the local network, e.g. http://192.168.1.50
 * @param {string} c.user
 * @param {string} c.pass
 * @param {string} c.stateFile   where to remember what is already on the reader
 * @param {(line: string) => void} [hooks.log]
 * @param {(status: object) => void} [hooks.onStatus]
 */
export function createBridge(c, hooks = {}) {
  const CFG = {
    syncro: String(c.syncroUrl).replace(/\/$/, ''),
    key: c.deviceKey,
    library: String(c.library ?? '1'),
    eventPoll: Number(c.eventPollSeconds ?? 2) * 1000,
    rosterEvery: Number(c.rosterSyncSeconds ?? 60) * 1000,
    pass: (c.passMinors ?? [1, 38, 75]).map(Number),
    fail: (c.failMinors ?? [6, 9, 10, 21, 76]).map(Number),
    stateFile: c.stateFile,
  };
  const device = new Isapi({ host: c.host, user: c.user, pass: c.pass });
  const log = (...a) => {
    const line = `${new Date().toISOString()} ${a.join(' ')}`;
    (hooks.log ?? console.log)(line);
  };

  // ── State (survives restarts) ──────────────────────────────────────────────
  let state = { members: {}, lastEventTime: null, seen: [] };
  try { state = { ...state, ...JSON.parse(readFileSync(CFG.stateFile, 'utf8')) }; } catch {}
  const save = () => {
    mkdirSync(dirname(CFG.stateFile), { recursive: true });
    writeFileSync(CFG.stateFile + '.tmp', JSON.stringify(state));
    renameSync(CFG.stateFile + '.tmp', CFG.stateFile);
  };

  const status = { bridgeVersion: c.version ? `${VERSION} · ${c.version}` : VERSION, deviceOnline: false, device: null, usersOnDevice: null, lastError: null, lastRosterSync: null, lastEventAt: null, pendingEvents: 0, syncroOnline: false };
  const emit = () => hooks.onStatus?.({ ...status });
  let server = { mode: 'VALIDITY', doorNo: Number(c.doorNo ?? 1), timeZone: 'America/Caracas' };

  // ── Syncro API ─────────────────────────────────────────────────────────────
  async function syncro(method, path, body) {
    const res = await fetch(`${CFG.syncro}/gym/bridge${path}`, {
      method,
      headers: { 'x-device-key': CFG.key, ...(body && { 'Content-Type': 'application/json' }) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Syncro rechazó la clave del lector. Vuelve a conectar el lector desde Syncro');
    if (!res.ok) throw new Error(`Syncro ${path} → ${res.status} ${data.message || ''}`);
    return data;
  }

  // ── Photos: the reader wants a JPEG under 200 KB ───────────────────────────
  // Syncro hands it over already converted; an older server only gives the original link.
  let sharp;
  async function facePhoto(m) {
    const res = await fetch(`${CFG.syncro}/gym/bridge/photo/${encodeURIComponent(m.memberId)}`, { headers: { 'x-device-key': CFG.key }, signal: AbortSignal.timeout(30000) });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const data = await res.json().catch(() => ({}));
    // "Cannot GET": a server from before this route existed
    if (!(res.status === 404 && String(data.message || '').includes('Cannot GET'))) throw new Error(data.message || `No se pudo obtener la foto (${res.status})`);
    const raw = await fetch(m.photoUrl, { signal: AbortSignal.timeout(20000) });
    if (!raw.ok) throw new Error('No se pudo descargar la foto del socio');
    let buf = Buffer.from(await raw.arrayBuffer());
    if (sharp === undefined) sharp = await import('sharp').then((x) => x.default).catch(() => null);
    if (sharp) {
      buf = await sharp(buf).rotate().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      if (buf.length > 200_000) buf = await sharp(buf).jpeg({ quality: 65 }).toBuffer();
    } else if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf.length > 200_000) {
      throw new Error('La foto debe ser JPEG de menos de 200 KB (actualiza Syncro para convertirla sola)');
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

  // ── Roster sync: Syncro → reader ───────────────────────────────────────────
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
        if (!running) break;
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
              await device.setupFace(m.employeeNo, await facePhoto(m), CFG.library);
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
      if (!running) return;
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
      emit();
    } finally {
      syncing = false;
    }
  }

  // ── Events: reader → Syncro ────────────────────────────────────────────────
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
      status.lastEventAt = new Date().toISOString();
      save();
      emit();
    } finally {
      polling = false;
    }
  }

  // ── Heartbeat and orders from Syncro ───────────────────────────────────────
  async function heartbeat() {
    try {
      status.device = status.device || (await device.deviceInfo());
      status.deviceOnline = true;
    } catch (e) {
      status.deviceOnline = false;
      status.lastError = `Lector sin respuesta: ${e.message}`;
    }
    try {
      const r = await syncro('POST', '/heartbeat', { status });
      status.syncroOnline = true;
      server = { ...server, mode: r.mode, doorNo: r.doorNo, timeZone: r.timeZone };
      for (const cmd of r.commands || []) {
        if (cmd.type === 'OPEN_DOOR') {
          await device.openDoor(server.doorNo).then(() => log('Puerta abierta desde Syncro')).catch((e) => log('No se pudo abrir la puerta:', e.message));
        }
        if (cmd.type === 'RESYNC') {
          log('Syncro pidió volver a cargar todo el padrón');
          await syncRoster(true).catch((e) => log('Error al sincronizar:', e.message));
        }
      }
    } catch (e) {
      status.syncroOnline = false;
      throw e;
    } finally {
      emit();
    }
  }

  // ── Loop ───────────────────────────────────────────────────────────────────
  let running = false;
  const timers = new Set();
  function every(ms, fn, name) {
    const run = async () => {
      if (!running) return;
      try {
        await fn();
        if (status.lastError?.startsWith(name)) status.lastError = null;
      } catch (e) {
        status.lastError = `${name}: ${e.message}`;
        log(`${name}:`, e.message);
        emit();
      }
      if (!running) return;
      const t = setTimeout(() => { timers.delete(t); run(); }, ms);
      timers.add(t);
    };
    run();
  }

  return {
    get running() { return running; },
    get status() { return { ...status }; },
    start() {
      if (running) return;
      running = true;
      log(`Puente ${status.bridgeVersion} · Syncro ${CFG.syncro} · lector ${c.host}`);
      every(5000, heartbeat, 'Conexión');
      every(CFG.rosterEvery, () => syncRoster(false), 'Padrón');
      every(CFG.eventPoll, pollEvents, 'Eventos');
    },
    stop() {
      running = false;
      for (const t of timers) clearTimeout(t);
      timers.clear();
      log('Puente detenido');
    },
  };
}

/**
 * Checks the reader (and Syncro, when there is a key) before turning the bridge on.
 * Returns one line per step: { label, ok, detail }.
 */
export async function checkConnection({ syncroUrl, deviceKey, host, user, pass }) {
  const device = new Isapi({ host, user, pass });
  const steps = [];
  const step = async (label, fn) => {
    try { steps.push({ label, ok: true, detail: (await fn()) || '' }); } catch (e) { steps.push({ label, ok: false, detail: friendly(e) }); }
  };
  await step('El lector responde', async () => { const i = await device.deviceInfo(); return `${i.model} · serie ${i.serialNumber}`; });
  if (steps[0].ok) {
    await step('Usuario y clave del lector', async () => `${await device.userCount()} personas cargadas`);
    await step('Lectura de entradas', async () => {
      const end = new Date(), start = new Date(end.getTime() - 3600_000);
      const iso = (d) => d.toISOString().slice(0, 19) + '+00:00';
      const r = await device.searchEvents(iso(start), iso(end));
      return `${r.items.length} en la última hora`;
    });
  }
  if (syncroUrl && deviceKey) {
    await step('Conexión con Syncro', async () => {
      const res = await fetch(`${String(syncroUrl).replace(/\/$/, '')}/gym/bridge/heartbeat`, { method: 'POST', headers: { 'x-device-key': deviceKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: { check: true } }), signal: AbortSignal.timeout(15000) });
      if (res.status === 401) throw new Error('la clave del lector no es válida');
      if (!res.ok) throw new Error(`respondió ${res.status}`);
      const r = await res.json();
      return `modo ${r.mode === 'STRICT' ? 'estricto' : 'por fechas'}`;
    });
  }
  return steps;
}

function friendly(e) {
  const msg = String(e?.message || e);
  if (/401|Unauthorized/i.test(msg)) return 'el usuario o la clave del lector no son correctos';
  if (/timeout|aborted|ETIMEDOUT/i.test(msg)) return 'no contesta: revisa la IP y que esté en la misma red';
  if (/ECONNREFUSED/i.test(msg)) return 'rechazó la conexión: revisa la IP y que ISAPI esté activo';
  if (/EHOSTUNREACH|ENETUNREACH|ENOTFOUND/i.test(msg)) return 'no se encuentra en la red: revisa la IP';
  return msg.slice(0, 160);
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
