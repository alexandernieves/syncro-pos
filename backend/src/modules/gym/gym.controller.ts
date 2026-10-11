import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GymService } from './gym.service';
import { GymRemindersService } from './gym-reminders.service';
import { GymClassesService } from './gym-classes.service';
import { GymNotificationsService } from './gym-notifications.service';
import { GymStaffGuard } from './gym-guards';
import { GymCrmService } from './gym-crm.service';
import { GymStaffService } from './gym-staff.service';
import { GymVisitsService } from './gym-visits.service';
import { DOCUMENT_STARTERS, GymDocumentsService } from './gym-documents.service';
import { GymEquipmentService } from './gym-equipment.service';
import { GymTrainingService } from './gym-training.service';
import { GymReportsService } from './gym-reports.service';
import { GymDevicesService } from './gym-devices.service';

@UseGuards(JwtAuthGuard, GymStaffGuard)
@Controller('gym')
export class GymController {
  constructor(
    private readonly gym: GymService,
    private readonly reminders: GymRemindersService,
    private readonly classes: GymClassesService,
    private readonly notices: GymNotificationsService,
    private readonly crm: GymCrmService,
    private readonly staff: GymStaffService,
    private readonly visits: GymVisitsService,
    private readonly documents: GymDocumentsService,
    private readonly equipment: GymEquipmentService,
    private readonly training: GymTrainingService,
    private readonly reports: GymReportsService,
    private readonly devices: GymDevicesService,
  ) {}

  // Face readers (Hikvision) and their local bridge
  @Get('devices')
  listDevices(@Request() req: any) {
    return this.devices.list(req.user.businessId);
  }

  @Get('devices/events')
  deviceEvents(@Query('deviceId') deviceId: string, @Request() req: any) {
    return this.devices.events(req.user.businessId, deviceId || undefined);
  }

  @Get('devices/faces')
  faceIssues(@Request() req: any) {
    return this.devices.faceIssues(req.user.businessId);
  }

  @Post('devices')
  createDevice(@Body() body: any, @Request() req: any) {
    return this.devices.create(req.user.businessId, body);
  }

  @Put('devices/:id')
  updateDevice(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.devices.update(req.user.businessId, id, body);
  }

  @Post('devices/:id/key')
  rotateDeviceKey(@Param('id') id: string, @Request() req: any) {
    return this.devices.rotateKey(req.user.businessId, id);
  }

  @Post('devices/:id/command')
  deviceCommand(@Param('id') id: string, @Body('type') type: 'OPEN_DOOR' | 'RESYNC', @Request() req: any) {
    return this.devices.command(req.user.businessId, id, type);
  }

  // Reports
  @Get('reports/attendance')
  reportAttendance(@Query('days') days: string, @Request() req: any) {
    return this.reports.attendance(req.user.businessId, days);
  }

  @Get('reports/retention')
  reportRetention(@Query('days') days: string, @Request() req: any) {
    return this.reports.retention(req.user.businessId, days);
  }

  @Get('reports/classes')
  reportClasses(@Query('days') days: string, @Request() req: any) {
    return this.reports.classes(req.user.businessId, days);
  }

  // Equipment and maintenance
  @Get('equipment/stats')
  equipmentStats(@Request() req: any) {
    return this.equipment.stats(req.user.businessId);
  }

  @Get('equipment')
  listEquipment(@Request() req: any) {
    return this.equipment.list(req.user.businessId);
  }

  @Get('equipment/:id')
  getEquipment(@Param('id') id: string, @Request() req: any) {
    return this.equipment.get(req.user.businessId, id);
  }

  @Post('equipment')
  createEquipment(@Body() body: any, @Request() req: any) {
    return this.equipment.create(req.user.businessId, body);
  }

  @Put('equipment/:id')
  updateEquipment(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.equipment.update(req.user.businessId, id, body);
  }

  @Post('maintenance')
  reportMaintenance(@Body() body: any, @Request() req: any) {
    return this.equipment.report(req.user.businessId, body, req.user.name);
  }

  @Patch('maintenance/:id')
  maintenanceStatus(@Param('id') id: string, @Body('status') status: 'OPEN' | 'IN_PROGRESS', @Request() req: any) {
    return this.equipment.setStatus(req.user.businessId, id, status);
  }

