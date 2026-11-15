import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LendingService } from './lending.service';

const staff = (req: any) => {
  if (!req.user?.businessId || req.user.role === 'client' || req.user.role === 'syncropos') throw new ForbiddenException('Solo el personal del comercio');
  return req.user.businessId as string;
};
const MANAGERS = ['ownerpos', 'owner', 'admin', 'superadmin', 'manager', 'gerente', 'supervisor'];
const manager = (req: any) => {
  const b = staff(req);
  if (!MANAGERS.includes(String(req.user.role || '').toLowerCase())) throw new ForbiddenException('Solo el dueño o un gerente aprueba préstamos y cambia ofertas');
  return b;
};

/** The lender's side (dashboard and POS). */
@Controller('lending')
@UseGuards(JwtAuthGuard)
export class LendingController {
  constructor(private readonly lending: LendingService) {}

  @Get('offers')
  offers(@Req() req: any) { return this.lending.offers(staff(req)); }

  @Post('offers')
  createOffer(@Req() req: any, @Body() body: any) { return this.lending.createOffer(manager(req), body); }

  @Put('offers/:id')
  updateOffer(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.lending.updateOffer(manager(req), id, body); }

  @Delete('offers/:id')
  deleteOffer(@Req() req: any, @Param('id') id: string) { return this.lending.deleteOffer(manager(req), id); }

  @Get('loans')
  loans(@Req() req: any, @Query('status') status?: string) { return this.lending.loans(staff(req), status); }

  @Get('portfolio')
  portfolio(@Req() req: any) { return this.lending.portfolio(staff(req)); }

  @Post('loans/:id/approve')
  approve(@Req() req: any, @Param('id') id: string) { return this.lending.approve(manager(req), req.user.id, id); }

  @Post('loans/:id/reject')
  reject(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.lending.reject(manager(req), req.user.id, id, body?.reason); }

  /** POS: what the PIN unlocks */
  @Get('pin/:pin')
  byPin(@Req() req: any, @Param('pin') pin: string) { return this.lending.byPin(staff(req), pin); }

  /** POS: hand the cash over (bills) and start the installments */
  @Post('pin/:pin/disburse')
  disburse(@Req() req: any, @Param('pin') pin: string, @Body() body: any) { return this.lending.disburse(staff(req), req.user, pin, body); }
}

/** The Syncro Credit app's side. */
@Controller('portal-lending')
@UseGuards(JwtAuthGuard)
export class LendingPortalController {
  constructor(private readonly lending: LendingService) {}

  private client(req: any) {
    if (req.user?.role !== 'client') throw new ForbiddenException('Solo desde la app de Syncro Credit');
    return req.user;
  }

  @Get('offers')
  market(@Req() req: any, @Query('amount') amount?: string) { return this.lending.market(this.client(req), amount); }

  @Post('request')
  request(@Req() req: any, @Body() body: any) { return this.lending.request(this.client(req), body); }

  @Get('requests')
  myRequests(@Req() req: any) { return this.lending.myRequests(this.client(req)); }

  @Post('requests/:id/cancel')
  cancel(@Req() req: any, @Param('id') id: string) { return this.lending.cancelRequest(this.client(req), id); }
}
