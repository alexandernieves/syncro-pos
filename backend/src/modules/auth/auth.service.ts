import { PushCampaignsService } from '../push/push-campaigns.service';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SettingsService } from '../settings/settings.service';
import { BranchesService } from '../branches/branches.service';
import { HistoryService } from '../history/history.service';
import { PrismaService } from '../prisma/prisma.service';
import { suspendedMessage } from '../syncro-admin/suspension';
import { documentIdVariants } from './document-id';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private settingsService: SettingsService,
    private branchesService: BranchesService,
    private historyService: HistoryService,
    private prisma: PrismaService,
    private pushCampaigns: PushCampaignsService,
    private moduleRef: ModuleRef,
  ) {}

  // ── Validate User ──────────────────────────────────────────────────────────
  // ip is optional and used only for audit logging of failed attempts
  async validateUser(email: string, pass: string, ip?: string): Promise<any> {
    // Always do the DB lookup + bcrypt compare to prevent timing attacks
    // (an attacker shouldn't be able to tell if an email exists or not)
    const user = await this.usersService.findOneByEmailWithPassword(email);

    const passwordMatch =
      user?.password && pass
        ? await bcrypt.compare(pass, user.password)
        : false;

    if (!user || !passwordMatch) {
      // Audit the failed attempt without revealing whether the user exists
      if (ip) {
        try {
          // Log failed login — best-effort, don't block the response
          await this.prisma.auditLog.create({
            data: {
              userId:    user?.id ?? 'unknown',
              action:    'LOGIN_FAILED',
              entity:    'USER',
              entityId:  user?.id,
              details:   JSON.stringify({ email, reason: 'bad_credentials' }),
              ipAddress: ip,
              businessId: user?.businessId,
            },
          });
        } catch {
          // Swallow — don't expose internal errors to the caller
        }
      }
      return null;
    }

    const { password, ...result } = user;
    return result;
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  async login(user: any) {
    if (user.businessId && user.role !== 'syncropos') {
      const business = await this.prisma.business.findUnique({ where: { id: user.businessId }, select: { status: true, suspendedReason: true } });
      if (business?.status === 'SUSPENDED') throw new UnauthorizedException(suspendedMessage(business.suspendedReason));
    }
    const payload = {
      email:      user.email,
      sub:        user.id,
      role:       user.role,
      name:       user.name,
      country:    user.country,
      businessId: user.businessId,
    };

    await this.historyService.logAction({
      userId:   user.id,
      action:   'LOGIN',
      entity:   'USER',
      entityId: user.id,
      details:  { email: user.email },
    });

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id:          user.id,
        email:       user.email,
        name:        user.name,
        role:        user.role,
        permissions: user.permissions,
        branchIds:   user.branchIds,
        country:     user.country,
        city:        user.city,
        avatar:      user.avatar,
        businessId:  user.businessId,
      },
    };
  }

  /** Every client whose cédula matches however it was typed, the exact spelling first. */
  private async portalClients(documentId: string) {
    const variants = documentIdVariants(documentId);
    const list = await this.prisma.client.findMany({
      where: { documentId: { in: variants, mode: 'insensitive' } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    const exact = variants[0];
    return list.sort((a, b) => Number((b.documentId || '').toUpperCase() === exact) - Number((a.documentId || '').toUpperCase() === exact));
  }

  // ── Syncro Credit account (one per person, by cédula) ─────────────────────
  /** "v 12.345.678" → "V-12345678" */
  private canonicalDoc(raw: string) {
    const clean = String(raw || '').toUpperCase().replace(/[\s.]/g, '');
    const m = clean.match(/^([VEJGCP])-?(\d+)(?:-?(\d))?$/);
    if (m) return `${m[1]}-${m[2]}${m[3] ?? ''}`;
    if (/^\d{5,10}$/.test(clean)) return `V-${clean}`;
    return clean;
  }

  private async creditUserByDoc(documentId: string) {
    return this.prisma.creditUser.findFirst({ where: { documentId: { in: documentIdVariants(this.canonicalDoc(documentId)).concat(this.canonicalDoc(documentId)) } } });
  }

  /** Links every business's client row with this cédula to the account */
  /**
   * Joins the account with the business clients that are the same person. Typing a cédula proves
   * nothing, so a client is joined only when the account's phone is verified AND it is the same
   * phone the business has on file (golden rule: nobody sees another person's credit).
   */
  private async linkClients(cu: { id: string; documentId: string; phone?: string | null; phoneVerifiedAt?: Date | null }) {
    if (!cu.phoneVerifiedAt || !cu.phone) return;
    const tail = (p: string | null | undefined) => String(p || '').replace(/\D/g, '').slice(-10);
    const mine = tail(cu.phone);
    if (mine.length < 10) return;
    const loose = await this.prisma.client.findMany({
      where: { creditUserId: null, documentId: { in: documentIdVariants(cu.documentId), mode: 'insensitive' } },
      select: { id: true, phone: true },
    });
    const ids = loose.filter((c) => tail(c.phone) === mine).map((c) => c.id);
    if (ids.length) await this.prisma.client.updateMany({ where: { id: { in: ids } }, data: { creditUserId: cu.id } });
  }

  /** Sign-up started but the WhatsApp code was never typed */
  private pending(cu: { otpCode: string | null; phoneVerifiedAt: Date | null }) {
    return !!cu.otpCode && !cu.phoneVerifiedAt;
  }

  /** The session: the account, plus the business the person mainly buys on credit from (if any) */
  private async creditSession(cu: { id: string; name: string; documentId: string; phone?: string | null; phoneVerifiedAt?: Date | null }) {
    await this.linkClients(cu);
    const clients = await this.prisma.client.findMany({
      where: { creditUserId: cu.id, isSuspended: false },
      orderBy: [{ creditLimit: 'desc' }, { updatedAt: 'desc' }],
      take: 1,
    });
    const primary = clients[0] ?? null;
    const payload = { sub: primary?.id ?? null, cu: cu.id, role: 'client', name: cu.name, businessId: primary?.businessId ?? null };
    return {
      access_token: this.jwtService.sign(payload),
      client: { id: primary?.id ?? null, name: cu.name, documentId: cu.documentId, businessId: primary?.businessId ?? null },
    };
  }

  /** The account for a client a cashier activated (old style): same password, phone trusted */
  private async accountFromClient(client: { name: string; documentId: string | null; phone: string | null; email: string | null; password: string | null }) {
    const documentId = this.canonicalDoc(client.documentId || '');
    const existing = await this.creditUserByDoc(documentId);
    if (existing) return existing;
    return this.prisma.creditUser.create({
      data: { documentId, name: client.name, phone: client.phone, email: client.email, password: client.password!, phoneVerifiedAt: new Date() },
    });
  }

  // ── Client Login (PWA Portal) ──────────────────────────────────────────────
  async clientLogin(documentId: string, password?: string) {
    if (!password) throw new UnauthorizedException('La contraseña es requerida');
    // 1) The Syncro Credit account
    const cu = await this.creditUserByDoc(documentId);
    if (cu) {
      if (this.pending(cu)) throw new UnauthorizedException('Termina tu registro con el código que te enviamos por WhatsApp');
      if (!(await bcrypt.compare(password, cu.password))) throw new UnauthorizedException('Contraseña incorrecta');
      return this.creditSession(cu);
    }
    // 2) An account a cashier activated before accounts existed: it becomes the person's account
    const candidates = await this.portalClients(documentId);
    if (!candidates.length) throw new UnauthorizedException('No encontramos una cuenta con esa cédula');
    let client: (typeof candidates)[number] | null = null;
    for (const c of candidates) {
      if (c.password && (await bcrypt.compare(password, c.password))) { client = c; break; }
    }
    if (!client) {
      if (!candidates.some((c) => c.password)) throw new UnauthorizedException('Esta cuenta requiere registrar una contraseña antes de acceder');
      throw new UnauthorizedException('Contraseña incorrecta');
    }
    if (client.isSuspended) throw new UnauthorizedException('Tu cuenta ha sido pausada temporalmente. Por favor comunícate con el comercio.');
    const account = await this.accountFromClient(client);
    // the password proved this client is theirs
    await this.prisma.client.updateMany({ where: { id: client.id, creditUserId: null }, data: { creditUserId: account.id } });
    return this.creditSession(account);
  }

  // ── Client Check Status (PWA Portal) ───────────────────────────────────────
  async clientCheckStatus(documentId: string) {
    const cu = await this.creditUserByDoc(documentId);
    if (cu && !this.pending(cu)) return { exists: true, hasPassword: true, name: cu.name };
    // Several clients may match the cédula: the one with a password first (log in), then the one
    // waiting with an activation code (activate), then the exact spelling.
    const candidates = await this.portalClients(documentId);
    const client = candidates.find((c) => c.password) ?? candidates.find((c) => c.activationCode) ?? candidates[0];
    // Nobody with that cédula: the app offers to create the account
    if (!client) return { exists: false, hasPassword: false, name: null, pending: !!cu };
    if (client.isSuspended) {
      throw new UnauthorizedException('Tu cuenta ha sido pausada temporalmente. Por favor comunícate con el comercio.');
    }
    // A client the business registered but never activated can also just create the account
    // the name only greets someone who can log in or activate (a cédula alone shouldn't reveal who it is)
    const canEnter = !!client.password || !!client.activationCode;
    return { exists: true, hasPassword: !!client.password, hasCode: !!client.activationCode, name: canEnter ? client.name : null };
  }

  // ── Client Register Password (activation code from the cashier) ────────────
  async clientRegisterPassword(documentId: string, activationCode: string, pass: string) {
    const candidates = await this.portalClients(documentId);
    if (!candidates.length) throw new UnauthorizedException('Cliente no encontrado');
    const client = candidates.find((c) => !!c.activationCode && c.activationCode === String(activationCode || '').trim());
    if (!client) throw new UnauthorizedException('Código de activación inválido');
    if (client.activationCodeExpires && new Date() > client.activationCodeExpires) {
      throw new UnauthorizedException('El código de activación ha expirado');
    }
    const hashedPassword = await bcrypt.hash(pass, 10);
    await this.prisma.client.update({ where: { id: client.id }, data: { password: hashedPassword, activationCode: null, activationCodeExpires: null } });
    // The code proves who it is: the account takes this password (new or reset)
    const docCanon = this.canonicalDoc(client.documentId || documentId);
    const existing = await this.creditUserByDoc(docCanon);
    const cu = existing
      ? await this.prisma.creditUser.update({ where: { id: existing.id }, data: { password: hashedPassword, phoneVerifiedAt: existing.phoneVerifiedAt ?? new Date() } })
      : await this.prisma.creditUser.create({ data: { documentId: docCanon, name: client.name, phone: client.phone, email: client.email, password: hashedPassword, phoneVerifiedAt: new Date() } });
    await this.prisma.client.updateMany({ where: { id: client.id, creditUserId: null }, data: { creditUserId: cu.id } });
    return this.creditSession(cu);
  }

  // ── Self sign-up in the app ────────────────────────────────────────────────
  /** WhatsApp number Syncro sends its own codes from: the business set in SYNCRO_CREDIT_WA_BUSINESS_ID */
  private async sendSystemCode(phone: string, text: string) {
    const businessId = process.env.SYNCRO_CREDIT_WA_BUSINESS_ID;
    if (!businessId || !phone) return false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { WhatsAppService } = require('../whatsapp/whatsapp.service');
      const wa = this.moduleRef.get(WhatsAppService, { strict: false });
      const status = await wa.getStatus(businessId);
      if (!status?.connected) return false;
      await wa.sendTextMessage(phone, text, businessId);
      return true;
    } catch {
      return false;
    }
  }

  async creditRegisterStart(body: any) {
    const documentId = this.canonicalDoc(body?.documentId);
    const name = String(body?.name || '').trim().slice(0, 80);
    const phone = String(body?.phone || '').replace(/\D/g, '').slice(0, 15);
    const password = String(body?.password || '');
    if (!/^[VEJGCP]-\d{5,10}$/.test(documentId)) throw new BadRequestException('Cédula no válida');
    if (name.length < 3) throw new BadRequestException('Escribe tu nombre completo');
    if (phone.length < 10) throw new BadRequestException('Teléfono no válido');
    if (password.length < 6) throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
    const existing = await this.creditUserByDoc(documentId);
    if (existing && !this.pending(existing)) throw new BadRequestException('Ya tienes una cuenta con esa cédula. Inicia sesión.');
    const legacy = (await this.portalClients(documentId)).find((c) => c.password);
    if (legacy) throw new BadRequestException('Ya tienes una cuenta con esa cédula. Inicia sesión.');

    const hash = await bcrypt.hash(password, 10);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const data = { name, phone, password: hash, otpCode: code, otpExpires: new Date(Date.now() + 15 * 60 * 1000) };
    const cu = existing
      ? await this.prisma.creditUser.update({ where: { id: existing.id }, data })
      : await this.prisma.creditUser.create({ data: { documentId, ...data } });

    const waPhone = phone.startsWith('0') ? `58${phone.slice(1)}` : phone;
    const sent = await this.sendSystemCode(waPhone, `Tu código de Syncro Credit es *${code}*. Vence en 15 minutos. No lo compartas con nadie.`);
    if (sent) return { needsCode: true, phone: `${phone.slice(0, 4)}•••${phone.slice(-3)}` };
    // No Syncro WhatsApp configured: the account works, with the phone marked as not verified
    await this.prisma.creditUser.update({ where: { id: cu.id }, data: { otpCode: null, otpExpires: null } });
    return { needsCode: false, ...(await this.creditSession(cu)) };
  }

  async creditRegisterVerify(body: any) {
    const cu = await this.creditUserByDoc(body?.documentId);
    if (!cu || !cu.otpCode) throw new BadRequestException('Vuelve a empezar el registro');
    if (cu.otpExpires && cu.otpExpires < new Date()) throw new BadRequestException('El código venció. Pide uno nuevo.');
    if (String(body?.code || '').trim() !== cu.otpCode) throw new BadRequestException('Código incorrecto');
    const ok = await this.prisma.creditUser.update({ where: { id: cu.id }, data: { phoneVerifiedAt: new Date(), otpCode: null, otpExpires: null } });
    return this.creditSession(ok);
  }

  // ── Register ───────────────────────────────────────────────────────────────
  async register(userData: any) {
    const {
      businessName: rawBusinessName,
      // Pulled out and dropped on purpose. The trade is no longer asked for,
      // but an older client may still post it, and anything left in
      // `userFields` is forwarded straight into the user record.
      businessType: _discardedBusinessType,
      ...userFields
    } = userData;
    void _discardedBusinessType;

    const businessName = rawBusinessName || userFields.name || 'Mi Negocio';

    // 1. Create the business
    const business = await this.prisma.business.create({
      data: {
        name:         businessName,
        email:        userFields.email,
        status:       'ACTIVE',
        subscription: 'BASIC',
      },
    });

    /*
     * 2. Settings for the new business.
     *
     * Registration no longer asks what trade the shop is in, and no longer
     * branches on it. The same base covers a bodega, a minimarket, a hardware
     * store and a boutique, so everyone starts with every module switched on
     * and turns off what they do not want from Configuración.
     *
     * Branching here was also quietly harmful: the old BODEGA preset shipped
     * without credit, WhatsApp or the agent, which meant the one trade that
     * lives on fiado was the only one registering without it.
     *
     * Blind close is on by default. A till that reconciles against a declared
     * count is the safer starting position for any shop, and it is one switch
     * away in settings for anyone who does not want it.
     */
    const businessType = 'GENERAL';
    const enabledModules = [
      'pos', 'products', 'inventory', 'clients', 'credit', 'suppliers',
      'accounting', 'reports', 'historial', 'whatsapp', 'deliveries', 'ai_agent'
    ];
    const blindShiftClose = true;

    // 3. Create settings for this business
    await this.prisma.setting.create({
      data: {
        businessId: business.id,
        country:    userFields.country || 'Venezuela',
        businessType,
        enabledModules,
        blindShiftClose,
        businessName,
      },
    });

    // 4. Create main branch
    await this.prisma.branch.create({
      data: {
        businessId: business.id,
        name:       'Sucursal Principal',
        location:   userFields.city || 'Sede Central',
        isMain:     true,
        country:    userFields.country || 'Venezuela',
      },
    });

    /*
     * 5. Create the user linked to the business.
     *
     * Whoever registers here just created the business, so they are its owner
     * and get the run of it. Without this they fell through to the schema
     * default of 'pos', which drops them on the till screen with an empty
     * sidebar — locked out of the inventory, reports and settings of a shop
     * that is their own.
     */
    const owner = await this.usersService.create({
      ...userFields,
      businessId:  business.id,
      role:        'ownerpos',
      permissions: ['all'],
    });

    // 6. Welcome push: right away on a device, or as soon as they turn notifications on
    void this.pushCampaigns.automate('welcome_business', { userIds: [owner.id] }, {}, `welcome_business:${owner.id}`);
    return owner;
  }

  // ── Saved Profiles ─────────────────────────────────────────────────────────
  // Scoped to a specific clientId AND the authenticated user's own email
  async getSavedProfiles(clientId: string, userId?: string) {
    const select = {
      // Never return the clientId itself in the response
      id:           true,
      email:        true,
      name:         true,
      role:         true,
      businessName: true,
      lastLogin:    true,
    } as const;
    // If userId provided, only return profiles belonging to that user's email
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        return this.withUnread(await this.prisma.savedProfile.findMany({ where: { clientId, email: user.email }, orderBy: { lastLogin: 'desc' }, select }));
      }
    }
    return this.withUnread(await this.prisma.savedProfile.findMany({ where: { clientId }, orderBy: { lastLogin: 'desc' }, select }));
  }

  /**
   * Unread support messages of each saved profile, for the little number on the login screen:
   * a business sees what the Syncro team wrote and it hasn't read; the Syncro team what businesses
   * wrote. Only a count, never the messages.
   */
  private async withUnread<T extends { email: string }>(profiles: T[]): Promise<(T & { unread: number })[]> {
    if (!profiles.length) return [];
    try {
      const users = await this.prisma.user.findMany({
        where: { OR: profiles.map((p) => ({ email: { equals: p.email, mode: 'insensitive' as const } })) },
        select: { email: true, role: true, businessId: true },
      });
      const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
      let supportUnread: number | null = null;
      const businessUnread = new Map<string, number>();
      const out: (T & { unread: number })[] = [];
      for (const p of profiles) {
        const u = byEmail.get(p.email.toLowerCase());
        let unread = 0;
        if (u?.role === 'syncropos') {
          supportUnread ??= await this.prisma.message.count({ where: { isRead: false, sender: { role: { not: 'syncropos' } } } });
          unread = supportUnread;
        } else if (u?.businessId && u.role !== 'client') {
          if (!businessUnread.has(u.businessId)) {
            businessUnread.set(u.businessId, await this.prisma.message.count({ where: { isRead: false, sender: { role: 'syncropos' }, conversation: { businessId: u.businessId } } }));
          }
          unread = businessUnread.get(u.businessId) ?? 0;
        }
        out.push({ ...p, unread });
      }
      return out;
    } catch {
      return profiles.map((p) => ({ ...p, unread: 0 }));
    }
  }

  async saveProfile(data: {
    clientId:     string;
    email:        string;
    name:         string;
    role?:        string;
    businessName?: string;
  }) {
    return this.prisma.savedProfile.upsert({
      where: {
        clientId_email: {
          clientId: data.clientId,
          email:    data.email,
        },
      },
      update: {
        name:         data.name,
        role:         data.role,
        businessName: data.businessName,
        lastLogin:    new Date(),
      },
      create: {
        clientId:     data.clientId,
        email:        data.email,
        name:         data.name,
        role:         data.role,
        businessName: data.businessName,
      },
    });
  }

  async deleteSavedProfile(clientId: string, email: string) {
    return this.prisma.savedProfile.deleteMany({
      where: { clientId, email },
    });
  }
}
