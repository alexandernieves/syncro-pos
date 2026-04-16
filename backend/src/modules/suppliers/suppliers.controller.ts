import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Req, BadRequestException, Query } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SuppliersAlertsService } from './suppliers-alerts.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('suppliers')
@UseGuards(AuthGuard('jwt'))
export class SuppliersController {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly suppliersAlertsService: SuppliersAlertsService
  ) {}

  @Post() create(@Req() req: any, @Body() body: any) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.suppliersService.create(body);
  }

  @Get() findAll(@Req() req: any) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.suppliersService.findAll();
  }

  @Get(':id') findOne(@Req() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.suppliersService.findOne(id);
  }

  @Get(':id/stats') getStats(@Req() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.suppliersService.getStats(id);
  }

  @Get(':id/suggestions') getSuggestions(@Req() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.suppliersService.getSuggestions(id);
  }

  @Put(':id') update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.suppliersService.update(id, body);
  }

  @Post('seed') seed(@Req() req: any) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.suppliersService.seed();
  }

  @Delete(':id') remove(@Req() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.suppliersService.remove(id);
  }

  @Get('alerts/all')
  async getAllAlerts(@Req() req: any, @Query('branchId') branchId?: string) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.suppliersAlertsService.getAllAlerts(branchId);
  }

  @Get('alerts/summary')
  async getAlertsSummary(@Req() req: any) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.suppliersAlertsService.getAlertsSummary();
  }
}
