import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreditAdsService } from './credit-ads.service';

/** Syncro Central → Publicidad Syncro Credit (only Syncro's own team). */
@Controller('syncro-admin/credit-ads')
@UseGuards(JwtAuthGuard)
export class CreditAdsAdminController {
  constructor(private readonly ads: CreditAdsService) {}

  private assertAdmin(req: any) {
    if (req.user?.role !== 'syncropos') throw new ForbiddenException('Solo Syncro Central');
  }

  @Get()
  list(@Req() req: any) {
    this.assertAdmin(req);
    return this.ads.list();
  }

  @Get('products')
  products(@Req() req: any, @Query('businessId') businessId: string, @Query('q') q?: string) {
    this.assertAdmin(req);
    return this.ads.searchProducts(businessId, q);
  }

  /** Removes the background of the product photo (for this ad only) */
  @Post('cutout')
  cutout(@Req() req: any, @Body() body: any) {
    this.assertAdmin(req);
    return this.ads.cutout(String(body?.productId || ''));
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    this.assertAdmin(req);
    return this.ads.create(body);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.ads.update(id, body);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.ads.remove(id);
  }
}

/** The ads the Syncro Credit app shows in "Para ti". */
@Controller('portal-ads')
@UseGuards(JwtAuthGuard)
export class CreditAdsPortalController {
  constructor(private readonly ads: CreditAdsService) {}

  @Get()
  list() {
    return this.ads.forPortal();
  }
}
