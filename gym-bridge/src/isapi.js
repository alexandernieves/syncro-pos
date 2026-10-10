// Minimal Hikvision ISAPI client with HTTP Digest authentication (no extra dependencies).
import { createHash, randomBytes } from 'node:crypto';

const md5 = (s) => createHash('md5').update(s).digest('hex');

export class Isapi {
  constructor({ host, user, pass, timeoutMs = 8000 }) {
    this.host = host.replace(/\/$/, '');
    this.user = user;
    this.pass = pass;
    this.timeoutMs = timeoutMs;
    this.challenge = null;
    this.nc = 0;
  }

  authHeader(method, uri) {
    const c = this.challenge;
    if (!c) return undefined;
    const nc = (++this.nc).toString(16).padStart(8, '0');
    const cnonce = randomBytes(8).toString('hex');
    const ha1 = md5(`${this.user}:${c.realm}:${this.pass}`);
    const ha2 = md5(`${method}:${uri}`);
    const qop = c.qop ? 'auth' : null;
    const response = qop ? md5(`${ha1}:${c.nonce}:${nc}:${cnonce}:${qop}:${ha2}`) : md5(`${ha1}:${c.nonce}:${ha2}`);
    return [
      `Digest username="${this.user}"`,
      `realm="${c.realm}"`,
      `nonce="${c.nonce}"`,
      `uri="${uri}"`,
      `response="${response}"`,
      ...(c.opaque ? [`opaque="${c.opaque}"`] : []),
      ...(qop ? [`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`] : []),
      'algorithm=MD5',
    ].join(', ');
  }

  parseChallenge(header) {
    if (!header || !/^Digest /i.test(header)) return null;
    const out = {};
    for (const m of header.slice(7).matchAll(/(\w+)=("([^"]*)"|[^,\s]+)/g)) out[m[1].toLowerCase()] = m[3] ?? m[2];
    return { realm: out.realm, nonce: out.nonce, qop: out.qop, opaque: out.opaque };
  }

  async request(method, uri, { body, contentType, accept = 'application/json' } = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const headers = { Accept: accept };
      if (contentType) headers['Content-Type'] = contentType;
      const auth = this.authHeader(method, uri);
      if (auth) headers.Authorization = auth;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      let res;
      try {
        res = await fetch(this.host + uri, { method, headers, body, signal: ctrl.signal });
      } finally {
        clearTimeout(timer);
      }
      if (res.status === 401 && attempt === 0) {
        this.challenge = this.parseChallenge(res.headers.get('www-authenticate'));
        this.nc = 0;
        if (!this.challenge) throw new Error('El lector pidió una autenticación que no es Digest');
        continue;
      }
      const text = await res.text();
      let data = text;
      try { data = JSON.parse(text); } catch {}
      if (!res.ok) {
        const msg = typeof data === 'object' ? data.subStatusCode || data.statusString || data.errorMsg : text.slice(0, 200);
        const err = new Error(`ISAPI ${method} ${uri.split('?')[0]} → ${res.status} ${msg || ''}`.trim());
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    }
    throw new Error('Usuario o clave del lector incorrectos');
  }

  json(method, uri, obj) {
    return this.request(method, uri, { body: JSON.stringify(obj), contentType: 'application/json' });
  }

  async deviceInfo() {
    const xml = await this.request('GET', '/ISAPI/System/deviceInfo', { accept: 'application/xml' });
    const pick = (tag) => (String(xml).match(new RegExp(`<${tag}>([^<]*)</${tag}>`)) || [])[1] || null;
    return { model: pick('model'), serialNumber: pick('serialNumber'), firmware: pick('firmwareVersion'), name: pick('deviceName') };
  }

  async userCount() {
    const r = await this.request('GET', '/ISAPI/AccessControl/UserInfo/Count?format=json');
    return r?.UserInfoCount?.userNumber ?? null;
  }

  /** Adds or updates a person (SetUp on recent firmware; Record/Modify on older ones). */
  async setupUser(u, doorNo = 1) {
    const UserInfo = {
      employeeNo: u.employeeNo,
      name: u.name,
      userType: 'normal',
      Valid: { enable: true, beginTime: u.beginTime, endTime: u.endTime, timeType: 'local' },
      doorRight: String(doorNo),
      RightPlan: [{ doorNo, planTemplateNo: '1' }],
    };
    try {
      return await this.json('PUT', '/ISAPI/AccessControl/UserInfo/SetUp?format=json', { UserInfo });
    } catch (e) {
      if (e.status !== 404 && e.status !== 400) throw e;
      try {
        return await this.json('PUT', '/ISAPI/AccessControl/UserInfo/Modify?format=json', { UserInfo });
      } catch {
        return this.json('POST', '/ISAPI/AccessControl/UserInfo/Record?format=json', { UserInfo });
      }
    }
  }

  deleteUsers(employeeNos) {
    return this.json('PUT', '/ISAPI/AccessControl/UserInfo/Delete?format=json', { UserInfoDelCond: { EmployeeNoList: employeeNos.map((employeeNo) => ({ employeeNo })) } });
  }

  /** Uploads (or replaces) the face photo of a person. `jpeg` is a Buffer. */
  async setupFace(employeeNo, jpeg, library = '1') {
    const boundary = `----syncro${randomBytes(8).toString('hex')}`;
    const meta = JSON.stringify({ faceLibType: 'blackFD', FDID: String(library), FPID: String(employeeNo) });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="FaceDataRecord"\r\nContent-Type: application/json\r\n\r\n${meta}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="img"; filename="face.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      jpeg,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const type = `multipart/form-data; boundary=${boundary}`;
    try {
      return await this.request('PUT', '/ISAPI/Intelligent/FDLib/FDSetUp?format=json', { body, contentType: type });
    } catch (e) {
      if (e.status !== 404) throw e;
      return this.request('POST', '/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json', { body, contentType: type });
    }
  }

  /** Access events between two local times ("2026-10-10T18:00:00-04:00"), page by page. */
  async searchEvents(startTime, endTime, position = 0) {
    const r = await this.json('POST', '/ISAPI/AccessControl/AcsEvent?format=json', {
      AcsEventCond: { searchID: randomBytes(6).toString('hex'), searchResultPosition: position, maxResults: 30, major: 5, minor: 0, startTime, endTime },
    });
    return { more: r?.AcsEvent?.responseStatusStrg === 'MORE', items: r?.AcsEvent?.InfoList ?? [] };
  }

  openDoor(doorNo = 1) {
    return this.request('PUT', `/ISAPI/AccessControl/RemoteControl/door/${doorNo}`, { body: '<RemoteControlDoor><cmd>open</cmd></RemoteControlDoor>', contentType: 'application/xml', accept: 'application/xml' });
  }
}
