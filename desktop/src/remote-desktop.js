/**
 * Remote assistance over the WHOLE computer (like AnyDesk), only after the person accepts it on
 * their screen, and only while the session lasts:
 *
 *  - the screen share returns the main screen instead of Syncro's window;
 *  - the Syncro team's mouse and keys move the real pointer and type in any app, through a helper
 *    that ships with the operating system (no extra install): JavaScript for Automation on macOS
 *    (CoreGraphics + System Events), PowerShell with user32 on Windows;
 *  - a small always-on-top bar says "Syncro está controlando tu computadora" with Detener, even
 *    when Syncro's window is hidden or behind other apps.
 *
 * macOS asks once for Grabación de pantalla and Accesibilidad for Syncro POS.
 */
const { BrowserWindow, desktopCapturer, ipcMain, screen, shell, systemPreferences } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let isServer = () => false;
let getWin = () => null;
/** The session the person accepted: { control } (null = window-only sharing, as before) */
let session = null;
let helper = null;
let bar = null;

// ── Helpers that move the mouse and type ───────────────────────────────────

const MAC_HELPER = String.raw`
ObjC.import('CoreGraphics');
ObjC.import('Foundation');
const se = Application('System Events');
const KEYS = { Enter: 36, Backspace: 51, Tab: 48, Escape: 53, Delete: 117, Home: 115, End: 119, PageUp: 116, PageDown: 121, Up: 126, Down: 125, Left: 123, Right: 124, Space: 49,
  F1: 122, F2: 120, F3: 99, F4: 118, F5: 96, F6: 97, F7: 98, F8: 100, F9: 101, F10: 109, F11: 103, F12: 111 };
const MODS = { shift: 'shift down', control: 'control down', alt: 'option down', meta: 'command down' };
const BTN = { l: [1, 2, 6, 0], r: [3, 4, 7, 1], m: [25, 26, 27, 2] }; // down, up, dragged, button
let held = null;
let lastX = 0, lastY = 0, lastClick = 0, clicks = 1;
function post(type, x, y, button, clickState) {
  const e = $.CGEventCreateMouseEvent(null, type, $.CGPointMake(x, y), button);
  if (clickState) $.CGEventSetIntegerValueField(e, 1, clickState);
  $.CGEventPost(0, e);
}
function mods(s) { return s && s !== '-' ? s.split(',').map((m) => MODS[m]).filter(Boolean) : []; }
function handle(line) {
  const p = line.split(' ');
  const c = p[0];
  if (c === 'm') {
    lastX = +p[1]; lastY = +p[2];
    post(held ? BTN[held][2] : 5, lastX, lastY, held ? BTN[held][3] : 0);
  } else if (c === 'd' || c === 'u') {
    const b = BTN[p[1]] ? p[1] : 'l';
    lastX = +p[2]; lastY = +p[3];
    if (c === 'd') {
      const now = Date.now();
      clicks = now - lastClick < 400 ? Math.min(clicks + 1, 3) : 1;
      lastClick = now;
      held = b;
    } else held = null;
    post(BTN[b][c === 'd' ? 0 : 1], lastX, lastY, BTN[b][3], clicks);
  } else if (c === 'w') {
    const e = $.CGEventCreateScrollWheelEvent2(null, 0, 2, Math.round(-(+p[2])), Math.round(-(+p[1])), 0);
    $.CGEventPost(0, e);
  } else if (c === 'k') {
    const code = KEYS[p[1]];
    if (code !== undefined) se.keyCode(code, { using: mods(p[2]) });
  } else if (c === 'c') {
    const ch = String.fromCodePoint(parseInt(p[1], 16));
    se.keystroke(ch, { using: mods(p[2]) });
  }
}
const fh = $.NSFileHandle.fileHandleWithStandardInput;
let buf = '';
for (;;) {
  const data = fh.availableData;
  if (Number(data.length) === 0) break;
  buf += $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    try { handle(line); } catch (e) {}
  }
}
`;

