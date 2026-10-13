import { Body, CanActivate, Controller, ExecutionContext, Get, Injectable, Post, Query, Request, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { GymAgentService } from './gym-agent.service';

/** The agent sends the business key: Authorization: Bearer syk_… (or x-api-key). No user session. */
@Injectable()
export class AgentKeyGuard implements CanActivate {
  constructor(private agent: GymAgentService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.agentBusinessId = await this.agent.authenticate(req.headers['authorization'] || req.headers['x-api-key']);
    return true;
  }
}

/** Tools for the WhatsApp agent (Koenyx): contact lookup, branches, plans, classes, bookings and trial classes. */
@SkipThrottle()
@UseGuards(AgentKeyGuard)
@Controller('gym/agent')
export class GymAgentController {
  constructor(private readonly agent: GymAgentService) {}

  @Get('branches')
  branches(@Request() req: any) {
    return this.agent.branches(req.agentBusinessId);
  }

  @Get('contact')
  contact(@Query('phone') phone: string, @Request() req: any) {
    return this.agent.contact(req.agentBusinessId, phone);
  }

  @Get('plans')
  plans(@Query('branchId') branchId: string, @Request() req: any) {
    return this.agent.plans(req.agentBusinessId, branchId || undefined);
  }

  @Get('classes')
  classes(@Query('branchId') branchId: string, @Query('from') from: string, @Query('days') days: string, @Request() req: any) {
    return this.agent.classes(req.agentBusinessId, branchId || undefined, from, days);
  }

  @Post('bookings')
  book(@Body() body: any, @Request() req: any) {
    return this.agent.book(req.agentBusinessId, body);
  }

  @Post('bookings/cancel')
  cancel(@Body() body: any, @Request() req: any) {
    return this.agent.cancelBooking(req.agentBusinessId, body);
  }

  @Post('trials')
  trial(@Body() body: any, @Request() req: any) {
    return this.agent.trial(req.agentBusinessId, body);
  }
}
