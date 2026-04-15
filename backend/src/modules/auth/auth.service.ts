import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SettingsService } from '../settings/settings.service';
import { BranchesService } from '../branches/branches.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private settingsService: SettingsService,
    private branchesService: BranchesService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByEmailWithPassword(email);
    if (!user || !user.password || !pass) {
      return null;
    }
    const isMatch = await bcrypt.compare(pass, user.password);
    if (isMatch) {
      // @ts-ignore
      const { password, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user._id, role: user.role, name: user.name, country: user.country };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        country: user.country,
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
      await this.branchesService.update(String((mainBranch as any)._id), branchData);
    } else {
      await this.branchesService.create(branchData);
    }
    return await this.usersService.create(userData);
  }
}
