import { Controller, Post, Body, Get, Req, Param, BadRequestException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ShiftsService } from './shifts.service';

@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post('open')
  @UseGuards(AuthGuard('jwt'))
  async open(@Req() req: any, @Body() body: { openingBalance: number; branchId: string }) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }
    
    if (!body.branchId) {
      throw new BadRequestException('ID de sucursal es requerido');
    }
    
    if (!body.openingBalance || body.openingBalance < 0) {
      throw new BadRequestException('Monto de apertura inválido');
    }
    
    return this.shiftsService.open({
      userId: req.user.id,
      branchId: body.branchId,
      openingBalance: body.openingBalance
    });
  }

  @Post('close/:id')
  @UseGuards(AuthGuard('jwt'))
  async close(@Param('id') id: string, @Body() body: { closingBalance: number }) {
    if (!id) {
      throw new BadRequestException('ID de turno es requerido');
    }
    
    if (!body.closingBalance || body.closingBalance < 0) {
      throw new BadRequestException('Monto de cierre inválido');
    }
    
    return this.shiftsService.close(id, body.closingBalance);
  }

  @Get('active')
  @UseGuards(AuthGuard('jwt'))
  async getActive(@Req() req: any) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }
    
    const shift = await this.shiftsService.getActive(req.user.id);
    return shift || { status: 'CLOSED' };
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async findAll() {
    return this.shiftsService.findAll();
  }
}
