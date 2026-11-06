import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BusinessModulesService } from './business-modules.service';

/** What a business sees: the catalog and its own modules. */
@Controller('modules')
@UseGuards(JwtAuthGuard)
export class BusinessModulesController {
  constructor(private readonly modules: BusinessModulesService) {}

  @Get('catalog')
  catalog() {
    return this.modules.catalog();
  }

  @Get('mine')
  mine(@Req() req: any) {
    if (!req.user?.businessId) return [];
    return this.modules.mine(req.user.businessId);
  }
}