const WIN_HELPER = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class SyncroInput {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, int data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint f, UIntPtr extra);
  [DllImport("user32.dll")] public static extern short VkKeyScan(char ch);
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit, Size = 40)] public struct INPUT { [FieldOffset(0)] public uint type; [FieldOffset(8)] public KEYBDINPUT ki; }
  [DllImport("user32.dll", SetLastError = true)] public static extern uint SendInput(uint n, INPUT[] inputs, int size);
  public static void Unicode(char ch) {
    INPUT[] i = new INPUT[2];
    i[0].type = 1; i[0].ki.wScan = ch; i[0].ki.dwFlags = 0x0004;
    i[1].type = 1; i[1].ki.wScan = ch; i[1].ki.dwFlags = 0x0004 | 0x0002;
    SendInput(2, i, Marshal.SizeOf(typeof(INPUT)));
  }
  public static void Key(byte vk, bool down) { keybd_event(vk, 0, down ? 0u : 0x0002u, UIntPtr.Zero); }
}
"@
[SyncroInput]::SetProcessDPIAware() | Out-Null
$keys = @{ Enter=0x0D; Backspace=0x08; Tab=0x09; Escape=0x1B; Delete=0x2E; Home=0x24; End=0x23; PageUp=0x21; PageDown=0x22; Left=0x25; Up=0x26; Right=0x27; Down=0x28; Space=0x20;
  F1=0x70; F2=0x71; F3=0x72; F4=0x73; F5=0x74; F6=0x75; F7=0x76; F8=0x77; F9=0x78; F10=0x79; F11=0x7A; F12=0x7B }
$modVk = @{ shift=0x10; control=0x11; alt=0x12; meta=0x11 }
$btn = @{ l=@(0x0002,0x0004); r=@(0x0008,0x0010); m=@(0x0020,0x0040) }
function Mods($s) { if ($s -and $s -ne '-') { return @($s.Split(',') | ForEach-Object { $modVk[$_] } | Where-Object { $_ } | Select-Object -Unique) } else { return @() } }
function Press($vk, $mods) {
  foreach ($m in $mods) { [SyncroInput]::Key([byte]$m, $true) }
  [SyncroInput]::Key([byte]$vk, $true); [SyncroInput]::Key([byte]$vk, $false)
  for ($i = $mods.Count - 1; $i -ge 0; $i--) { [SyncroInput]::Key([byte]$mods[$i], $false) }
}
while ($null -ne ($line = [Console]::In.ReadLine())) {
  $p = $line.Split(' ')
  switch ($p[0]) {
    'm' { [SyncroInput]::SetCursorPos([int]$p[1], [int]$p[2]) | Out-Null }
    'd' { [SyncroInput]::SetCursorPos([int]$p[2], [int]$p[3]) | Out-Null; $b = $btn[$p[1]]; if (-not $b) { $b = $btn['l'] }; [SyncroInput]::mouse_event([uint32]$b[0], 0, 0, 0, [UIntPtr]::Zero) }
    'u' { [SyncroInput]::SetCursorPos([int]$p[2], [int]$p[3]) | Out-Null; $b = $btn[$p[1]]; if (-not $b) { $b = $btn['l'] }; [SyncroInput]::mouse_event([uint32]$b[1], 0, 0, 0, [UIntPtr]::Zero) }
    'w' { $dy = [int](-[double]$p[2]); $dx = [int][double]$p[1]; if ($dy -ne 0) { [SyncroInput]::mouse_event(0x0800, 0, 0, $dy, [UIntPtr]::Zero) }; if ($dx -ne 0) { [SyncroInput]::mouse_event(0x01000, 0, 0, $dx, [UIntPtr]::Zero) } }
    'k' { $vk = $keys[$p[1]]; if ($vk) { Press $vk (Mods $p[2]) } }
    'c' {
      $ch = [char][Convert]::ToInt32($p[1], 16); $m = Mods $p[2]
      $withCtrl = $p[2] -match 'control|meta|alt'
      if ($withCtrl) { $scan = [SyncroInput]::VkKeyScan($ch); if ($scan -ne -1) { Press ($scan -band 0xFF) $m } }
      else { [SyncroInput]::Unicode($ch) }
    }
  }
}
`;

function startHelper() {
  if (helper) return helper;
  if (process.platform === 'darwin') {
    helper = spawn('/usr/bin/osascript', ['-l', 'JavaScript', '-e', MAC_HELPER], { stdio: ['pipe', 'ignore', 'ignore'] });
  } else if (process.platform === 'win32') {
    // The script runs from a file; its stdin then only carries the commands
    const file = path.join(os.tmpdir(), 'syncro-remote-input.ps1');
    fs.writeFileSync(file, WIN_HELPER, 'utf8');
    helper = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', file], { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });
  } else {
    return null;
  }
  helper.on('exit', () => { helper = null; });
  helper.on('error', () => { helper = null; });
  return helper;
}

function stopHelper() {
  try { helper?.stdin.end(); helper?.kill(); } catch { /* already gone */ }
  helper = null;
}

const send = (line) => {
  const h = startHelper();
  if (h?.stdin.writable) h.stdin.write(`${line}\n`);
};

// ── The bar that stays on top while Syncro controls the computer ───────────

const BAR_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:transparent;font:600 13px -apple-system,Segoe UI,sans-serif;-webkit-user-select:none}
.b{display:flex;align-items:center;gap:10px;height:100%;padding:0 8px 0 14px;box-sizing:border-box;border-radius:12px;background:#d93025;color:#fff;-webkit-app-region:drag;box-shadow:0 6px 20px rgba(0,0,0,.25)}
.d{width:9px;height:9px;border-radius:50%;background:#fff;animation:p 1.2s infinite}@keyframes p{50%{opacity:.3}}
a{-webkit-app-region:no-drag;margin-left:auto;background:#fff;color:#d93025;text-decoration:none;padding:5px 12px;border-radius:8px}
</style></head><body><div class="b"><span class="d"></span><span id="t">Syncro está controlando tu computadora</span><a href="syncro-stop://now">Detener</a></div></body></html>`;

