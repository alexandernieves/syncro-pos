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

  // ── Register ───────────────────────────────────────────────────────────────
  async register(userData: any) {
    // 1. Create the business
    const business = await this.prisma.business.create({
      data: {
        name:         userData.name || 'Mi Negocio',
        email:        userData.email,
        status:       'ACTIVE',
        subscription: 'BASIC',
      },
    });

    // 2. Create settings for this business
    await this.prisma.setting.create({
      data: {
        businessId: business.id,
        country:    userData.country || 'Venezuela',
      },
    });

    // 3. Create main branch
    await this.prisma.branch.create({
      data: {
        businessId: business.id,
        name:       'Sucursal Principal',
        location:   userData.city || 'Sede Central',
        isMain:     true,
        country:    userData.country || 'Venezuela',
      },
    });

    // 4. Create the user linked to the business
    return await this.usersService.create({
      ...userData,
      businessId: business.id,
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
