import { Body, Controller, Get, Param, Patch, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GymService } from './gym.service';
import { GymRemindersService } from './gym-reminders.service';
import { GymClassesService } from './gym-classes.service';

@UseGuards(JwtAuthGuard)
@Controller('gym')
export class GymController {
  constructor(
    private readonly gym: GymService,
    private readonly reminders: GymRemindersService,
    private readonly classes: GymClassesService,
  ) {}

  // Classes, trainers and bookings
  @Get('trainers')
  listTrainers(@Request() req: any) {
    return this.classes.listTrainers(req.user.businessId);
  }

  @Post('trainers')
  createTrainer(@Body() body: any, @Request() req: any) {
    return this.classes.createTrainer(req.user.businessId, body);
  }

  @Put('trainers/:id')
  updateTrainer(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.classes.updateTrainer(req.user.businessId, id, body);
  }

  @Get('classes')
  listClasses(@Request() req: any) {
    return this.classes.listClasses(req.user.businessId);
  }

  @Post('classes')
  createClass(@Body() body: any, @Request() req: any) {
    return this.classes.createClass(req.user.businessId, body);
  }

  @Put('classes/:id')
  updateClass(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.classes.updateClass(req.user.businessId, id, body);
  }

  @Get('schedule')
  schedule(@Query('from') from: string, @Query('to') to: string, @Request() req: any) {
    return this.classes.schedule(req.user.businessId, from, to);
  }

  @Post('sessions')
  createExtraSession(@Body() body: any, @Request() req: any) {
    return this.classes.createExtraSession(req.user.businessId, body);
  }

  @Patch('sessions/:id/move')
  moveSession(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.classes.moveSession(req.user.businessId, id, body);
  }

  @Get('sessions/:id')
  getSession(@Param('id') id: string, @Request() req: any) {
    return this.classes.getSession(req.user.businessId, id);
  }

  @Post('sessions/:id/bookings')
  book(@Param('id') id: string, @Body('memberId') memberId: string, @Request() req: any) {
    return this.classes.book(req.user.businessId, id, memberId);
  }

  @Patch('sessions/:id/cancel')
  cancelSession(@Param('id') id: string, @Body('reason') reason: string, @Request() req: any) {
    return this.classes.cancelSession(req.user.businessId, id, reason);
  }

  @Patch('sessions/:id/restore')
  restoreSession(@Param('id') id: string, @Request() req: any) {
    return this.classes.restoreSession(req.user.businessId, id);
  }

  @Patch('bookings/:id')
  setBookingStatus(@Param('id') id: string, @Body('status') status: string, @Request() req: any) {
    return this.classes.setBookingStatus(req.user.businessId, id, status);
  }

  @Get('settings')
  getSettings(@Request() req: any) {
    return this.reminders.getSettings(req.user.businessId);
  }

  @Put('settings')
  saveSettings(@Body() body: any, @Request() req: any) {
    return this.reminders.saveSettings(req.user.businessId, body);
  }

  @Get('reminders')
  reminderLog(@Request() req: any) {
    return this.reminders.listLog(req.user.businessId);
  }

  @Get('reminders/pending')
  pendingReminders(@Request() req: any) {
    return this.reminders.preview(req.user.businessId);
  }

  @Post('reminders/run')
  runReminders(@Request() req: any) {
    return this.reminders.runForBusiness(req.user.businessId, { ignoreHour: true });
  }

  @Post('members/:id/remind')
  remind(@Param('id') id: string, @Request() req: any) {
    return this.reminders.sendManual(req.user.businessId, id);
  }

  @Get('summary')
  summary(@Request() req: any) {
    return this.gym.summary(req.user.businessId);
  }

  @Get('members/:id/access')
  access(@Param('id') id: string, @Request() req: any) {
    return this.gym.evaluateAccess(req.user.businessId, id);
  }

  @Post('check-ins')
  checkIn(@Body() body: any, @Request() req: any) {
    return this.gym.checkIn(req.user.businessId, { memberId: body.memberId, override: !!body.override, note: body.note }, req.user.id);
  }

  @Get('check-ins')
  listCheckIns(@Query() query: any, @Request() req: any) {
    return this.gym.listCheckIns(req.user.businessId, query);
  }

  @Get('plans')
  listPlans(@Request() req: any) {
    return this.gym.listPlans(req.user.businessId);
  }

  @Post('plans')
  createPlan(@Body() body: any, @Request() req: any) {
    return this.gym.createPlan(req.user.businessId, body);
  }

  @Put('plans/:id')
  updatePlan(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.gym.updatePlan(req.user.businessId, id, body);
  }

  @Get('members')
  listMembers(@Query() query: any, @Request() req: any) {
    return this.gym.listMembers(req.user.businessId, query);
  }

  @Post('members')
  createMember(@Body() body: any, @Request() req: any) {
    return this.gym.createMember(req.user.businessId, body);
  }

  @Get('members/:id')
  getMember(@Param('id') id: string, @Request() req: any) {
    return this.gym.getMember(req.user.businessId, id);
  }

  @Put('members/:id')
  updateMember(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.gym.updateMember(req.user.businessId, id, body);
  }

  @Post('members/:id/memberships')
  addMembership(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.gym.addMembership(req.user.businessId, id, body, req.user.id);
  }

  @Post('memberships/:id/payments')
  addPayment(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.gym.addPayment(req.user.businessId, id, body, req.user.id);
  }

  @Patch('memberships/:id/freeze')
  freeze(@Param('id') id: string, @Request() req: any) {
    return this.gym.freeze(req.user.businessId, id);
  }

  @Patch('memberships/:id/unfreeze')
  unfreeze(@Param('id') id: string, @Request() req: any) {
    return this.gym.unfreeze(req.user.businessId, id);
  }

  @Patch('memberships/:id/cancel')
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.gym.cancel(req.user.businessId, id);
  }
}
