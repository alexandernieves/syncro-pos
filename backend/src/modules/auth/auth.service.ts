import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SettingsService } from '../settings/settings.service';
import { BranchesService } from '../branches/branches.service';
import { HistoryService } from '../history/history.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private settingsService: SettingsService,
    private branchesService: BranchesService,
    private historyService: HistoryService,
    private prisma: PrismaService,
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

  // ── Client Login (PWA Portal) ──────────────────────────────────────────────
  async clientLogin(documentId: string, password?: string) {
    const client = await this.prisma.client.findFirst({
      where: {
        documentId: {
          equals: documentId,
          mode: 'insensitive',
        },
      },
    });

    if (!client) {
      throw new UnauthorizedException('Cliente no encontrado');
    }

    if (client.isSuspended) {
      throw new UnauthorizedException('Tu cuenta ha sido pausada temporalmente. Por favor comunícate con el comercio.');
    }

    if (client.password) {
      if (!password) {
        throw new UnauthorizedException('La contraseña es requerida');
      }
      const isPasswordValid = await bcrypt.compare(password, client.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Contraseña incorrecta');
      }
    } else {
      throw new UnauthorizedException('Esta cuenta requiere registrar una contraseña antes de acceder');
    }

    const payload = {
      sub: client.id,
      role: 'client',
      name: client.name,
      businessId: client.businessId,
    };

    return {
      access_token: this.jwtService.sign(payload),
      client: {
        id: client.id,
        name: client.name,
        documentId: client.documentId,
        businessId: client.businessId,
      },
    };
  }

  // ── Client Check Status (PWA Portal) ───────────────────────────────────────
  async clientCheckStatus(documentId: string) {
    const client = await this.prisma.client.findFirst({
      where: {
        documentId: {
          equals: documentId,
          mode: 'insensitive',
        },
      },
    });

    if (!client) {
      throw new UnauthorizedException('Cliente no encontrado');
    }

    if (client.isSuspended) {
      throw new UnauthorizedException('Tu cuenta ha sido pausada temporalmente. Por favor comunícate con el comercio.');
    }

    return {
      exists: true,
      hasPassword: !!client.password,
      name: client.name,
    };
  }

  // ── Client Register Password (PWA Portal) ──────────────────────────────────
  async clientRegisterPassword(documentId: string, activationCode: string, pass: string) {
    const client = await this.prisma.client.findFirst({
      where: {
        documentId: {
          equals: documentId,
          mode: 'insensitive',
        },
      },
    });

    if (!client) {
      throw new UnauthorizedException('Cliente no encontrado');
    }

    if (!client.activationCode || client.activationCode !== activationCode) {
      throw new UnauthorizedException('Código de activación inválido');
    }

    if (client.activationCodeExpires && new Date() > client.activationCodeExpires) {
      throw new UnauthorizedException('El código de activación ha expirado');
    }

    const hashedPassword = await bcrypt.hash(pass, 10);

    const updatedClient = await this.prisma.client.update({
      where: { id: client.id },
      data: {
        password: hashedPassword,
        activationCode: null,
        activationCodeExpires: null,
      },
    });

    const payload = {
      sub: updatedClient.id,
      role: 'client',
      name: updatedClient.name,
      businessId: updatedClient.businessId,
    };

    return {
      access_token: this.jwtService.sign(payload),
      client: {
        id: updatedClient.id,
        name: updatedClient.name,
        documentId: updatedClient.documentId,
        businessId: updatedClient.businessId,
      },
    };
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
    return await this.usersService.create({
      ...userFields,
      businessId:  business.id,
      role:        'ownerpos',
      permissions: ['all'],
    });
  }

  // ── Saved Profiles ─────────────────────────────────────────────────────────
  // Scoped to a specific clientId AND the authenticated user's own email
  async getSavedProfiles(clientId: string, userId?: string) {
    // If userId provided, only return profiles belonging to that user's email
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        return this.prisma.savedProfile.findMany({
          where: { clientId, email: user.email },
          orderBy: { lastLogin: 'desc' },
          select: {
            // Never return the clientId itself in the response
            id:           true,
            email:        true,
            name:         true,
            role:         true,
            businessName: true,
            lastLogin:    true,
          },
        });
      }
    }

    return this.prisma.savedProfile.findMany({
      where: { clientId },
      orderBy: { lastLogin: 'desc' },
      select: {
        id:           true,
        email:        true,
        name:         true,
        role:         true,
        businessName: true,
        lastLogin:    true,
      },
    });
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
