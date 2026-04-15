import { 
  Controller, Post, Body, Get, UseGuards, Request, Param, 
  BadRequestException, Patch 
} from '@nestjs/common';
import { ShiftsService } from './shifts.service';

@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post('open')
  async openShift(@Request() req: any, @Body() body: { openingBalance: number; branchId: string }) {
    if (!req.user?._id) return { error: 'Unauthorized' };
    if (!body.branchId) throw new BadRequestException('Debe seleccionar una sucursal.');
    if (body.openingBalance < 0) {
      throw new BadRequestException('El balance de apertura no puede ser negativo.');
    }
    return this.shiftsService.openShift(req.user._id, body.openingBalance, body.branchId);
  }

  @Post('close/:id')
  async closeShift(
    @Param('id') id: string, 
    @Body() body: { closingBalance: number; notes?: string }
  ) {
    return this.shiftsService.closeShift(id, body.closingBalance, body.notes);
  }

  @Get('active')
  async getActiveShift(@Request() req: any) {
    if (!req.user?._id) return { status: 'CLOSED' };
    const shift = await this.shiftsService.getActiveShift(req.user._id);
    return shift || { status: 'CLOSED' };
  }

  @Get(':id')
  async getShift(@Param('id') id: string) {
    return this.shiftsService.getShiftById(id);
  }
}
