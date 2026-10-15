const { app, BrowserWindow, Menu, ipcMain, shell, dialog, net } = require('electron');
const { spawn } = require('child_process');
const crypto = require('crypto');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

/**
 * The desktop app is a window on the business's Syncro server: screens update with the web,
 * and a new release is only needed for what lives here (printing, startup, the menu).
 */

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');
const SETUP_PAGE = path.join(__dirname, 'setup.html');
const UPDATE_EVERY_MS = 60 * 60 * 1000;

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2));
  return next;
}

/** https only, except a server on this same computer while developing. */
function cleanServer(input) {
  try {
    const u = new URL(String(input || '').trim());
    const local = ['localhost', '127.0.0.1'].includes(u.hostname);
    if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return null;
    return u.origin;
  } catch {
    return null;
  }
}

const serverUrl = () => cleanServer(readConfig().serverUrl) || cleanServer(pkg.syncro.defaultServer);
const isServer = (url) => {
  try {
    return new URL(url).origin === serverUrl();
  } catch {
    return false;
  }
};
const isSetup = (url) => url.startsWith('file:') && url.includes('setup.html');

let win;

function showSetup(mode) {
  win.loadFile(SETUP_PAGE, { query: { mode, server: serverUrl() || '' } });
}

// The desktop app goes straight to the login (or the panel when signed in), never the public landing page
const LOGIN_PATH = '/login/';
const isLanding = (url) => {
  try {
    return isServer(url) && new URL(url).pathname === '/';
  } catch {
    return false;
  }
};

