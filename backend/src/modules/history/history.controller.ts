import { Controller, Get, Delete, Query, Param, UseGuards } from '@nestjs/common';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('history')
@UseGuards(JwtAuthGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.historyService.findAll(query);
  }

  @Get('stats')
  async getStats() {
    return this.historyService.getStats();
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.historyService.remove(id);
  }
}
