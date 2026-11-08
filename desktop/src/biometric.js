const { app, ipcMain, safeStorage, systemPreferences } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Sign in with Touch ID from a saved profile (Syncro desktop on Mac).
 *
 * macOS checks the fingerprint (Syncro never sees it). Only after it says yes does the app hand
 * the page the pass Syncro gave this computer for that profile. The pass is kept encrypted with
 * the Mac's keychain, one per profile (email).
 */

const FILE = () => path.join(app.getPath('userData'), 'biometric.json');

function read() {
  try {
    return JSON.parse(fs.readFileSync(FILE(), 'utf8'));
  } catch {
    return {};
  }
}
function write(data) {
  fs.mkdirSync(path.dirname(FILE()), { recursive: true });
  fs.writeFileSync(FILE(), JSON.stringify(data, null, 2), { mode: 0o600 });
}
const key = (email) => String(email || '').trim().toLowerCase();

function touchIdReady() {
  try {
    return process.platform === 'darwin' && systemPreferences.canPromptTouchID() && safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

async function askFingerprint(reason) {
  try {
    await systemPreferences.promptTouchID(String(reason || 'entrar a Syncro').slice(0, 120));
    return true;
  } catch {
    return false;
  }
}

function init(isServer) {
  const ok = (e) => isServer(e.senderFrame?.url || '');

  ipcMain.handle('bio:info', (e) => {
    if (!ok(e)) return null;
    return { touchId: touchIdReady(), deviceName: os.hostname().replace(/\.local$/, ''), platform: process.platform };
  });

  ipcMain.handle('bio:has', (e, email) => (ok(e) ? !!read()[key(email)] : false));

  /** Asks for the fingerprint (to turn it on, or to confirm something). */
  ipcMain.handle('bio:verify', async (e, reason) => (ok(e) && touchIdReady() ? askFingerprint(reason) : false));

  /** Keeps the pass for this profile, encrypted with the keychain. */
  ipcMain.handle('bio:store', (e, input) => {
    if (!ok(e) || !touchIdReady()) return false;
    const email = key(input?.email);
    if (!email || typeof input?.id !== 'string' || typeof input?.secret !== 'string') return false;
    const all = read();
    all[email] = { id: input.id, secret: safeStorage.encryptString(input.secret).toString('base64'), at: new Date().toISOString() };
    write(all);
    return true;
  });

  /** Fingerprint first; only then the pass comes out. */
  ipcMain.handle('bio:unlock', async (e, input) => {
    if (!ok(e) || !touchIdReady()) return null;
    const saved = read()[key(input?.email)];
    if (!saved) return null;
    if (!(await askFingerprint(input?.reason || 'entrar a Syncro'))) return { cancelled: true };
    try {
      return { id: saved.id, secret: safeStorage.decryptString(Buffer.from(saved.secret, 'base64')) };
    } catch {
      return null;
    }
  });

  ipcMain.handle('bio:remove', (e, email) => {
    if (!ok(e)) return false;
    const all = read();
    delete all[key(email)];
    write(all);
    return true;
  });
}

module.exports = { init };
