import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StorefrontService } from './storefront.service';
import type { CreateOrderInput } from './storefront.service';

/**
 * Syncro Shop API.
 * - `storefront/public/*`: called by syncro.shop for guest buyers (no login).
 * - `storefront/admin/*`: merchant settings, behind the POS login.
 */
@Controller('storefront')
export class StorefrontController {
  constructor(private readonly storefront: StorefrontService) {}

  @Get('public/checkout/:businessId')
  getPublicCheckout(@Param('businessId') businessId: string) {
    return this.storefront.getPublicCheckout(businessId);
  }

  // Every buyer reaches this through the syncro.shop server, so the global
  // per-IP limit would throttle all of them together. The service applies its
  // own limit per phone and per buyer IP (x-forwarded-for).
  @SkipThrottle()
  @Post('public/orders')
  createOrder(@Body() body: CreateOrderInput, @Request() req: any) {
    const forwarded = String(req.headers['x-forwarded-for'] || '')
      .split(',')[0]
      .trim();
    return this.storefront.createOrder(body, forwarded || req.ip || null);
  }

  @Get('public/orders/:code')
  getPublicOrder(@Param('code') code: string, @Query('phone') phone: string) {
    return this.storefront.getPublicOrder(code, phone);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/stats')
  getStats(@Request() req: any) {
    return this.storefront.getStats(req.user?.businessId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/orders')
  listOrders(@Query('status') status: string, @Request() req: any) {
    return this.storefront.listOrders(req.user?.businessId, status);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/orders/:id')
  getOrder(@Param('id') id: string, @Request() req: any) {
    return this.storefront.getOrder(req.user?.businessId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/orders/:id/approve')
  approveOrder(
    @Param('id') id: string,
    @Body() body: { paymentMethod: string },
    @Request() req: any,
  ) {
    return this.storefront.approveOrder(
      req.user?.businessId,
      id,
      req.user?.id || req.user?.sub,
      body.paymentMethod,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/orders/:id/reject')
  rejectOrder(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Request() req: any,
  ) {
    return this.storefront.rejectOrder(
      req.user?.businessId,
      id,
      req.user?.id || req.user?.sub,
      body.reason,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/orders/:id/ship')
  shipOrder(@Param('id') id: string, @Request() req: any) {
    return this.storefront.advanceOrder(
      req.user?.businessId,
      id,
      req.user?.id || req.user?.sub,
      'EN_CAMINO',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/orders/:id/deliver')
  deliverOrder(@Param('id') id: string, @Request() req: any) {
    return this.storefront.advanceOrder(
      req.user?.businessId,
      id,
      req.user?.id || req.user?.sub,
      'ENTREGADO',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/orders/:id/cancel')
  cancelOrder(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    return this.storefront.cancelOrder(
      req.user?.businessId,
      id,
      req.user?.id || req.user?.sub,
      body.reason || '',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/reviews')
  listReviews(@Request() req: any) {
    return this.storefront.listReviews(req.user?.businessId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('admin/reviews/:id')
  setReviewHidden(
    @Param('id') id: string,
    @Body() body: { hidden: boolean },
    @Request() req: any,
  ) {
    return this.storefront.setReviewHidden(
      req.user?.businessId,
      id,
      body.hidden,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/profile')
  getProfile(@Request() req: any) {
    return this.storefront.getProfileForMerchant(req.user?.businessId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('admin/profile')
  saveProfile(@Body() body: Record<string, any>, @Request() req: any) {
    return this.storefront.saveProfile(req.user?.businessId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/checkout-form')
  getCheckoutForm(@Request() req: any) {
    return this.storefront.getCheckoutFormForMerchant(req.user?.businessId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('admin/checkout-form')
  saveCheckoutForm(@Body() body: { form: unknown }, @Request() req: any) {
    return this.storefront.saveCheckoutForm(req.user?.businessId, body.form);
  }
}
