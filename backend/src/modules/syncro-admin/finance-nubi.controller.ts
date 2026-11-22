import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FinanceNubiService } from './finance-nubi.service';

@Controller('syncro-admin/finance-nubi')
export class FinanceNubiController {
  constructor(private readonly nubi: FinanceNubiService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(JwtAuthGuard)
  settings(@Req() req: any) {
    return this.nubi.settings(req.user);
  }

  @Post('connect')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(JwtAuthGuard)
  connect(@Req() req: any) {
    return this.nubi.connect(req.user);
  }

  @Post('phones')
  @UseGuards(JwtAuthGuard)
  authorize(@Req() req: any, @Body() input: unknown) {
    return this.nubi.authorize(req.user, input);
  }

  @Delete('phones/:phone')
  @UseGuards(JwtAuthGuard)
  revoke(@Req() req: any, @Param('phone') phone: string) {
    return this.nubi.revoke(req.user, phone);
  }

  @Post('phones/:phone/code')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(JwtAuthGuard)
  code(@Req() req: any, @Param('phone') phone: string) {
    return this.nubi.issueCode(req.user, phone);
  }

  @Post('webhook')
  @HttpCode(200)
  webhook(@Query('token') token: unknown, @Body() payload: unknown) {
    return this.nubi.receive(token, payload);
  }
}
