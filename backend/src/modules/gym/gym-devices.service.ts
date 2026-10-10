import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { GymRemindersService } from './gym-reminders.service';
import { GymService, membershipOwed, membershipState, zonedParts } from './gym.service';

const DAY = 24 * 60 * 60 * 1000;
const ONLINE_MS = 90_000;
const MODES = ['VALIDITY', 'STRICT'];

type Device = { id: string; businessId: string; mode: string; doorNo: number; name: string };
type BridgeEvent = { serialNo: string | number; employeeNo?: string | null; time: string; minor?: number; granted: boolean };

/** Local wall-clock time "AAAA-MM-DDTHH:mm:ss" in the gym's time zone, the format the reader expects. */
function deviceTime(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  const sec = new Intl.DateTimeFormat('en-US', { timeZone, second: '2-digit' }).format(date).padStart(2, '0');
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}T${String(Math.floor(p.minutes / 60)).padStart(2, '0')}:${String(p.minutes % 60).padStart(2, '0')}:${sec.slice(-2)}`;
}

/**
 * Face readers at the door. The gym's local bridge (gym-bridge on the Ubuntu server) pulls the roster
 * with the dates each member may enter, loads it into the reader, and sends back every recognition.
 */
@Injectable()
export class GymDevicesService {
  constructor(
    private prisma: PrismaService,
    private gym: GymService,
    private settings: GymRemindersService,
  ) {}

  // ── Management (staff) ─────────────────────────────────────────────────────

  private newKey() {
    const prefix = randomBytes(4).toString('hex');
    const secret = randomBytes(24).toString('base64url');
    return { prefix, key: `gymk_${prefix}_${secret}` };
  }

  private present(d: any) {
    const { keyHash, ...rest } = d;
    return { ...rest, online: !!d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < ONLINE_MS };
  }

  async list(businessId: string) {
    const [devices, members, synced, failed, noPhoto] = await Promise.all([
      this.prisma.gymDevice.findMany({ where: { businessId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.gymMember.count({ where: { businessId } }),
      this.prisma.gymMember.count({ where: { businessId, faceSyncedAt: { not: null }, faceError: null } }),
      this.prisma.gymMember.count({ where: { businessId, faceError: { not: null } } }),
      this.prisma.gymMember.count({ where: { businessId, photoUrl: null } }),
    ]);
    return { devices: devices.map((d) => this.present(d)), faces: { members, synced, failed, noPhoto, pending: Math.max(0, members - synced - failed - noPhoto) } };
  }

  async create(businessId: string, data: { name?: string; location?: string; mode?: string; doorNo?: number }) {
    if (!data.name?.trim()) throw new BadRequestException('Escribe un nombre para el lector (ej.: Entrada principal)');
    if (data.mode && !MODES.includes(data.mode)) throw new BadRequestException('Modo inválido');
    const { prefix, key } = this.newKey();
    const device = await this.prisma.gymDevice.create({
      data: { businessId, name: data.name.trim(), location: data.location?.trim() || null, mode: data.mode || 'VALIDITY', doorNo: Math.max(1, Math.round(Number(data.doorNo) || 1)), keyPrefix: prefix, keyHash: await bcrypt.hash(key, 10) },
    });
    return { device: this.present(device), key };
  }

  async update(businessId: string, id: string, data: { name?: string; location?: string | null; mode?: string; doorNo?: number; isActive?: boolean }) {
    const d = await this.prisma.gymDevice.findFirst({ where: { id, businessId } });
    if (!d) throw new NotFoundException('Lector no encontrado');
    if (data.mode !== undefined && !MODES.includes(data.mode)) throw new BadRequestException('Modo inválido');
    const updated = await this.prisma.gymDevice.update({
      where: { id },
      data: {
        ...(data.name !== undefined && data.name.trim() && { name: data.name.trim() }),
        ...(data.location !== undefined && { location: data.location?.trim() || null }),
        ...(data.mode !== undefined && { mode: data.mode }),
        ...(data.doorNo !== undefined && { doorNo: Math.max(1, Math.round(Number(data.doorNo) || 1)) }),
        ...(data.isActive !== undefined && { isActive: !!data.isActive }),
        // A new mode changes every member's dates on the reader
        ...(data.mode !== undefined && data.mode !== d.mode && { commands: [...((d.commands as any[]) ?? []), { id: randomUUID(), type: 'RESYNC', at: new Date().toISOString() }] }),
      },
    });
    return this.present(updated);
  }

  /** New key for the bridge (the old one stops working at once). */
  async rotateKey(businessId: string, id: string) {
    const d = await this.prisma.gymDevice.findFirst({ where: { id, businessId } });
    if (!d) throw new NotFoundException('Lector no encontrado');
    const { prefix, key } = this.newKey();
    await this.prisma.gymDevice.update({ where: { id }, data: { keyPrefix: prefix, keyHash: await bcrypt.hash(key, 10) } });
    return { key };
  }

  async command(businessId: string, id: string, type: 'OPEN_DOOR' | 'RESYNC') {
    if (!['OPEN_DOOR', 'RESYNC'].includes(type)) throw new BadRequestException('Orden inválida');
    const d = await this.prisma.gymDevice.findFirst({ where: { id, businessId } });
    if (!d) throw new NotFoundException('Lector no encontrado');
    if (!d.isActive) throw new BadRequestException('El lector está desactivado');
    const online = !!d.lastSeenAt && Date.now() - d.lastSeenAt.getTime() < ONLINE_MS;
    const commands = [...((d.commands as any[]) ?? []).filter((c) => c.type !== type), { id: randomUUID(), type, at: new Date().toISOString() }];
    await this.prisma.gymDevice.update({ where: { id }, data: { commands } });
    return { queued: true, online };
  }

  async events(businessId: string, deviceId?: string) {
    return this.prisma.gymDeviceEvent.findMany({ where: { businessId, ...(deviceId && { deviceId }) }, orderBy: { occurredAt: 'desc' }, take: 100, include: { device: { select: { name: true } } } }).then(async (rows) => {
      const members = await this.prisma.gymMember.findMany({ where: { id: { in: rows.map((r) => r.memberId).filter(Boolean) as string[] } }, select: { id: true, memberNumber: true, photoUrl: true, client: { select: { name: true } } } });
      return rows.map((r) => ({ ...r, member: members.find((m) => m.id === r.memberId) ?? null }));
    });
  }

  /** Members whose face isn't on the reader yet, or failed to load. */
  faceIssues(businessId: string) {
    return this.prisma.gymMember.findMany({
      where: { businessId, OR: [{ faceError: { not: null } }, { photoUrl: null }, { faceSyncedAt: null }] },
      orderBy: { memberNumber: 'asc' },
      take: 200,
      select: { id: true, memberNumber: true, photoUrl: true, faceError: true, faceSyncedAt: true, client: { select: { name: true } } },
    });
  }

  // ── Bridge (authenticated with the device key) ─────────────────────────────

  async authenticate(key?: string) {
    const m = /^gymk_([0-9a-f]{8})_[A-Za-z0-9_-]{20,}$/.exec(key || '');
    if (!m) throw new UnauthorizedException('Clave del lector inválida');
    const device = await this.prisma.gymDevice.findUnique({ where: { keyPrefix: m[1] } });
    if (!device || !device.isActive || !(await bcrypt.compare(key!, device.keyHash))) throw new UnauthorizedException('Clave del lector inválida');
    return device;
  }

  /** The bridge checks in every few seconds: reports its state and takes the pending orders. */
  async heartbeat(device: Device & { commands?: any }, status: any) {
    const commands = ((device.commands as any[]) ?? []).filter((c) => Date.now() - new Date(c.at).getTime() < 5 * 60_000);
    const clean = status && typeof status === 'object' ? JSON.parse(JSON.stringify(status).slice(0, 4000)) : null;
    // Only the orders handed out now are removed; one queued meanwhile waits for the next check-in
    const handed = new Set(commands.map((c) => c.id));
    const latest = await this.prisma.gymDevice.findUnique({ where: { id: device.id }, select: { commands: true } });
    const remaining = ((latest?.commands as any[]) ?? []).filter((c) => !handed.has(c.id) && Date.now() - new Date(c.at).getTime() < 5 * 60_000);
    await this.prisma.gymDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date(), status: clean, commands: remaining } });
    const { timeZone } = await this.settings.getSettings(device.businessId);
    return { mode: device.mode, doorNo: device.doorNo, timeZone, commands, serverTime: new Date().toISOString() };
  }

  /**
   * Everyone who should be on the reader, with the dates they may enter. In VALIDITY mode the
   * dates come from the memberships (plus grace days) and the reader decides on its own, even offline.
   * Blocked, frozen, unsigned or owing (when the gym blocks those) get an expired date.
   * In STRICT mode every member gets an expired date and Syncro decides each entry.
   */
  async roster(device: Device) {
    const settings = await this.settings.getSettings(device.businessId);
    const tz = settings.timeZone;
    const now = new Date();
    const [members, templates] = await Promise.all([
      this.prisma.gymMember.findMany({
        where: { businessId: device.businessId },
        include: {
          client: { select: { name: true } },
          memberships: { where: { status: { not: 'CANCELLED' } }, include: { payments: { select: { amount: true } } } },
          signatures: { select: { templateId: true, version: true } },
        },
      }),
      settings.access.requireSignatures ? this.prisma.gymDocumentTemplate.findMany({ where: { businessId: device.businessId, isActive: true, required: true }, select: { id: true, version: true } }) : Promise.resolve([] as { id: string; version: number }[]),
    ]);
    const items = [];
    for (const m of members) {
      if (!m.deviceUserId) {
        m.deviceUserId = String(m.memberNumber);
        await this.prisma.gymMember.update({ where: { id: m.id }, data: { deviceUserId: m.deviceUserId } });
      }
      let enabled = false;
      let reason = 'Sin membresía vigente';
      let begin: Date | null = null;
      let end: Date | null = null;
      const usable = m.memberships.filter((x) => membershipState(x, now) !== 'FROZEN' && x.status !== 'FROZEN' && x.endDate.getTime() + settings.access.graceDays * DAY >= now.getTime());
      if (!m.accessEnabled) reason = 'Acceso bloqueado';
      else if (m.memberships.some((x) => x.status === 'FROZEN')) reason = 'Membresía congelada';
      else if (usable.length) {
        begin = new Date(Math.min(...usable.map((x) => x.startDate.getTime())));
        end = new Date(Math.max(...usable.map((x) => x.endDate.getTime())) + settings.access.graceDays * DAY);
        enabled = true;
        reason = '';
        const current = usable.find((x) => x.startDate <= now) ?? usable[0];
        if (settings.access.blockIfOwed && membershipOwed(current) > settings.access.owedTolerance) { enabled = false; reason = 'Tiene deuda'; }
        if (templates.some((t) => !m.signatures.some((s) => s.templateId === t.id && s.version >= t.version))) { enabled = false; reason = 'Falta firmar documentos'; }
      }
      if (device.mode === 'STRICT' && enabled) { enabled = false; reason = 'Decide Syncro'; }
      const name = m.client.name.normalize('NFC').slice(0, 32);
      // Without access: a fixed past date, so the reader isn't rewritten on every sync
      const window = enabled ? { beginTime: deviceTime(begin!, tz), endTime: deviceTime(end!, tz) } : { beginTime: '2020-01-01T00:00:00', endTime: '2020-01-01T00:00:01' };
      const hash = createHash('sha1').update(JSON.stringify([name, enabled, window.endTime, window.beginTime.slice(0, 10), m.photoUrl])).digest('hex').slice(0, 16);
      items.push({ memberId: m.id, employeeNo: m.deviceUserId, name, enabled, reason, ...window, photoUrl: m.photoUrl, hash });
    }
    return { mode: device.mode, timeZone: tz, generatedAt: now.toISOString(), members: items };
  }

  /** What the bridge managed to load: marks each member's face as synced or with its error. */
  async rosterResult(device: Device, results: { memberId: string; face?: 'ok' | 'error' | 'skipped'; error?: string }[]) {
    const now = new Date();
    for (const r of (results || []).slice(0, 2000)) {
      if (!r?.memberId) continue;
      const data = r.face === 'ok' ? { faceSyncedAt: now, faceError: null } : r.face === 'error' ? { faceError: String(r.error || 'No se pudo cargar el rostro').slice(0, 200) } : null;
      if (data) await this.prisma.gymMember.updateMany({ where: { id: r.memberId, businessId: device.businessId }, data });
    }
    await this.prisma.gymDevice.update({ where: { id: device.id }, data: { lastSyncAt: now } });
    return { ok: true };
  }

  /**
   * Recognitions from the reader. Each one is stored once (by its serial number) and becomes a
   * check-in. In STRICT mode Syncro decides and tells the bridge which ones to open the door for.
   */
  async ingestEvents(device: Device, events: BridgeEvent[]) {
    const open: string[] = [];
    const results: { serialNo: string; granted: boolean; reason: string }[] = [];
    for (const e of (events || []).slice(0, 200)) {
      const serialNo = String(e.serialNo ?? '');
      const at = new Date(e.time);
      if (!serialNo || Number.isNaN(at.getTime())) continue;
      // Old events (bridge restarted after hours) are logged but don't open the door
      const fresh = Date.now() - at.getTime() < 2 * 60_000;
      const employeeNo = e.employeeNo ? String(e.employeeNo) : null;
      const member = employeeNo ? await this.prisma.gymMember.findFirst({ where: { businessId: device.businessId, deviceUserId: employeeNo }, select: { id: true } }) : null;
      let created;
      try {
        created = await this.prisma.gymDeviceEvent.create({ data: { businessId: device.businessId, deviceId: device.id, serialNo, employeeNo, memberId: member?.id ?? null, deviceGranted: !!e.granted, minor: Number.isFinite(Number(e.minor)) ? Number(e.minor) : null, occurredAt: at } });
      } catch {
        continue; // already received
      }
      if (!member) {
        await this.prisma.gymDeviceEvent.update({ where: { id: created.id }, data: { reason: employeeNo ? 'Persona del lector que no está en Syncro' : 'Rostro no reconocido' } });
        results.push({ serialNo, granted: false, reason: 'No reconocido' });
        continue;
      }
      const access = await this.gym.evaluateAccess(device.businessId, member.id, at);
      const strict = device.mode === 'STRICT';
      const granted = strict ? access.granted && fresh : !!e.granted;
      let reason = access.reason;
      if (!strict && e.granted !== access.granted) reason = e.granted ? `Entró por el lector · Syncro: ${access.reason}` : `El lector negó la entrada · Syncro: ${access.reason}`;
      if (strict && access.granted && !fresh) reason = `Evento atrasado, no se abrió · ${access.reason}`;
      await this.prisma.gymDeviceEvent.update({ where: { id: created.id }, data: { syncroGranted: access.granted, reason } });
      await this.prisma.gymCheckIn.create({ data: { businessId: device.businessId, memberId: member.id, granted, reason, method: 'FACE', deviceId: `device:${device.id}`, createdAt: at } });
      if (strict && granted && !e.granted) open.push(serialNo);
      results.push({ serialNo, granted, reason });
    }
    if (open.length) await this.prisma.gymDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
    return { open, results };
  }
}
