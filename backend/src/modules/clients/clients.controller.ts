import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // --- CLIENT PORTAL ENDPOINTS (Defined first to prevent parameter capture) ---

  @Get('portal/profile')
  async getPortalProfile(@Request() req: any) {
    const clientId = req.user.id || req.user.sub;
    const businessId = req.user.businessId;
    return this.clientsService.findOne(clientId, businessId);
  }

  @Patch('portal/profile')
  async updatePortalProfile(@Body() body: any, @Request() req: any) {
    const clientId = req.user.id || req.user.sub;
    const businessId = req.user.businessId;
    const { name, email, phone, address } = body;
    return this.clientsService.update(clientId, { name, email, phone, address }, businessId);
  }

  @Get('portal/loans')
  async getPortalLoans(@Request() req: any) {
    const clientId = req.user.id || req.user.sub;
    const businessId = req.user.businessId;
    return this.clientsService.getLoans(clientId, businessId);
  }

  @Get('portal/debts')
  async getPortalDebts(@Request() req: any) {
    const clientId = req.user.id || req.user.sub;
    return this.clientsService.getPortalDebts(clientId);
  }

  @Post('portal/loans/request')
  async requestPortalLoan(@Body('amount') amount: number, @Request() req: any) {
    const clientId = req.user.id || req.user.sub;
    const businessId = req.user.businessId;
    return this.clientsService.requestLoan(clientId, amount, businessId);
  }

  @Get('portal/rewards')
  async getPortalRewards(@Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.getRewards(businessId);
  }

  @Get('portal/businesses')
  async getPortalBusinesses() {
    return this.clientsService.getPortalBusinesses();
  }

  @Get('portal/businesses/:businessId/branches')
  async getPortalBusinessBranches(@Param('businessId') businessId: string) {
    return this.clientsService.getPortalBusinessBranches(businessId);
  }

  @Get('portal/products')
  async getPortalProducts(@Query('branchId') branchId: string) {
    return this.clientsService.getPortalProducts(branchId);
  }

  @Get('portal/settings')
  async getPortalSettings(@Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.getSettings(businessId);
  }

  @Post('portal/rewards/:rewardId/redeem')
  async redeemPortalReward(@Param('rewardId') rewardId: string, @Request() req: any) {
    const clientId = req.user.id || req.user.sub;
    const businessId = req.user.businessId;
    return this.clientsService.redeemReward(clientId, rewardId, businessId);
  }

  @Post('portal/payments/submit')
  async submitPayment(@Body() body: any, @Request() req: any) {
    const clientId = req.user.id || req.user.sub;
    const businessId = req.user.businessId;
    return this.clientsService.submitPayment(clientId, businessId, body);
  }

  @Get('portal/payments/submissions')
  async getClientSubmissions(@Request() req: any) {
    const clientId = req.user.id || req.user.sub;
    return this.clientsService.getClientSubmissions(clientId);
  }

  // --- ADMIN / CASHIER ENDPOINTS ---

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

  @Get('loans/pending-requests')
  getPendingRequests(@Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.getPendingRequests(businessId);
  }

  @Get('submissions')
  async getPendingSubmissions(@Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.getPendingSubmissions(businessId);
  }

  @Post('submissions/:id/approve')
  async approveSubmission(@Param('id') id: string, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.approveSubmission(id, businessId);
  }

  @Post('submissions/:id/reject')
  async rejectSubmission(@Param('id') id: string, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.rejectSubmission(id, businessId);
  }

  // --- DELIVERY ORDER API ENDPOINTS ---

  @Get('portal/businesses/:businessId/settings')
  async getBusinessSettings(@Param('businessId') businessId: string) {
    return this.clientsService.getSettings(businessId);
  }

  @Post('portal/delivery-orders')
  async createPortalDeliveryOrder(@Body() body: any, @Request() req: any) {
    const clientId = req.user.id || req.user.sub;
    const businessId = body.businessId;
    return this.clientsService.createDeliveryOrder(clientId, businessId, body);
  }

  @Get('portal/delivery-orders')
  async getPortalDeliveryOrders(@Request() req: any) {
    const clientId = req.user.id || req.user.sub;
    return this.clientsService.getPortalDeliveryOrders(clientId);
  }

  @Get('portal/delivery-orders/active')
  async getPortalActiveDeliveryOrder(@Request() req: any) {
    const clientId = req.user.id || req.user.sub;
    return this.clientsService.getActiveDeliveryOrder(clientId);
  }

  @Post('portal/delivery-orders/:id/cancel')
  async cancelPortalDeliveryOrder(@Param('id') id: string, @Request() req: any) {
    const clientId = req.user.id || req.user.sub;
    return this.clientsService.cancelDeliveryOrder(id, clientId);
  }

  @Get('delivery-orders')
  async getDeliveryOrdersAdmin(@Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.getDeliveryOrders(businessId);
  }

  @Patch('delivery-orders/:id/status')
  async updateDeliveryOrderStatusAdmin(
    @Param('id') id: string,
    @Body('status') status: string,
    @Request() req: any,
  ) {
    const businessId = req.user.businessId;
    return this.clientsService.updateDeliveryOrderStatus(id, status, businessId);
  }

  @Delete('delivery-orders/:id')
  async deleteDeliveryOrderAdmin(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const businessId = req.user.businessId;
    return this.clientsService.deleteDeliveryOrder(id, businessId);
  }

  @Post('mass-surcharge')
  async massSurcharge(@Body() body: { clientIds: string[]; surchargeType: string; surchargeValue: number }, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.massSurcharge(body.clientIds, body.surchargeType, body.surchargeValue, businessId);
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

  @Post('loans/:loanId/approve')
  approveLoan(@Param('loanId') loanId: string, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.approveLoan(loanId, businessId);
  }

  @Post('loans/:loanId/disburse')
  disburseLoan(
    @Param('loanId') loanId: string,
    @Body('installmentsCount') installmentsCount: number,
    @Body('period') period: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY',
    @Request() req: any
  ) {
    const businessId = req.user.businessId;
    return this.clientsService.disburseLoan(loanId, installmentsCount, period, businessId);
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

  @Post(':id/activation-code')
  generateActivationCode(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.generateActivationCode(id, businessId, body?.creditLimit);
  }

  @Patch(':id/toggle-suspension')
  toggleSuspension(@Param('id') id: string, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.toggleSuspension(id, businessId);
  }

  @Post(':id/delete-account')
  deleteAccount(@Param('id') id: string, @Body('securityPin') securityPin: string, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.deleteAccount(id, securityPin, businessId);
  }

}
