const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
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
const UPDATE_EVERY_MS = 6 * 60 * 60 * 1000;

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

function openServer() {
  const url = serverUrl();
  if (!url) return showSetup('server');
  win.loadURL(url);
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

autoUpdater.on('update-downloaded', (info) => win?.webContents.send('update-downloaded', info));
autoUpdater.on('error', () => {}); // No connection or no release yet: try again later

ipcMain.on('install-update', (e) => {
  if (isServer(e.senderFrame.url)) autoUpdater.quitAndInstall();
});

function checkUpdates(manual) {
  if (!app.isPackaged) return;
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
