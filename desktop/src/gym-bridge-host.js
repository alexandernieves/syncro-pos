const { app, ipcMain, powerSaveBlocker, safeStorage, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

/**
 * The gym's face reader bridge, running inside the desktop app on the reception computer.
 * Replaces the separate service (and `caffeinate`): it starts with the computer, keeps the
 * computer from suspending the app while it runs, and keeps going with the window closed.
 *
 * The reader's password and Syncro key are stored encrypted with the system's keychain.
 */

const FILE = () => path.join(app.getPath('userData'), 'gym-bridge.json');
const STATE = () => path.join(app.getPath('userData'), 'gym-bridge-state.json');
const KEY_RE = /^gymk_[0-9a-f]{8}_[A-Za-z0-9_-]{20,}$/;

/** Packaged: copied next to this file. Developing: straight from the gym-bridge folder. */
function corePath() {
  const packaged = path.join(__dirname, 'gym-bridge', 'core.js');
  return fs.existsSync(packaged) ? packaged : path.join(__dirname, '..', '..', 'gym-bridge', 'src', 'core.js');
}
let corePromise = null;
const core = () => (corePromise ??= import(pathToFileURL(corePath()).href));

function seal(text) {
  if (!text) return null;
  if (safeStorage.isEncryptionAvailable()) return { enc: true, v: safeStorage.encryptString(text).toString('base64') };
  return { enc: false, v: Buffer.from(text, 'utf8').toString('base64') };
}
function unseal(box) {
  if (!box?.v) return '';
  try {
    return box.enc ? safeStorage.decryptString(Buffer.from(box.v, 'base64')) : Buffer.from(box.v, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function read() {
  try {
    return JSON.parse(fs.readFileSync(FILE(), 'utf8'));
  } catch {
    return {};
  }
}
function write(next) {
  fs.mkdirSync(path.dirname(FILE()), { recursive: true });
  fs.writeFileSync(FILE(), JSON.stringify(next, null, 2), { mode: 0o600 });
}

/** "192.168.1.50", "192.168.1.50:8080" or a full http(s) address → http://192.168.1.50 */
function cleanHost(input) {
  let s = String(input || '').trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  try {
    const u = new URL(s);
    if (!u.hostname || u.username || u.password) return null;
    return u.origin;
  } catch {
    return null;
  }
}
function cleanSyncro(input) {
  try {
    const u = new URL(String(input || '').trim());
    const local = ['localhost', '127.0.0.1'].includes(u.hostname);
    if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return null;
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

let bridge = null;
let blocker = null;
let lastStatus = null;
let logs = [];
const listeners = new Set();

function publicState() {
  const c = read();
  return {
    available: true,
    configured: !!(c.deviceId && c.key),
    enabled: !!c.enabled,
    running: !!bridge?.running,
    deviceId: c.deviceId ?? null,
    deviceName: c.deviceName ?? null,
    host: c.host ?? '',
    user: c.user ?? '',
    doorNo: c.doorNo ?? 1,
    hasPass: !!c.pass,
    startsWithComputer: app.getLoginItemSettings().openAtLogin,
    status: lastStatus,
    log: logs.slice(-60),
    appVersion: app.getVersion(),
  };
}

let pending = null;
function broadcast() {
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    const s = publicState();
    for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('gym-bridge:status', s);
    for (const l of listeners) l(s);
  }, 300);
}

function stop() {
  bridge?.stop();
  bridge = null;
  if (blocker !== null && powerSaveBlocker.isStarted(blocker)) powerSaveBlocker.stop(blocker);
  blocker = null;
}

async function start() {
  stop();
  const c = read();
  if (!c.enabled || !c.key) return broadcast();
  const key = unseal(c.key);
  if (!KEY_RE.test(key)) {
    logs.push(`${new Date().toISOString()} No se pudo leer la clave guardada del lector. Vuelve a conectarlo desde Syncro.`);
    return broadcast();
  }
  const { createBridge } = await core();
  lastStatus = null;
  bridge = createBridge(
    { syncroUrl: c.syncroUrl, deviceKey: key, host: c.host, user: c.user, pass: unseal(c.pass), doorNo: c.doorNo, stateFile: STATE(), version: `app ${app.getVersion()}` },
    {
      log: (line) => {
        logs.push(line);
        if (logs.length > 200) logs = logs.slice(-200);
        broadcast();
      },
      onStatus: (s) => {
        lastStatus = s;
        broadcast();
      },
    },
  );
  bridge.start();
  // Like `caffeinate -i`: the computer may turn off the screen, but must not suspend the app
  blocker = powerSaveBlocker.start('prevent-app-suspension');
  broadcast();
}

function init(isServer) {
  const guard = (e) => isServer(e.senderFrame?.url || '');

  ipcMain.handle('gym-bridge:get', (e) => (guard(e) ? publicState() : null));

  /** Checks the reader with what was typed (an empty password uses the saved one). */
  ipcMain.handle('gym-bridge:test', async (e, input) => {
    if (!guard(e)) return null;
    const c = read();
    const host = cleanHost(input?.host);
    if (!host) return { ok: false, steps: [{ label: 'Dirección del lector', ok: false, detail: 'escribe la IP del lector, por ejemplo 192.168.1.50' }] };
    const pass = String(input?.pass || '') || (host === c.host ? unseal(c.pass) : '');
    const { checkConnection } = await core();
    const steps = await checkConnection({ host, user: String(input?.user || 'admin').slice(0, 64), pass });
    return { ok: steps.every((s) => s.ok), steps };
  });

  /** Saves the reader's data and turns the bridge on. The key comes from Syncro, never typed. */
  ipcMain.handle('gym-bridge:save', async (e, input) => {
    if (!guard(e)) return { ok: false, error: 'No permitido' };
    const c = read();
    const host = cleanHost(input?.host);
    const syncroUrl = cleanSyncro(input?.syncroUrl);
    const user = String(input?.user || '').trim().slice(0, 64);
    const key = String(input?.key || '');
    const deviceId = String(input?.deviceId || '');
    if (!host) return { ok: false, error: 'Escribe la IP del lector' };
    if (!syncroUrl) return { ok: false, error: 'Dirección de Syncro no válida' };
    if (!user) return { ok: false, error: 'Escribe el usuario del lector' };
    if (!deviceId) return { ok: false, error: 'Elige el lector' };
    if (key && !KEY_RE.test(key)) return { ok: false, error: 'Clave del lector no válida' };
    const sameDevice = c.deviceId === deviceId;
    if (!key && !(sameDevice && c.key)) return { ok: false, error: 'Falta la clave del lector' };
    const pass = String(input?.pass || '');
    if (!pass && !(c.pass && c.host === host)) return { ok: false, error: 'Escribe la clave del lector' };

    // Another reader (or another address): what was loaded before no longer applies
    if (!sameDevice || c.host !== host) fs.rmSync(STATE(), { force: true });
    const login = app.getLoginItemSettings().openAtLogin;
    write({
      ...c,
      enabled: true,
      deviceId,
      deviceName: String(input?.deviceName || '').slice(0, 80) || c.deviceName || 'Lector',
      syncroUrl,
      host,
      user,
      doorNo: Math.max(1, Math.round(Number(input?.doorNo) || 1)),
      key: key ? seal(key) : c.key,
      pass: pass ? seal(pass) : c.pass,
      // Starts with the computer; remember whether it was us who turned that on
      loginByBridge: c.loginByBridge || !login,
    });
    if (!login) app.setLoginItemSettings({ openAtLogin: true });
    logs = [];
    await start();
    return { ok: true, state: publicState() };
  });

  ipcMain.handle('gym-bridge:stop', (e) => {
    if (!guard(e)) return null;
    const c = read();
    write({ ...c, enabled: false, loginByBridge: false });
    if (c.loginByBridge) app.setLoginItemSettings({ openAtLogin: false });
    stop();
    logs.push(`${new Date().toISOString()} Puente apagado en esta computadora`);
    broadcast();
    return publicState();
  });

  ipcMain.handle('gym-bridge:resume', async (e) => {
    if (!guard(e)) return null;
    const c = read();
    if (!c.deviceId || !c.key) return publicState();
    write({ ...c, enabled: true });
    if (!app.getLoginItemSettings().openAtLogin) {
      app.setLoginItemSettings({ openAtLogin: true });
      write({ ...read(), loginByBridge: true });
    }
    await start();
    return publicState();
  });

  // It was on when the app closed: on again
  if (read().enabled) start().catch((err) => logs.push(`${new Date().toISOString()} No se pudo iniciar el puente: ${err.message}`));
}

function label() {
  if (!bridge?.running) return 'Lector facial: apagado';
  if (!lastStatus) return 'Lector facial: conectando…';
  if (!lastStatus.syncroOnline) return 'Lector facial: sin conexión con Syncro';
  return lastStatus.deviceOnline ? 'Lector facial: conectado' : 'Lector facial: no responde';
}

module.exports = {
  init,
  running: () => !!bridge?.running,
  label,
  onChange: (fn) => listeners.add(fn),
  stop,
};
