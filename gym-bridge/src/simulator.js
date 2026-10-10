// Fake Hikvision face reader for testing the bridge without the real device.
// Implements the ISAPI calls the bridge uses, with Digest auth, plus /sim/* helpers:
//   POST /sim/recognize {"employeeNo":"3"}  → a face shows up at the reader
//   GET  /sim/state                          → users, faces, events and door openings
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';

const PORT = Number(process.env.SIM_PORT || 8091);
const USER = process.env.SIM_USER || 'admin';
const PASS = process.env.SIM_PASS || 'sim12345';
const TZ = process.env.SIM_TZ || 'America/Caracas';
const REALM = 'DS-K1T341CMFW';
const md5 = (s) => createHash('md5').update(s).digest('hex');
const nonce = randomBytes(12).toString('hex');

const users = new Map(); // employeeNo → UserInfo
const faces = new Map(); // employeeNo → bytes
const events = [];
let serial = 1000;
let doorOpenings = 0;

function localParts(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}
function withOffset(date) {
  const local = localParts(date);
  const off = Math.round((Date.parse(local + 'Z') - date.getTime()) / 60000);
  const sign = off >= 0 ? '+' : '-';
  return `${local}${sign}${String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')}:${String(Math.abs(off) % 60).padStart(2, '0')}`;
}

function authorized(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Digest ')) return false;
  const f = {};
  for (const m of h.slice(7).matchAll(/(\w+)=("([^"]*)"|[^,\s]+)/g)) f[m[1]] = m[3] ?? m[2];
  const ha1 = md5(`${f.username}:${REALM}:${PASS}`);
  const ha2 = md5(`${req.method}:${f.uri}`);
  const expected = f.qop ? md5(`${ha1}:${f.nonce}:${f.nc}:${f.cnonce}:${f.qop}:${ha2}`) : md5(`${ha1}:${f.nonce}:${ha2}`);
  return f.username === USER && f.nonce === nonce && f.response === expected;
}

const body = (req) => new Promise((resolve) => { const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks))); });
const send = (res, code, data, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type }); res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data)); };
const ok = (res) => send(res, 200, { statusCode: 1, statusString: 'OK', subStatusCode: 'ok' });

function recognize(employeeNo) {
  const now = new Date();
  const u = employeeNo ? users.get(String(employeeNo)) : null;
  const local = localParts(now);
  let minor = 76; // face doesn't match anyone
  if (u && faces.has(u.employeeNo)) minor = u.Valid.enable && local >= u.Valid.beginTime && local <= u.Valid.endTime ? 75 : 9;
  const ev = { major: 5, minor, time: withOffset(now), serialNo: ++serial, employeeNoString: minor === 76 ? undefined : u.employeeNo, name: u?.name, currentVerifyMode: 'face' };
  events.push(ev);
  return ev;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/sim/photo.jpg') {
    const f = new URL('../test-face.jpg', import.meta.url);
    return existsSync(f) ? send(res, 200, readFileSync(f), 'image/jpeg') : send(res, 404, {});
  }
  if (url.pathname === '/sim/state') return send(res, 200, { users: [...users.values()], faces: [...faces.keys()], events, doorOpenings });
  if (url.pathname === '/sim/recognize' && req.method === 'POST') {
    const { employeeNo } = JSON.parse((await body(req)).toString() || '{}');
    return send(res, 200, recognize(employeeNo));
  }
  if (!authorized(req)) {
    res.writeHead(401, { 'WWW-Authenticate': `Digest realm="${REALM}", qop="auth", nonce="${nonce}", opaque="${md5('x')}"` });
    return res.end();
  }
  const path = url.pathname;
  const raw = await body(req);
  if (path === '/ISAPI/System/deviceInfo') return send(res, 200, `<DeviceInfo><deviceName>Simulador</deviceName><model>DS-K1T341CMFW</model><serialNumber>SIM0001</serialNumber><firmwareVersion>V3.2.30 sim</firmwareVersion></DeviceInfo>`, 'application/xml');
  if (path === '/ISAPI/AccessControl/UserInfo/Count') return send(res, 200, { UserInfoCount: { userNumber: users.size } });
  if (path === '/ISAPI/AccessControl/UserInfo/SetUp') {
    const { UserInfo } = JSON.parse(raw.toString());
    if (!UserInfo?.employeeNo || !UserInfo.Valid?.endTime) return send(res, 400, { statusCode: 6, subStatusCode: 'badParameters' });
    users.set(String(UserInfo.employeeNo), UserInfo);
    return ok(res);
  }
  if (path === '/ISAPI/AccessControl/UserInfo/Delete') {
    for (const { employeeNo } of JSON.parse(raw.toString()).UserInfoDelCond.EmployeeNoList) { users.delete(employeeNo); faces.delete(employeeNo); }
    return ok(res);
  }
  if (path === '/ISAPI/Intelligent/FDLib/FDSetUp') {
    const text = raw.toString('latin1');
    const meta = JSON.parse(/\{[^}]*"FPID"[^}]*\}/.exec(text)?.[0] || '{}');
    const start = raw.indexOf(Buffer.from([0xff, 0xd8]));
    if (!meta.FPID || !users.has(meta.FPID)) return send(res, 400, { statusCode: 6, subStatusCode: 'employeeNoNotExist' });
    if (start < 0) return send(res, 400, { statusCode: 6, subStatusCode: 'faceNotDetected' });
    if (raw.length - start > 200_000) return send(res, 400, { statusCode: 6, subStatusCode: 'pictureSizeExceedsLimit' });
    faces.set(meta.FPID, raw.length - start);
    return ok(res);
  }
  if (path === '/ISAPI/AccessControl/AcsEvent') {
    const c = JSON.parse(raw.toString()).AcsEventCond;
    const from = Date.parse(c.startTime), to = Date.parse(c.endTime);
    const match = events.filter((e) => Date.parse(e.time) >= from && Date.parse(e.time) <= to);
    const page = match.slice(c.searchResultPosition, c.searchResultPosition + c.maxResults);
    return send(res, 200, { AcsEvent: { searchID: c.searchID, totalMatches: match.length, responseStatusStrg: c.searchResultPosition + page.length < match.length ? 'MORE' : page.length ? 'OK' : 'NO MATCH', numOfMatches: page.length, InfoList: page } });
  }
  if (/^\/ISAPI\/AccessControl\/RemoteControl\/door\/\d+$/.test(path)) {
    doorOpenings++;
    console.log('🚪 Puerta abierta');
    return send(res, 200, '<ResponseStatus><statusCode>1</statusCode></ResponseStatus>', 'application/xml');
  }
  send(res, 404, { statusCode: 4, subStatusCode: 'notSupport' });
}).listen(PORT, () => console.log(`Simulador del lector en http://localhost:${PORT} (usuario ${USER})`));
