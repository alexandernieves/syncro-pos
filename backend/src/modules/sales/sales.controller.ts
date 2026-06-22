import { Controller, Get, Post, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() saleData: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.salesService.create(saleData, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Req() req: any, @Query('branchId') branchId?: string) {
    const businessId = req.user?.businessId;
    return this.salesService.findAll(businessId, branchId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const businessId = req.user?.businessId;
    return this.salesService.findOne(id, businessId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/return')
  async returnItems(
    @Param('id') id: string,
    @Body() returnData: any,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id;
    const businessId = req.user?.businessId;
    return this.salesService.returnItems(id, returnData, userId, businessId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('pending-credit')
  async createPendingPurchase(@Body() body: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    const businessId = req.user?.businessId;
    const { clientId, amount, cartData } = body;
    const cartDataWithUser = { ...cartData, userId };
    return this.salesService.createPendingPurchase(clientId, amount, businessId, cartDataWithUser);
  }

  @UseGuards(JwtAuthGuard)
  @Get('pending-credit/status/:pinCode')
  async getPendingPurchaseStatus(@Param('pinCode') pinCode: string) {
    return this.salesService.getPendingPurchaseStatus(pinCode);
  }

  @UseGuards(JwtAuthGuard)
  @Post('pending-credit/reject/:pinCode')
  async rejectPendingPurchase(@Param('pinCode') pinCode: string) {
    return this.salesService.rejectPendingPurchase(pinCode);
  }

  @UseGuards(JwtAuthGuard)
  @Get('pending-credit/:pinCode')
  async getPendingPurchaseDetails(@Param('pinCode') pinCode: string, @Req() req: any) {
    const clientId = req.user?.id || req.user?.sub;
    return this.salesService.getPendingPurchaseDetails(pinCode, clientId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('pending-credit/:pinCode/approve')
  async approvePendingPurchase(
    @Param('pinCode') pinCode: string,
    @Body('installmentsCount') installmentsCount: number,
    @Body('frequencyDays') frequencyDays: number,
    @Req() req: any,
  ) {
    const clientId = req.user?.id || req.user?.sub;
    return this.salesService.approvePendingPurchase(pinCode, clientId, installmentsCount, frequencyDays);
  }
}