function openServer() {
  const url = serverUrl();
  if (!url) return showSetup('server');
  win.loadURL(url + LOGIN_PATH);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    title: 'Syncro POS',
    icon: path.join(__dirname, '../build/icon.png'),
    backgroundColor: '#0b0b0c',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.maximize();
  win.once('ready-to-show', () => win.show());

  // No connection or the server is down: a page to retry or change the server
  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || isSetup(url)) return; // -3: the load was replaced by another
    showSetup('offline');
  });

  // Logging out or a link to the home page lands on the login instead
  const skipLanding = (_e, url) => {
    if (isLanding(url)) win.loadURL(serverUrl() + LOGIN_PATH);
  };
  win.webContents.on('did-navigate', skipLanding);
  win.webContents.on('did-navigate-in-page', skipLanding);

  // Links outside the server open in the browser
  win.webContents.on('will-navigate', (e, url) => {
    if (isServer(url) || isSetup(url)) return;
    e.preventDefault();
    if (/^https?:/.test(url)) shell.openExternal(url);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Print and preview windows that the panel writes itself
    if (url === 'about:blank' || url === '' || isServer(url)) return { action: 'allow' };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  openServer();
}

// ── Printing ────────────────────────────────────────────────────────────────

/** Prints a ticket page: straight to the chosen printer, or with the print dialog if none was chosen. */
async function printHtml(html, paper) {
  const printer = readConfig().printer || '';
  const job = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  try {
    await job.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    // Give the logo a moment so it doesn't print blank
    await new Promise((r) => setTimeout(r, 300));
    return await new Promise((resolve) => {
      job.webContents.print(
        { silent: Boolean(printer), deviceName: printer || undefined, printBackground: true, margins: { marginType: paper === 'a4' ? 'default' : 'none' } },
        (ok, reason) => resolve({ ok, reason: ok ? undefined : reason }),
      );
    });
  } finally {
    job.destroy();
  }
}

ipcMain.handle('print-html', (e, payload) => {
  if (!isServer(e.senderFrame.url)) return { ok: false, reason: 'not-allowed' };
  const html = String(payload?.html || '');
  if (!html || html.length > 5_000_000) return { ok: false, reason: 'invalid' };
  return printHtml(html, payload?.paper);
});

ipcMain.handle('printer-info', async (e) => {
  if (!isServer(e.senderFrame.url)) return null;
  return { printer: readConfig().printer || null };
});

// ── Server setup page ───────────────────────────────────────────────────────

ipcMain.handle('save-server', (e, input) => {
  if (!isSetup(e.senderFrame.url)) return { ok: false };
  const url = cleanServer(input);
  if (!url) return { ok: false, error: 'Escribe una dirección que empiece con https://' };
  writeConfig({ serverUrl: url });
  openServer();
  return { ok: true };
});

ipcMain.handle('retry', (e) => {
  if (!isSetup(e.senderFrame.url)) return;
  openServer();
});

// ── Updates ─────────────────────────────────────────────────────────────────
//
// The panel shows a badge when a new version is ready; "Actualizar" restarts into it.
// Windows uses the standard updater. The Mac app isn't signed with an Apple account, which
// the standard Mac updater requires, so on Mac we download the new app and swap it ourselves.

const isMac = process.platform === 'darwin';
let update = { state: 'idle' }; // idle | downloading | ready | error
let macNewApp = null; // Mac: path of the downloaded app, ready to swap in

const UPDATE_LOG = path.join(app.getPath('userData'), 'update.log');
function logUpdate(line) {
  try {
    fs.appendFileSync(UPDATE_LOG, `${new Date().toISOString()} ${line}\n`);
  } catch {}
}

function setUpdate(next) {
  if (next.state !== update.state || next.version !== update.version) logUpdate(`${next.state} ${next.version || ''} ${next.message || ''}`.trim());
  update = next;
  win?.webContents.send('update-status', update);
  if (next.state === 'ready') win?.webContents.send('update-downloaded', { version: next.version }); // older panels
}

autoUpdater.autoDownload = !isMac;
autoUpdater.autoInstallOnAppQuit = !isMac;

autoUpdater.on('update-available', (info) => {
  if (isMac) downloadMac(info).catch((e) => setUpdate({ state: 'error', version: info.version, message: String(e.message || e) }));
  else setUpdate({ state: 'downloading', version: info.version, percent: 0 });
});
autoUpdater.on('download-progress', (p) => {
  if (update.state === 'downloading') setUpdate({ ...update, percent: Math.round(p.percent) });
});
autoUpdater.on('update-downloaded', (info) => setUpdate({ state: 'ready', version: info.version }));
autoUpdater.on('error', (e) => {
  // No connection or no release yet: try again on the next check
  logUpdate(`error ${e?.message || e}`);
  if (update.state === 'downloading') setUpdate({ state: 'error', version: update.version, message: String(e?.message || e) });
});

/** Mac: downloads this computer's zip from the release, checks it and unpacks the new app. */
async function downloadMac(info) {
  if (update.state === 'downloading' || (update.state === 'ready' && update.version === info.version)) return;
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const file = (info.files || []).find((f) => f.url.endsWith(`-${arch}.zip`));
  if (!file) throw new Error('El release no trae la app para esta Mac');
  // The packaged package.json loses its "build" section, so the repo lives under "syncro"
  const { owner, repo } = pkg.syncro.releases;
  const url = `https://github.com/${owner}/${repo}/releases/download/v${info.version}/${file.url}`;

  setUpdate({ state: 'downloading', version: info.version, percent: 0 });
  const dir = fs.mkdtempSync(path.join(app.getPath('temp'), 'syncro-update-'));
  const zip = path.join(dir, 'update.zip');
  const res = await net.fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar (${res.status})`);
  const total = Number(res.headers.get('content-length')) || file.size || 0;
  const hash = crypto.createHash('sha512');
  const out = fs.createWriteStream(zip);
  const reader = res.body.getReader();
  let got = 0;
  let lastPercent = -1;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    hash.update(value);
    if (!out.write(value)) await new Promise((r) => out.once('drain', r));
    got += value.length;
    const percent = total ? Math.floor((got / total) * 100) : 0;
    if (percent !== lastPercent) {
      lastPercent = percent;
      setUpdate({ state: 'downloading', version: info.version, percent });
    }
  }
  await new Promise((r, j) => out.end((e) => (e ? j(e) : r())));
  if (file.sha512 && hash.digest('base64') !== file.sha512) throw new Error('La descarga llegó incompleta');

  await run('/usr/bin/ditto', ['-x', '-k', zip, dir]);
  const newApp = fs.readdirSync(dir).find((n) => n.endsWith('.app'));
  if (!newApp) throw new Error('La descarga no trae la app');
  macNewApp = path.join(dir, newApp);
  setUpdate({ state: 'ready', version: info.version });
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'ignore' });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} terminó con ${code}`))));
  });
}

