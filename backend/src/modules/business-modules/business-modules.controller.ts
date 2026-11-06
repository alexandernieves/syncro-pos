import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BusinessModulesService } from './business-modules.service';
import { ModuleRequestsService } from './module-requests.service';

/** What a business sees: the catalog, its own modules and its requests. */
@Controller('modules')
@UseGuards(JwtAuthGuard)
export class BusinessModulesController {
  constructor(
    private readonly modules: BusinessModulesService,
    private readonly requests: ModuleRequestsService,
  ) {}

  @Get('catalog')
  catalog() {
    return this.modules.catalog();
  }

  @Get('mine')
  mine(@Req() req: any) {
    if (!req.user?.businessId) return [];
    return this.modules.mine(req.user.businessId);
  }

  @Get('requests')
  myRequests(@Req() req: any) {
    return this.requests.mine(req.user);
  }

  @Post('requests')
  request(@Body() body: any, @Req() req: any) {
    return this.requests.create(req.user, body);
  }
}
