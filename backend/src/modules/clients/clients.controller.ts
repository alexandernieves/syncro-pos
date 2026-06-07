import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(@Body() body: any, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.create({ ...body, businessId });
  }

  @Get()
  findAll(@Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.findAll(businessId);
  }

  @Get('search')
  search(@Query('q') q: string, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.searchByDocument(q || '', businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.findOne(id, businessId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.update(id, body, businessId);
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.update(id, body, businessId);
  }

  @Post(':id/payment')
  registerPayment(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.registerPayment(id, body, businessId);
  }

  @Post(':id/charge')
  registerCharge(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.registerCharge(id, body, businessId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.remove(id, businessId);
  }

  // --- LOANS SECTION ---

  @Post(':id/loans')
  createLoan(@Param('id') clientId: string, @Body() body: any, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.createLoan(clientId, body, businessId);
  }

  @Get(':id/loans')
  getLoans(@Param('id') clientId: string, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.getLoans(clientId, businessId);
  }

  @Post('loans/installments/:installmentId/pay')
  payInstallment(@Param('installmentId') installmentId: string, @Body('paidAmount') paidAmount: number, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.payInstallment(installmentId, paidAmount, businessId);
  }

  // --- REWARDS SECTION ---

  @Post('rewards')
  createReward(@Body() body: any, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.createReward(businessId, body);
  }

  @Get('rewards/catalog/all')
  getRewardsAdmin(@Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.getRewards(businessId);
  }

  // --- CLIENT PORTAL ENDPOINTS ---

  @Get('portal/profile')
  async getPortalProfile(@Request() req: any) {
    const clientId = req.user.sub;
    const businessId = req.user.businessId;
    return this.clientsService.findOne(clientId, businessId);
  }

  @Get('portal/loans')
  async getPortalLoans(@Request() req: any) {
    const clientId = req.user.sub;
    const businessId = req.user.businessId;
    return this.clientsService.getLoans(clientId, businessId);
  }

  @Get('portal/rewards')
  async getPortalRewards(@Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.getRewards(businessId);
  }

  @Get('portal/settings')
  async getPortalSettings(@Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.getSettings(businessId);
  }

  @Post('portal/rewards/:rewardId/redeem')
  async redeemPortalReward(@Param('rewardId') rewardId: string, @Request() req: any) {
    const clientId = req.user.sub;
    const businessId = req.user.businessId;
    return this.clientsService.redeemReward(clientId, rewardId, businessId);
  }
}