  @Post('maintenance/:id/complete')
  completeMaintenance(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.equipment.complete(req.user.businessId, id, body, req.user.id);
  }

  // Training: exercises, routines, workouts, assessments
  @Get('exercises')
  listExercises(@Request() req: any) {
    return this.training.listExercises(req.user.businessId);
  }

  @Post('exercises')
  createExercise(@Body() body: any, @Request() req: any) {
    return this.training.saveExercise(req.user.businessId, null, body);
  }

  @Put('exercises/:id')
  updateExercise(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.training.saveExercise(req.user.businessId, id, body);
  }

  @Get('routines')
  listRoutines(@Request() req: any) {
    return this.training.listTemplates(req.user.businessId);
  }

  @Post('routines')
  createRoutine(@Body() body: any, @Request() req: any) {
    return this.training.createTemplate(req.user.businessId, body);
  }

  @Put('routines/:id')
  updateRoutine(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.training.updateRoutine(req.user.businessId, id, body);
  }

  @Get('members/:id/training')
  memberTraining(@Param('id') id: string, @Request() req: any) {
    return this.training.memberTraining(req.user.businessId, id);
  }

  @Post('members/:id/routine')
  assignRoutine(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.training.assign(req.user.businessId, id, body);
  }

  @Post('members/:id/routine/send')
  sendRoutine(@Param('id') id: string, @Body('text') text: string, @Request() req: any) {
    if (!text?.trim()) throw new BadRequestException('No hay rutina para enviar');
    return this.notices.sendToMember(req.user.businessId, id, 'ROUTINE', text.trim());
  }

  @Post('members/:id/workouts')
  logWorkout(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.training.logWorkout(req.user.businessId, id, body);
  }

  @Get('assessments')
  recentAssessments(@Request() req: any) {
    return this.training.recentAssessments(req.user.businessId);
  }

  @Get('members/:id/assessments')
  memberAssessments(@Param('id') id: string, @Request() req: any) {
    return this.training.assessments(req.user.businessId, id);
  }

  @Post('members/:id/assessments')
  addAssessment(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.training.addAssessment(req.user.businessId, id, body);
  }

  @Put('assessments/:id')
  updateAssessment(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.training.updateAssessment(req.user.businessId, id, body);
  }

  @Delete('assessments/:id')
  deleteAssessment(@Param('id') id: string, @Request() req: any) {
    return this.training.deleteAssessment(req.user.businessId, id);
  }

  // Contracts and consents
  @Get('documents/starters')
  documentStarters() {
    return DOCUMENT_STARTERS;
  }

  @Get('documents')
  listDocuments(@Request() req: any) {
    return this.documents.listTemplates(req.user.businessId);
  }

  @Post('documents')
  createDocument(@Body() body: any, @Request() req: any) {
    return this.documents.createTemplate(req.user.businessId, body);
  }

  @Put('documents/:id')
  updateDocument(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.documents.updateTemplate(req.user.businessId, id, body);
  }

  @Get('members/:id/documents')
  memberDocuments(@Param('id') id: string, @Request() req: any) {
    return this.documents.forMember(req.user.businessId, id);
  }

  @Get('members/:id/documents/:templateId')
  renderDocument(@Param('id') id: string, @Param('templateId') templateId: string, @Request() req: any) {
    return this.documents.render(req.user.businessId, templateId, id).then((r) => ({ title: r.template.title, version: r.template.version, body: r.body }));
  }

