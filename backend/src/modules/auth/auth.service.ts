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

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByEmailWithPassword(email);
    if (!user || !user.password || !pass) {
      return null;
    }
    const isMatch = await bcrypt.compare(pass, user.password);
    if (isMatch) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { 
      email: user.email, 
      sub: user.id, 
      role: user.role, 
      name: user.name, 
      country: user.country,
      businessId: user.businessId 
    };
    
    await this.historyService.logAction({
      userId: user.id,
      action: 'LOGIN',
      entity: 'USER',
      entityId: user.id,
      details: { email: user.email }
    });

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        branchIds: user.branchIds,
        country: user.country,
        city: user.city,
        avatar: user.avatar,
        businessId: user.businessId,
      }
    };
  }

  async register(userData: any) {
    // 1. Create the business
    const business = await this.prisma.business.create({
      data: {
        name: userData.name || 'Mi Negocio',
        email: userData.email,
        status: 'ACTIVE',
        subscription: 'BASIC',
      }
    });

    // 2. Create the settings for this business
    await this.prisma.setting.create({
      data: {
        businessId: business.id,
        country: userData.country || 'Venezuela',
      }
    });

    await this.prisma.branch.create({
      data: {
        businessId: business.id,
        name: 'Sucursal Principal',
        location: userData.city || 'Sede Central',
        isMain: true,
        country: userData.country || 'Venezuela',
      }
    });

    // 4. Create the user associated with the business
    return await this.usersService.create({
      ...userData,
      businessId: business.id,
    });
  }

  async getSavedProfiles(clientId: string) {
    return this.prisma.savedProfile.findMany({
      where: { clientId },
      orderBy: { lastLogin: 'desc' }
    });
  }

  async saveProfile(data: { clientId: string; email: string; name: string; role?: string; businessName?: string }) {
    return this.prisma.savedProfile.upsert({
      where: {
        clientId_email: {
          clientId: data.clientId,
          email: data.email
        }
      },
      update: {
        name: data.name,
        role: data.role,
        businessName: data.businessName,
        lastLogin: new Date()
      },
      create: {
        clientId: data.clientId,
        email: data.email,
        name: data.name,
        role: data.role,
        businessName: data.businessName
      }
    });
  }

  async deleteSavedProfile(clientId: string, email: string) {
    return this.prisma.savedProfile.deleteMany({
      where: { clientId, email }
    });
  }
}