function showBar(text) {
  if (bar && !bar.isDestroyed()) return;
  const area = screen.getPrimaryDisplay().workArea;
  const width = 430;
  bar = new BrowserWindow({
    width, height: 44, x: Math.round(area.x + (area.width - width) / 2), y: area.y + 8,
    frame: false, transparent: true, resizable: false, movable: true, minimizable: false, maximizable: false,
    alwaysOnTop: true, skipTaskbar: true, focusable: true, hasShadow: false, show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: true },
  });
  bar.setAlwaysOnTop(true, 'screen-saver');
  bar.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  bar.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(BAR_HTML.replace('Syncro está controlando tu computadora', text))}`);
  bar.webContents.on('will-navigate', (e, url) => {
    e.preventDefault();
    if (url.startsWith('syncro-stop:')) stop(true);
  });
  bar.once('ready-to-show', () => bar?.showInactive());
}

function hideBar() {
  if (bar && !bar.isDestroyed()) bar.destroy();
  bar = null;
}

// ── Session ────────────────────────────────────────────────────────────────

/** Ends the full-computer session; `byPerson` tells the page so it ends the call too. */
function stop(byPerson = false) {
  const was = !!session;
  session = null;
  stopHelper();
  hideBar();
  if (was && byPerson) getWin()?.webContents.send('remote-desktop:stopped');
}

/** Screen Recording / Accessibility on macOS (always fine on Windows). */
function status() {
  if (process.platform !== 'darwin') return { supported: process.platform === 'win32', screen: 'granted', accessibility: true };
  return {
    supported: true,
    screen: systemPreferences.getMediaAccessStatus('screen'),
    accessibility: systemPreferences.isTrustedAccessibilityClient(false),
  };
}

/** Where a point of the shared picture (0–1) is on the main screen, in the helper's units. */
function toScreen(nx, ny) {
  const d = screen.getPrimaryDisplay();
  const k = process.platform === 'win32' ? d.scaleFactor : 1; // Windows helper works in real pixels
  const x = Math.round((d.bounds.x + Math.min(1, Math.max(0, nx)) * d.bounds.width) * k);
  const y = Math.round((d.bounds.y + Math.min(1, Math.max(0, ny)) * d.bounds.height) * k);
  return { x, y };
}

const MOD_OK = new Set(['shift', 'control', 'alt', 'meta']);
const NAMED = new Set(['Enter', 'Backspace', 'Tab', 'Escape', 'Delete', 'Home', 'End', 'PageUp', 'PageDown', 'Up', 'Down', 'Left', 'Right', 'Space',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12']);
const ARROWS = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', ' ': 'Space' };

/** One remote event ({ kind, x, y, … } as the viewer sends it) → one helper command. */
function input(ev) {
  if (!session?.control || !ev || typeof ev !== 'object') return;
  const mods = Array.isArray(ev.modifiers) ? ev.modifiers.filter((m) => MOD_OK.has(m)).join(',') || '-' : '-';
  const b = ev.button === 'right' ? 'r' : ev.button === 'middle' ? 'm' : 'l';
  if (ev.kind === 'move' && Number.isFinite(ev.x) && Number.isFinite(ev.y)) {
    const p = toScreen(ev.x, ev.y);
    send(`m ${p.x} ${p.y}`);
  } else if ((ev.kind === 'down' || ev.kind === 'up') && Number.isFinite(ev.x) && Number.isFinite(ev.y)) {
    const p = toScreen(ev.x, ev.y);
    send(`${ev.kind === 'down' ? 'd' : 'u'} ${b} ${p.x} ${p.y}`);
  } else if (ev.kind === 'wheel') {
    send(`w ${Math.round(Number(ev.deltaX) || 0)} ${Math.round(Number(ev.deltaY) || 0)}`);
  } else if (ev.kind === 'key' && typeof ev.key === 'string') {
    const key = ARROWS[ev.key] ?? ev.key;
    if (NAMED.has(key)) send(`k ${key} ${mods}`);
    else if ([...key].length === 1) send(`c ${key.codePointAt(0).toString(16)} ${mods}`);
  }
}

function init(isServerFn, getWinFn) {
  isServer = isServerFn;
  getWin = getWinFn;
  const ok = (e) => isServer(e.senderFrame?.url || '');

  ipcMain.handle('remote-desktop:status', (e) => (ok(e) ? status() : null));
  // Opens the macOS privacy pane for what's missing (Accessibility also shows the system prompt)
  ipcMain.handle('remote-desktop:permissions', async (e, which) => {
    if (!ok(e) || process.platform !== 'darwin') return status();
    if (which === 'accessibility') {
      systemPreferences.isTrustedAccessibilityClient(true);
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
    } else if (which === 'screen') {
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
    }
    return status();
  });
  // The person accepted control of the whole computer (asked on their screen, every session)
  ipcMain.handle('remote-desktop:start', (e, opts) => {
    if (!ok(e)) return { ok: false };
    session = { control: !!opts?.control };
    showBar(opts?.name ? `${String(opts.name).slice(0, 40)} (Syncro) está controlando tu computadora` : 'Syncro está controlando tu computadora');
    if (session.control) startHelper();
    return { ok: true };
  });
  ipcMain.on('remote-desktop:control', (e, control) => {
    if (!ok(e) || !session) return;
    session.control = !!control;
    if (session.control) startHelper();
    else stopHelper();
  });
  ipcMain.on('remote-desktop:stop', (e) => { if (ok(e)) stop(false); });
  ipcMain.on('remote-desktop:input', (e, ev) => { if (ok(e)) input(ev); });
}

/** While a full-computer session is on, the screen share gives the main screen. */
async function screenSource() {
  if (!session) return null;
  const sources = await desktopCapturer.getSources({ types: ['screen'] });
  const primary = String(screen.getPrimaryDisplay().id);
  return sources.find((s) => s.display_id === primary) ?? sources[0] ?? null;
}

module.exports = { init, stop, screenSource, active: () => !!session };
