import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LandingsService } from './landings.service';

@Controller('landings')
export class LandingsController {
  constructor(private readonly landingsService: LandingsService) {}

  // ─── PUBLIC ENDPOINTS (No Auth Required) ───────────────────────────────────

  @Get('public/slug/:slug')
  async getPublicBySlug(@Param('slug') slug: string) {
    return this.landingsService.findBySlug(slug);
  }

  @Post('public/order')
  @HttpCode(201)
  async submitPublicOrder(
    @Body('landingPageId') landingPageId: string,
    @Body('packId') packId: string,
    @Body('clientName') clientName: string,
    @Body('clientPhone') clientPhone: string,
    @Body('clientAddress') clientAddress: string,
    @Body('clientCity') clientCity: string,
  ) {
    return this.landingsService.createOrder({
      landingPageId,
      packId,
      clientName,
      clientPhone,
      clientAddress,
      clientCity,
    });
  }

  // ─── AUTHENTICATED ENDPOINTS (Dashboard Admin Only) ───────────────────────

  @Post('import')
  @UseGuards(JwtAuthGuard)
  async importProduct(@Req() req: any, @Body('url') url: string) {
    const businessId = req.user?.businessId;
    return this.landingsService.importFromUrl(url, businessId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllLandings(@Req() req: any) {
    const businessId = req.user?.businessId;
    return this.landingsService.findAll(businessId);
  }

  // --- Clientes Petgo CRUD ---

  @Get('clientes-petgo')
  @UseGuards(JwtAuthGuard)
  async getAllClientesPetgo() {
    return this.landingsService.findAllClientesPetgo();
  }

  @Get('clientes-petgo/:id')
  @UseGuards(JwtAuthGuard)
  async getOneClientePetgo(@Param('id') id: string) {
    return this.landingsService.findOneClientePetgo(parseInt(id, 10));
  }

  @Post('clientes-petgo')
  @UseGuards(JwtAuthGuard)
  async createClientePetgo(
    @Body('nombre') nombre: string,
    @Body('telefono') telefono: string,
    @Body('producto') producto: string,
    @Body('visitorId') visitorId?: string,
  ) {
    return this.landingsService.createClientePetgo({ nombre, telefono, producto, visitorId });
  }

  @Put('clientes-petgo/:id')
  @UseGuards(JwtAuthGuard)
  async updateClientePetgo(
    @Param('id') id: string,
    @Body('nombre') nombre?: string,
    @Body('telefono') telefono?: string,
    @Body('producto') producto?: string,
    @Body('visitorId') visitorId?: string,
  ) {
    return this.landingsService.updateClientePetgo(parseInt(id, 10), { nombre, telefono, producto, visitorId });
  }

  @Delete('clientes-petgo/:id')
  @UseGuards(JwtAuthGuard)
  async deleteClientePetgo(@Param('id') id: string) {
    await this.landingsService.deleteClientePetgo(parseInt(id, 10));
    return { success: true };
  }

  // --- Visitas Petgo Endpoints ---

  @Get('visitas-petgo')
  @UseGuards(JwtAuthGuard)
  async getAllVisitasPetgo() {
    return this.landingsService.findAllVisitasPetgo();
  }

  @Get('clientes-petgo/:id/visitas')
  @UseGuards(JwtAuthGuard)
  async getClientVisits(@Param('id') id: string) {
    return this.landingsService.findClientVisits(parseInt(id, 10));
  }

  @Delete('visitas-petgo/:id')
  @UseGuards(JwtAuthGuard)
  async deleteVisitaPetgo(@Param('id') id: string) {
    await this.landingsService.deleteVisitaPetgo(parseInt(id, 10));
    return { success: true };
  }


  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getOneLanding(@Param('id') id: string) {
    return this.landingsService.findOne(id);
  }


  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateLanding(
    @Param('id') id: string,
    @Body('config') config: any,
    @Body('status') status?: string,
    @Body('title') title?: string,
  ) {
    return this.landingsService.update(id, config, status, title);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteLanding(@Param('id') id: string) {
    await this.landingsService.delete(id);
    return { success: true };
  }
}
