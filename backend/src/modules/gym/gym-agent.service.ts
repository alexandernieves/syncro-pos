import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Currency, branchCurrencies, cashDue, fromUsd, isTachira, ratesFrom } from '../../common/currency';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { GymService, membershipOwed } from './gym.service';
import { GymClassesService } from './gym-classes.service';
import { GymCrmService } from './gym-crm.service';
import { GymVisitsService } from './gym-visits.service';
import { GymRemindersService } from './gym-reminders.service';
import { gymBranch, runInBranch } from './gym-branch';

const DAY = 24 * 60 * 60 * 1000;
const digits = (v?: string | null) => String(v ?? '').replace(/\D/g, '');
/** Last 10 digits: the same number written with or without the country code. */
const phoneKey = (v?: string | null) => digits(v).slice(-10);
const MAX_ITEMS = 20;

/** Error in the agent's format: {"error": "codigo", "mensaje": "texto"}. */
export const fail = (status: number, error: string, mensaje: string, extra: Record<string, unknown> = {}) => new HttpException({ error, mensaje, ...extra }, status);

/** "$25.00", "Bs 21.784,22", "COP 79.861". */
function money(amount: number, cur: Currency) {
  if (cur === 'USD') return `$${amount.toFixed(2)}`;
  if (cur === 'EUR') return `€${amount.toFixed(2)}`;
  const dec = cur === 'COP' ? 0 : 2;
  return `${cur === 'VES' ? 'Bs' : 'COP'} ${amount.toLocaleString('es-VE', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}

const STATE_ES: Record<string, string> = { ACTIVE: 'activo', EXPIRED: 'vencido', FROZEN: 'congelado', SCHEDULED: 'programado', BLOCKED: 'bloqueado', NONE: 'sin_membresia', CANCELLED: 'cancelado' };

/**
 * The API the Koenyx WhatsApp agent calls, following the contract Koenyx wrote
 * ("Endpoints Syncro para el agente Koenyx"): Spanish field names, amounts and dates as
 * ready-to-read text, lists of 20 at most, and errors as {"error", "mensaje"}.
 */
@Injectable()
export class GymAgentService {
  /** Keys already checked, so bcrypt doesn't run on every call. */
  private verified = new Map<string, { businessId: string; keyId: string; at: number }>();

  constructor(
    private prisma: PrismaService,
    private gym: GymService,
    private classesService: GymClassesService,
    private crm: GymCrmService,
    private visits: GymVisitsService,
    private settings: GymRemindersService,
    private whatsapp: WhatsAppService,
  ) {}

  // ── Keys (managed by the gym in Ajustes) ────────────────────────────────────

  /** The gym id (X-Gimnasio-Id for Koenyx) and its keys. */
  async listKeys(businessId: string) {
    const keys = await this.prisma.gymApiKey.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, revokedAt: true, createdAt: true },
    });
    return { gymId: businessId, keys };
  }

  /** The full key is shown only once, here. */
  async createKey(businessId: string, name?: string) {
    const prefix = randomBytes(4).toString('hex');
    const key = `syk_${prefix}_${randomBytes(24).toString('base64url')}`;
    const row = await this.prisma.gymApiKey.create({
      data: { businessId, name: name?.trim() || 'Agente de WhatsApp', keyPrefix: prefix, keyHash: await bcrypt.hash(key, 10) },
      select: { id: true, name: true, keyPrefix: true, createdAt: true },
    });
    return { ...row, key, gymId: businessId };
  }

  async revokeKey(businessId: string, id: string) {
    const row = await this.prisma.gymApiKey.findFirst({ where: { id, businessId } });
    if (!row) throw new NotFoundException('Clave no encontrada');
    for (const [k, v] of this.verified) if (v.keyId === id) this.verified.delete(k);
    return this.prisma.gymApiKey.update({ where: { id }, data: { revokedAt: new Date() }, select: { id: true, revokedAt: true } });
  }

  /** X-Api-Key (or Authorization: Bearer) plus X-Gimnasio-Id, which must be the key's gym. */
  async authenticate(apiKey?: string, gymId?: string) {
    const key = String(apiKey || '').replace(/^Bearer\s+/i, '').trim();
    const m = /^syk_([0-9a-f]{8})_[A-Za-z0-9_-]{20,}$/.exec(key);
    if (!m) throw fail(401, 'no_autorizado', 'Falta la clave de Syncro en la cabecera X-Api-Key');
    let businessId: string;
    const hit = this.verified.get(key);
    if (hit && Date.now() - hit.at < 5 * 60_000) businessId = hit.businessId;
    else {
      const row = await this.prisma.gymApiKey.findUnique({ where: { keyPrefix: m[1] } });
      if (!row || row.revokedAt || !(await bcrypt.compare(key, row.keyHash))) throw fail(401, 'no_autorizado', 'La clave de Syncro no es válida o fue revocada');
      this.verified.set(key, { businessId: row.businessId, keyId: row.id, at: Date.now() });
      this.prisma.gymApiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
      businessId = row.businessId;
    }
    if (gymId && gymId !== businessId) throw fail(401, 'no_autorizado', 'La clave no corresponde a ese gimnasio (X-Gimnasio-Id)');
    return businessId;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async ctx(businessId: string) {
    const [setting, gymSettings] = await Promise.all([this.prisma.setting.findFirst({ where: { businessId } }), this.settings.getSettings(businessId)]);
    const tz = gymSettings.timeZone;
    /** "jue 16 oct" */
    const day = (d: Date) => d.toLocaleDateString('es-VE', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').replace(',', '');
    /** "jue 16 oct, 7:00 p. m." */
    const when = (d: Date) => {
      const t = d.toLocaleTimeString('es-VE', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).replace(/\s+/g, ' ').trim();
      return `${day(d)}, ${t.replace(/([ap])\.?\s?m\.?$/i, (_x, l) => `${l.toLowerCase()}. m.`)}`;
    };
    return { setting, gymSettings, rates: ratesFrom(setting), tz, day, when };
  }

  private async branchOf(businessId: string, branchId?: string | null) {
    if (!branchId) {
      const main = await this.prisma.branch.findFirst({ where: { businessId }, orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }] });
      if (!main) throw fail(404, 'sin_sedes', 'El gimnasio no tiene sedes registradas');
      return main;
    }
    const b = await this.prisma.branch.findFirst({ where: { id: branchId, businessId } });
    if (!b) throw fail(404, 'sede_no_encontrada', 'No existe esa sede. Consulta la lista de sedes');
    return b;
  }

  private async member(businessId: string, id?: string) {
    if (!id) throw fail(400, 'falta_socio', 'Falta member_id (contacto_id del socio)');
    const m = await this.prisma.gymMember.findFirst({ where: { id, businessId }, include: { client: { select: { name: true, phone: true } } } });
    if (!m) throw fail(404, 'socio_no_encontrado', 'No existe ese socio');
    return m;
  }

  private splitName(full: string) {
    const parts = full.trim().split(/\s+/);
    return { nombre: parts[0] ?? '', apellido: parts.slice(1).join(' ') };
  }

  private errorText(e: unknown) {
    const r = (e as any)?.response;
    return (r && (r.mensaje || r.message)) || (e as Error).message;
  }

  // ── 1. Contact by phone ─────────────────────────────────────────────────────

  async lookup(businessId: string, phone?: string) {
    const key = phoneKey(phone);
    if (key.length < 7) throw fail(400, 'telefono_invalido', 'El número de teléfono no es válido');
    const { when } = await this.ctx(businessId);
    const members = await this.prisma.gymMember.findMany({
      where: { businessId, client: { phone: { endsWith: key } } },
      orderBy: { memberNumber: 'asc' },
      include: { client: { select: { name: true } }, branch: { select: { id: true, name: true } } },
    });
    if (members.length) {
      const [first, ...rest] = members;
      return {
        tipo: 'socio',
        contacto_id: first.id,
        ...this.splitName(first.client.name),
        sede_id: first.branch?.id ?? null,
        sede_nombre: first.branch?.name ?? null,
        // Several members can share a phone (a family): the agent asks who is writing
        ...(rest.length && { otros_socios_mismo_telefono: members.map((m) => ({ contacto_id: m.id, nombre: m.client.name })) }),
      };
    }
    const lead = await this.prisma.gymLead.findFirst({
      where: { businessId, phone: { endsWith: key }, stage: { not: 'WON' } },
      orderBy: { updatedAt: 'desc' },
      include: { branch: { select: { id: true, name: true } }, trialSession: { include: { class: { select: { name: true } } } } },
    });
    if (lead) {
      return {
        tipo: 'prospecto',
        contacto_id: lead.id,
        ...this.splitName(lead.name),
        sede_id: lead.branch?.id ?? null,
        sede_nombre: lead.branch?.name ?? null,
        clase_prueba: lead.trialSession && lead.trialSession.startsAt > new Date() ? { clase_id: lead.trialSessionId, nombre: lead.trialSession.class.name, fecha_hora: when(lead.trialSession.startsAt) } : null,
      };
    }
    return { tipo: 'desconocido', contacto_id: null, nombre: null, apellido: null, sede_id: null, sede_nombre: null };
  }

  // ── 2. Membership of a member ───────────────────────────────────────────────

  async membership(businessId: string, memberId: string) {
    await this.member(businessId, memberId);
    const { day, rates, gymSettings } = await this.ctx(businessId);
    const detail = await this.gym.getMember(businessId, memberId);
    const current: any = detail.currentMembership;
    const branch = detail.branchId ? await this.prisma.branch.findUnique({ where: { id: detail.branchId } }) : null;
    const cop = isTachira(branch?.state) && rates.COP > 0;
    const owed = current ? membershipOwed(current) : 0;
    const quota = await this.visits.guestQuota(businessId, memberId).catch(() => null);
    const plan = current ? await this.prisma.gymPlan.findUnique({ where: { id: current.planId } }) : null;
    const pass = gymSettings.visits.dayPassPrice;
    const f = gymSettings.freeze;
    const freezePolicy = !plan || plan.maxFreezeDays <= 0
      ? 'Su plan no se puede congelar'
      : [
          `Hasta ${plan.maxFreezeDays} días por membresía`,
          f.minDays > 1 ? `mínimo ${f.minDays} días cada vez` : null,
          f.maxTimes > 0 ? `${f.maxTimes === 1 ? '1 vez' : `${f.maxTimes} veces`} como máximo` : null,
          f.fee > 0 ? `cuesta ${money(f.fee, 'USD')}` : 'sin costo',
          'se pide en recepción',
        ].filter(Boolean).join(', ');
    return {
      socio: detail.client.name,
      estado: STATE_ES[detail.status] ?? detail.status,
      plan: current?.planName ?? null,
      fecha_inicio: current ? day(new Date(current.startDate)) : null,
      fecha_vencimiento: current ? day(new Date(current.endDate)) : null,
      dias_restantes: detail.daysLeft,
      deuda_usd: money(owed, 'USD'),
      deuda_bs: money(fromUsd(owed, 'VES', rates), 'VES'),
      ...(cop && { deuda_cop: money(cashDue(fromUsd(owed, 'COP', rates), 'COP'), 'COP') }),
      sede: branch?.name ?? null,
      valido_todas_las_sedes: !!detail.allBranches,
      pases_invitado_disponibles: quota?.left ?? 0,
      pases_invitado_del_plan: quota?.allowed ?? 0,
      precio_pase_invitado_usd: money(pass, 'USD'),
      precio_pase_invitado_bs: money(fromUsd(pass, 'VES', rates), 'VES'),
      ...(cop && { precio_pase_invitado_cop: money(cashDue(fromUsd(pass, 'COP', rates), 'COP'), 'COP') }),
      politica_congelacion: freezePolicy,
    };
  }

  // ── 3. Plans ────────────────────────────────────────────────────────────────

  async plans(businessId: string, branchId?: string) {
    const { rates } = await this.ctx(businessId);
    const branch = branchId ? await this.branchOf(businessId, branchId) : null;
    const branches = branch ? [branch] : await this.prisma.branch.findMany({ where: { businessId } });
    const cop = branches.some((b) => isTachira(b.state)) && rates.COP > 0;
    const [plans, classes] = await Promise.all([
      this.prisma.gymPlan.findMany({ where: { businessId, isActive: true }, orderBy: { durationDays: 'asc' } }),
      this.prisma.gymClass.findMany({ where: { businessId, isActive: true, ...(branch && { branchId: branch.id }) }, select: { id: true, name: true } }),
    ]);
    const dayNames = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    const hm = (t: string) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`; };
    return plans.slice(0, MAX_ITEMS).map((p) => {
      const windows = (Array.isArray(p.accessWindows) ? p.accessWindows : []) as { days: number[]; start: string; end: string }[];
      const names = !p.includesClasses ? [] : [...new Set((p.allowedClassIds.length ? classes.filter((c) => p.allowedClassIds.includes(c.id)) : classes).map((c) => c.name))];
      return {
        plan_id: p.id,
        nombre: p.name,
        duracion: p.durationDays === 1 ? '1 día' : `${p.durationDays} días`,
        precio_usd: money(p.price, 'USD'),
        precio_bs: money(fromUsd(p.price, 'VES', rates), 'VES'),
        ...(cop && { precio_cop: money(cashDue(fromUsd(p.price, 'COP', rates), 'COP'), 'COP') }),
        incluye_clases: names,
        horario_acceso: windows.length ? windows.map((w) => `${w.days.map((d) => dayNames[d]).join(', ')} de ${hm(w.start)} a ${hm(w.end)}`).join('; ') : 'Todo el horario del gimnasio',
        valido_todas_las_sedes: p.allBranches,
        pases_invitado_mes: p.guestPassesPerMonth,
        dias_congelacion: p.maxFreezeDays,
        ...(p.description && { descripcion: p.description }),
      };
    });
  }

  // ── 4. Branches ─────────────────────────────────────────────────────────────

  async branches(businessId: string) {
    const [rows, setting] = await Promise.all([
      this.prisma.branch.findMany({ where: { businessId }, orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }] }),
      this.prisma.setting.findFirst({ where: { businessId } }),
    ]);
    const pagoMovil = setting?.pagoMovilEnabled && setting.pagoMovilBank ? { banco: setting.pagoMovilBank, telefono: setting.pagoMovilPhone, cedula_rif: setting.pagoMovilId } : null;
    return rows.slice(0, MAX_ITEMS).map((b) => ({
      sede_id: b.id,
      nombre: b.name,
      principal: b.isMain,
      direccion: [b.location, b.state].filter(Boolean).join(', ') || null,
      lat: b.latitude,
      lng: b.longitude,
      horario: b.openingHours,
      telefono: b.phone,
      monedas: branchCurrencies(b.state),
      pago_movil: pagoMovil,
    }));
  }

  // ── 5. Classes of the week ──────────────────────────────────────────────────

  async classes(businessId: string, branchId?: string, fromDay?: string, trialOnly?: boolean) {
    const { tz, when } = await this.ctx(businessId);
    const branch = await this.branchOf(businessId, branchId);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    const from = /^\d{4}-\d{2}-\d{2}$/.test(fromDay || '') ? fromDay! : today;
    const to = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(new Date(`${from}T12:00:00Z`).getTime() + 7 * DAY));
    const { sessions } = await runInBranch(branch.id, () => this.classesService.schedule(businessId, from, to));
    const now = Date.now();
    return sessions
      .filter((s: any) => s.status === 'SCHEDULED' && new Date(s.startsAt).getTime() > now)
      .map((s: any) => ({
        clase_id: s.id,
        nombre: s.class.name,
        fecha_hora: when(new Date(s.startsAt)),
        duracion_min: Math.round((new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 60000),
        entrenador: s.trainer?.name ?? null,
        sala: s.class.room ?? null,
        cupos_libres: Math.max(0, s.capacity - s.booked),
        lista_espera: s.waitlist,
        apta_prueba: s.class.allowTrial !== false,
      }))
      .filter((c: any) => !trialOnly || (c.apta_prueba && c.cupos_libres > 0))
      .slice(0, MAX_ITEMS);
  }

  // ── 6. Book, cancel or join the waiting list ────────────────────────────────

  async booking(businessId: string, sessionId: string, data: { member_id?: string; action?: string }) {
    const action = String(data?.action || '');
    if (!['reservar', 'cancelar', 'lista_espera'].includes(action)) throw fail(400, 'accion_invalida', 'La acción debe ser reservar, cancelar o lista_espera');
    const { when } = await this.ctx(businessId);
    const member = await this.member(businessId, data.member_id);
    const session = await this.prisma.gymClassSession.findFirst({ where: { id: sessionId, businessId }, include: { class: { select: { name: true } } } });
    if (!session) throw fail(404, 'clase_no_encontrada', 'No existe esa clase. Consulta las clases de la semana');
    const label = `${session.class.name}, ${when(session.startsAt)}`;
    const first = member.client.name.split(/\s+/)[0];

    if (action === 'cancelar') {
      const booking = await this.prisma.gymBooking.findFirst({ where: { businessId, sessionId, memberId: member.id, status: { in: ['BOOKED', 'WAITLIST'] } } });
      if (!booking) throw fail(404, 'sin_reserva', `${first} no está anotado en ${label}`);
      // Frees the spot: the first one on the waiting list takes it and gets gym_cupo_liberado
      await this.classesService.setBookingStatus(businessId, booking.id, 'CANCELLED');
      return { estado: 'cancelado', mensaje: `${first} ya no está anotado en ${label}` };
    }

    // Full and they asked to book: say so, so the agent offers the waiting list
    if (action === 'reservar' && (await GymCrmService.takenSpots(this.prisma, sessionId)) >= session.capacity) {
      const already = await this.prisma.gymBooking.findFirst({ where: { sessionId, memberId: member.id, status: { in: ['BOOKED', 'WAITLIST'] } } });
      if (!already) return { estado: 'sin_cupo', mensaje: `${label} está llena. Puede quedar en lista de espera y entra solo si se libera un cupo` };
    }
    try {
      const b = await this.classesService.book(businessId, sessionId, member.id, 'AGENT');
      return b.status === 'WAITLIST'
        ? { estado: 'en_lista_espera', mensaje: `${first} quedó en lista de espera de ${label}. Si se libera un cupo, queda anotado solo` }
        : { estado: 'reservado', mensaje: `${first} quedó anotado en ${label}` };
    } catch (e) {
      const text = this.errorText(e);
      if (/no incluye/i.test(text)) return { estado: 'plan_no_incluye', mensaje: text };
      if (e instanceof HttpException) {
        const code = /ya est[aá] (anotado|en la lista)/i.test(text) ? 'ya_anotado' : /otra sede/i.test(text) ? 'otra_sede' : /membres[ií]a|congelada|bloqueado/i.test(text) ? 'sin_membresia_vigente' : /termin[oó]|cancelada/i.test(text) ? 'clase_no_disponible' : 'no_se_puede_reservar';
        throw fail(e.getStatus(), code, text);
      }
      throw e;
    }
  }

  // ── 7. Prospect and trial class ─────────────────────────────────────────────

  async trial(businessId: string, data: { phone?: string; first_name?: string; last_name?: string; national_id?: string; interest?: string; branch_id?: string; class_id?: string }) {
    const name = [data?.first_name, data?.last_name].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ');
    if (!name) throw fail(400, 'falta_nombre', 'Falta el nombre (first_name)');
    if (phoneKey(data.phone).length < 7) throw fail(400, 'telefono_invalido', 'El número de teléfono no es válido');
    if (!data.class_id) throw fail(400, 'falta_clase', 'Falta class_id (clase_id de las clases de la semana)');
    const { when } = await this.ctx(businessId);
    const session = await this.prisma.gymClassSession.findFirst({ where: { id: data.class_id, businessId }, include: { class: { select: { name: true, allowTrial: true } } } });
    if (!session) throw fail(404, 'clase_no_encontrada', 'No existe esa clase. Consulta las clases de la semana');
    if (session.class.allowTrial === false) throw fail(400, 'clase_no_apta_prueba', `${session.class.name} no está abierta para clases de prueba. Elige otra`);
    if (data.branch_id && session.branchId && data.branch_id !== session.branchId) throw fail(400, 'sede_distinta', 'Esa clase es de otra sede');
    const branch = await this.branchOf(businessId, session.branchId ?? data.branch_id);
    const phone = digits(data.phone);

    return runInBranch(branch.id, async () => {
      const dup = await this.crm.findDuplicate(businessId, { phone, documentId: data.national_id || null });
      if (dup?.type === 'member') throw fail(409, 'ya_es_socio', `${dup.name} ya es socio: puede reservar la clase directamente`, { contacto_id: dup.id });
      const lead = dup?.type === 'lead'
        ? { id: dup.id }
        : await this.crm.create(businessId, { name, phone, documentId: data.national_id || undefined, interest: data.interest || undefined, source: 'WHATSAPP' } as any, 'Agente de WhatsApp');
      try {
        // Syncro sends the gym_clase_prueba notice
        await this.crm.scheduleTrial(businessId, lead.id, session.id, 'Agente de WhatsApp', true);
      } catch (e) {
        const text = this.errorText(e);
        throw fail((e as any)?.getStatus?.() ?? 400, /llena/i.test(text) ? 'sin_cupo' : 'no_se_puede_agendar', text);
      }
      return { prospecto_id: lead.id, clase: session.class.name, fecha_hora: when(session.startsAt), sede: branch.name };
    });
  }

  // ── 8. Payment reported by the member ───────────────────────────────────────

  // ── Reception: payments reported to the agent ───────────────────────────────

  listReported(businessId: string, status = 'PENDING') {
    return this.prisma.gymReportedPayment.findMany({
      where: { businessId, ...(status !== 'ALL' && { status }), ...(gymBranch() && { OR: [{ branchId: gymBranch() }, { branchId: null }] }) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { member: { select: { id: true, memberNumber: true, photoUrl: true, client: { select: { name: true, phone: true } } } } },
    });
  }

  /** Reception checked the bank: confirmed (then it registers the renewal) or rejected. */
  async reviewReported(businessId: string, id: string, data: { status?: string; note?: string }, userName?: string) {
    if (!['CONFIRMED', 'REJECTED'].includes(String(data?.status))) throw new HttpException('Estado inválido', 400);
    const row = await this.prisma.gymReportedPayment.findFirst({ where: { id, businessId } });
    if (!row) throw new NotFoundException('Pago reportado no encontrado');
    return this.prisma.gymReportedPayment.update({ where: { id }, data: { status: data.status, note: data.note?.trim() || null, reviewedAt: new Date(), reviewedBy: userName || null } });
  }

  // ── Gym settings: hours and map pin of each branch ──────────────────────────

  branchInfo(businessId: string) {
    return this.prisma.branch.findMany({ where: { businessId }, orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }], select: { id: true, name: true, location: true, state: true, phone: true, openingHours: true, latitude: true, longitude: true } });
  }

  async updateBranchInfo(businessId: string, id: string, data: { openingHours?: string | null; latitude?: number | null; longitude?: number | null }) {
    const b = await this.prisma.branch.findFirst({ where: { id, businessId } });
    if (!b) throw new NotFoundException('Sede no encontrada');
    const coord = (v: unknown, max: number) => (v === null || v === '' || v === undefined ? null : Number.isFinite(Number(v)) && Math.abs(Number(v)) <= max ? Number(v) : NaN);
    const lat = coord(data.latitude, 90);
    const lng = coord(data.longitude, 180);
    if (Number.isNaN(lat) || Number.isNaN(lng)) throw new HttpException('Coordenadas inválidas', 400);
    return this.prisma.branch.update({
      where: { id },
      data: { openingHours: data.openingHours?.trim() || null, latitude: lat, longitude: lng },
      select: { id: true, name: true, openingHours: true, latitude: true, longitude: true },
    });
  }

  async reportPayment(businessId: string, data: { member_id?: string; plan_id?: string; amount?: string | number; bank?: string; reference?: string }) {
    const member = await this.member(businessId, data?.member_id);
    const amountText = String(data.amount ?? '').trim();
    if (!amountText) throw fail(400, 'falta_monto', 'Falta el monto pagado (amount)');
    if (!String(data.reference ?? '').trim()) throw fail(400, 'falta_referencia', 'Falta la referencia del pago');
    const plan = data.plan_id ? await this.prisma.gymPlan.findFirst({ where: { id: data.plan_id, businessId } }) : null;
    if (data.plan_id && !plan) throw fail(404, 'plan_no_encontrado', 'No existe ese plan');
    // "Bs 21.784,22" → 21784.22 VES; "$25" → 25 USD; "COP 79.861" → 79861 COP
    const currency: Currency = /cop|pesos?/i.test(amountText) ? 'COP' : /bs|bol/i.test(amountText) ? 'VES' : /€|eur/i.test(amountText) ? 'EUR' : /\$|usd|d[oó]lar/i.test(amountText) ? 'USD' : 'VES';
    const raw = amountText.replace(/[^\d.,]/g, '');
    const normalized = currency === 'USD' || currency === 'EUR' ? raw.replace(/,(?=\d{3}\b)/g, '').replace(',', '.') : raw.replace(/\./g, '').replace(',', '.');
    const amount = Number(normalized);
    const row = await this.prisma.gymReportedPayment.create({
      data: {
        businessId,
        branchId: member.branchId,
        memberId: member.id,
        planId: plan?.id ?? null,
        planName: plan?.name ?? null,
        amountText,
        amount: Number.isFinite(amount) && amount > 0 ? amount : null,
        currency,
        bank: String(data.bank ?? '').trim() || null,
        reference: String(data.reference).trim(),
      },
    });
    return { pago_reportado_id: row.id, estado: 'pendiente', mensaje: 'Pago recibido: recepción lo confirma y registra la renovación' };
  }

  // ── 9. Hand the chat to a person ────────────────────────────────────────────

  async handoff(businessId: string, data: { phone?: string; reason?: string; name?: string }) {
    if (phoneKey(data?.phone).length < 7) throw fail(400, 'telefono_invalido', 'El número de teléfono no es válido');
    const chat = await this.whatsapp.findOrCreateChat(digits(data.phone), businessId, data.name || undefined);
    await this.prisma.whatsAppChat.update({
      where: { id: chat.id },
      data: { needsAttention: true, attentionReason: String(data.reason ?? '').trim().slice(0, 300) || 'El agente pidió ayuda de una persona', attentionAt: new Date(), isUnread: true, isArchived: false },
    });
    // Tells the open inboxes right away
    await this.whatsapp.updateChat(chat.id, {}, businessId).catch(() => {});
    return { ok: true };
  }
}