/** Mac: once this app closes, a small script swaps in the new one and opens it. */
function installMac() {
  const current = path.resolve(app.getPath('exe'), '..', '..', '..');
  try {
    fs.accessSync(path.dirname(current), fs.constants.W_OK);
  } catch {
    dialog.showMessageBox(win, { type: 'warning', message: 'No se puede actualizar desde aquí', detail: 'Mueve Syncro POS a la carpeta Aplicaciones y ábrela desde ahí.' });
    return;
  }
  const script = [
    'while kill -0 "$OLD_PID" 2>/dev/null; do sleep 0.3; done',
    'rm -rf "$APP.old"',
    'if mv "$APP" "$APP.old" && /usr/bin/ditto "$NEW" "$APP"; then rm -rf "$APP.old"; else rm -rf "$APP"; mv "$APP.old" "$APP"; fi',
    '/usr/bin/xattr -cr "$APP"',
    '/usr/bin/open "$APP"',
  ].join('\n');
  spawn('/bin/sh', ['-c', script], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, OLD_PID: String(process.pid), APP: current, NEW: macNewApp },
  }).unref();
  app.quit();
}

function installUpdate() {
  if (update.state !== 'ready') return;
  if (isMac) installMac();
  else autoUpdater.quitAndInstall(true, true); // silent, and open the app again afterwards
}

ipcMain.on('install-update', (e) => {
  if (isServer(e.senderFrame.url)) installUpdate();
});
ipcMain.handle('update-status', (e) => (isServer(e.senderFrame.url) ? { ...update, current: app.getVersion() } : null));
ipcMain.on('check-updates', (e) => {
  if (isServer(e.senderFrame.url)) checkUpdates(false);
});

function checkUpdates(manual) {
  if (!app.isPackaged) return;
  if (manual && update.state === 'ready') {
    dialog.showMessageBox(win, { message: `La versión ${update.version} está lista.`, buttons: ['Actualizar ahora', 'Después'], defaultId: 0 }).then((r) => r.response === 0 && installUpdate());
    return;
  }
  autoUpdater
    .checkForUpdates()
    .then((r) => {
      if (manual && (!r || !r.isUpdateAvailable)) dialog.showMessageBox(win, { message: `Tienes la versión más reciente (${app.getVersion()}).` });
    })
    .catch(() => manual && dialog.showMessageBox(win, { type: 'warning', message: 'No se pudo buscar actualizaciones. Revisa la conexión.' }));
}

// ── Menu ────────────────────────────────────────────────────────────────────

async function buildMenu() {
  const printers = win ? await win.webContents.getPrintersAsync().catch(() => []) : [];
  const current = readConfig().printer || '';
  const choosePrinter = (name) => {
    writeConfig({ printer: name });
    buildMenu();
  };

  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    {
      label: 'Syncro',
      submenu: [
        { label: 'Cambiar servidor…', click: () => showSetup('server') },
        {
          label: 'Impresora de tickets',
          submenu: [
            { label: 'Preguntar cada vez', type: 'radio', checked: !current, click: () => choosePrinter('') },
            { type: 'separator' },
            ...(printers.length
              ? printers.map((p) => ({ label: p.displayName || p.name, type: 'radio', checked: current === p.name, click: () => choosePrinter(p.name) }))
              : [{ label: 'No hay impresoras instaladas', enabled: false }]),
            { type: 'separator' },
            { label: 'Volver a buscar impresoras', click: () => buildMenu() },
          ],
        },
        {
          label: 'Abrir al encender la computadora',
          type: 'checkbox',
          checked: app.getLoginItemSettings().openAtLogin,
          click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
        },
        { type: 'separator' },
        { label: 'Buscar actualizaciones', click: () => checkUpdates(true) },
        { label: `Versión ${app.getVersion()}`, enabled: false },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' },
      ],
    },
    { role: 'editMenu', label: 'Editar' },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'resetZoom', label: 'Tamaño normal' },
        { role: 'zoomIn', label: 'Más grande' },
        { role: 'zoomOut', label: 'Más pequeño' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
        { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Start ───────────────────────────────────────────────────────────────────

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    createWindow();
    buildMenu();
    checkUpdates(false);
    setInterval(() => checkUpdates(false), UPDATE_EVERY_MS);
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
