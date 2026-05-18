import { Controller, Get, Delete, Query, Param, UseGuards, Request } from '@nestjs/common';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('history')
@UseGuards(JwtAuthGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  async findAll(@Query() query: any, @Request() req: any) {
    const businessId = req.user?.businessId;
    return this.historyService.findAll({ ...query, businessId });
  }

  @Get('stats')
  async getStats(@Request() req: any) {
    const businessId = req.user?.businessId;
    return this.historyService.getStats(businessId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    const businessId = req.user?.businessId;
    return this.historyService.remove(id, businessId);
  }
}