  @Post('members/:id/documents/:templateId/sign')
  signDocument(@Param('id') id: string, @Param('templateId') templateId: string, @Body() body: any, @Request() req: any) {
    return this.documents.sign(req.user.businessId, templateId, id, body, { method: 'RECEPTION', ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Get('signatures/:id')
  getSignature(@Param('id') id: string, @Request() req: any) {
    return this.documents.getSignature(req.user.businessId, id);
  }

  // Prospects (CRM) and trial classes
  @Get('leads/stats')
  leadStats(@Request() req: any) {
    return this.crm.stats(req.user.businessId);
  }

  @Get('leads/duplicate')
  leadDuplicate(@Query('phone') phone: string, @Query('documentId') documentId: string, @Query('except') except: string, @Request() req: any) {
    // Always an object: an empty body would read as a duplicate on the screen
    return this.crm.findDuplicate(req.user.businessId, { phone, documentId }, except || undefined).then((duplicate) => ({ duplicate }));
  }

  @Get('leads')
  listLeads(@Query() query: any, @Request() req: any) {
    return this.crm.list(req.user.businessId, query);
  }

  @Get('leads/:id')
  getLead(@Param('id') id: string, @Request() req: any) {
    return this.crm.get(req.user.businessId, id);
  }

  @Post('leads')
  createLead(@Body() body: any, @Request() req: any) {
    return this.crm.create(req.user.businessId, body, req.user.name);
  }

  @Put('leads/:id')
  updateLead(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.crm.update(req.user.businessId, id, body, req.user.name);
  }

  @Post('leads/:id/activities')
  addLeadActivity(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.crm.addActivity(req.user.businessId, id, body, req.user.name);
  }

  @Post('leads/:id/trial')
  scheduleTrial(@Param('id') id: string, @Body('sessionId') sessionId: string, @Request() req: any) {
    return this.crm.scheduleTrial(req.user.businessId, id, sessionId, req.user.name);
  }

  @Post('leads/:id/trial-result')
  trialResult(@Param('id') id: string, @Body('attended') attended: boolean, @Request() req: any) {
    return this.crm.trialResult(req.user.businessId, id, !!attended, req.user.name);
  }

  @Post('leads/:id/message')
  messageLead(@Param('id') id: string, @Body('text') text: string, @Request() req: any) {
    return this.crm.message(req.user.businessId, id, text, req.user.name);
  }

  @Post('leads/:id/convert')
  convertLead(@Param('id') id: string, @Request() req: any) {
    return this.crm.convert(req.user.businessId, id, req.user.name);
  }

  // Staff: availability and shifts
  @Put('trainers/:id/availability')
  setAvailability(@Param('id') id: string, @Body('rows') rows: any[], @Request() req: any) {
    return this.staff.setAvailability(req.user.businessId, id, rows);
  }

  @Get('shifts/on-duty')
  onDuty(@Request() req: any) {
    return this.staff.onDuty(req.user.businessId);
  }

  @Get('shifts')
  listShifts(@Query('from') from: string, @Query('to') to: string, @Request() req: any) {
    return this.staff.listShifts(req.user.businessId, from, to);
  }

  @Post('shifts/copy-week')
  copyWeek(@Body('from') from: string, @Body('to') to: string, @Request() req: any) {
    return this.staff.copyWeek(req.user.businessId, from, to);
  }

  @Post('shifts')
  createShift(@Body() body: any, @Request() req: any) {
    return this.staff.createShift(req.user.businessId, body);
  }

  @Put('shifts/:id')
  updateShift(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.staff.updateShift(req.user.businessId, id, body);
  }

  @Delete('shifts/:id')
  deleteShift(@Param('id') id: string, @Request() req: any) {
    return this.staff.deleteShift(req.user.businessId, id);
  }

  @Post('shifts/:id/punch')
  punch(@Param('id') id: string, @Body('action') action: 'in' | 'out' | 'absent' | 'reset', @Request() req: any) {
    return this.staff.punch(req.user.businessId, id, action);
  }

  // Visits: guests, day passes, visitors
  @Get('visits')
  listVisits(@Query('day') day: string, @Request() req: any) {
    return this.visits.list(req.user.businessId, day || undefined);
  }

  @Post('visits')
  createVisit(@Body() body: any, @Request() req: any) {
    return this.visits.create(req.user.businessId, body, req.user.id, req.user.name);
  }

  @Post('visits/:id/checkout')
  checkoutVisit(@Param('id') id: string, @Request() req: any) {
    return this.visits.checkout(req.user.businessId, id);
  }

  @Get('members/:id/quote')
  quote(@Param('id') id: string, @Query('planId') planId: string, @Query('startDate') startDate: string, @Request() req: any) {
    return this.gym.quoteMembership(req.user.businessId, id, planId, startDate || undefined);
  }

  @Get('members/:id/guest-quota')
  guestQuota(@Param('id') id: string, @Request() req: any) {
    return this.visits.guestQuota(req.user.businessId, id);
  }

  @Get('notifications')
  listNotifications(@Query('sessionId') sessionId: string, @Request() req: any) {
    return this.notices.list(req.user.businessId, sessionId || undefined);
  }

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
  freeze(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.gym.freeze(req.user.businessId, id, body || {}, req.user.id);
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
