import { Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GymMemberGuard } from './gym-guards';
import { GymPortalService } from './gym-portal.service';

/** The member's side, used from the client app (/portal). */
@UseGuards(JwtAuthGuard, GymMemberGuard)
@Controller('gym/portal')
export class GymPortalController {
  constructor(private readonly portal: GymPortalService) {}

  @Get('me')
  me(@Request() req: any) {
    return this.portal.me(req.user.id, req.user.businessId);
  }

  @Get('schedule')
  schedule(@Request() req: any) {
    return this.portal.schedule(req.user.id, req.user.businessId);
  }

  @Post('sessions/:id/book')
  book(@Param('id') id: string, @Request() req: any) {
    return this.portal.book(req.user.id, req.user.businessId, id);
  }

  @Post('bookings/:id/cancel')
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.portal.cancel(req.user.id, req.user.businessId, id);
  }
}
