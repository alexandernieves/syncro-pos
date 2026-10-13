import { Body, Controller, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IN_CATEGORIES, METHODS, MovementsService, OUT_CATEGORIES, isManager } from './movements.service';

/** Income and expenses that aren't sales, from the floating widget and Contabilidad. */
@UseGuards(JwtAuthGuard)
@Controller('movements')
export class MovementsController {
  constructor(private readonly movements: MovementsService) {}

  /** What the widget needs: categories, methods, the rules and whether this user is a manager. */
  @Get('meta')
  async meta(@Request() req: any) {
    const [rules, hasSupervisorPin] = await Promise.all([this.movements.getSettings(req.user.businessId), this.movements.hasSupervisorPin(req.user.businessId)]);
    return { outCategories: OUT_CATEGORIES, inCategories: IN_CATEGORIES, methods: METHODS, rules, isManager: isManager(req.user.role), hasSupervisorPin };
  }

  @Get()
  list(@Query() query: any, @Request() req: any) {
    return this.movements.list(req.user.businessId, query);
  }

  @Post()
  create(@Body() body: any, @Request() req: any) {
    return this.movements.create(req.user, body);
  }

  @Post(':id/undo')
  undo(@Param('id') id: string, @Request() req: any) {
    return this.movements.undo(req.user, id);
  }

  @Post(':id/void')
  void(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.movements.void(req.user, id, body);
  }

  @Post('review')
  review(@Body('ids') ids: string[], @Request() req: any) {
    return this.movements.review(req.user, Array.isArray(ids) ? ids : []);
  }

  @Put('settings')
  saveSettings(@Body() body: any, @Request() req: any) {
    return this.movements.saveSettings(req.user, body);
  }
}
