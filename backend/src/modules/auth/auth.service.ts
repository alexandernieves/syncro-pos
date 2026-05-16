import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SettingsService } from '../settings/settings.service';
import { BranchesService } from '../branches/branches.service';
import { HistoryService } from '../history/history.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private settingsService: SettingsService,
    private branchesService: BranchesService,
    private historyService: HistoryService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByEmailWithPassword(email);
    if (!user || !user.password || !pass) {
      return null;
    }
    const isMatch = await bcrypt.compare(pass, user.password);
    if (isMatch) {
      // Prisma devuelve objetos planos, no necesitamos toObject()
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role, name: user.name, country: user.country };
    
    // Log login action
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
    if (userData.country) {
      await this.settingsService.updateSettings({ country: userData.country } as any);
    }
    // Create/update the main branch with country and city
    const mainBranch = await this.branchesService.findMain();
    const branchData = {
      name: 'Sucursal Principal',
      location: userData.city || 'Sede Central',
      isMain: true,
      country: userData.country || 'Venezuela',
      city: userData.city || '',
      state: '',
    };
    if (mainBranch) {
      await this.branchesService.update(mainBranch.id, branchData);
    } else {
      await this.branchesService.create(branchData);
    }
    return await this.usersService.create(userData);
  }
}
