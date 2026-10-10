import { Body, CanActivate, Controller, ExecutionContext, Get, Injectable, Post, Request, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { GymDevicesService } from './gym-devices.service';

/** The local bridge signs every request with its device key (header x-device-key). No user session. */
@Injectable()
export class DeviceKeyGuard implements CanActivate {
  constructor(private devices: GymDevicesService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.device = await this.devices.authenticate(req.headers['x-device-key']);
    return true;
  }
}

/** API for gym-bridge, the program on the gym's server that talks to the face reader. */
@SkipThrottle()
@UseGuards(DeviceKeyGuard)
@Controller('gym/bridge')
export class GymBridgeController {
  constructor(private readonly devices: GymDevicesService) {}

  @Post('heartbeat')
  heartbeat(@Body() body: any, @Request() req: any) {
    return this.devices.heartbeat(req.device, body?.status);
  }

  @Get('roster')
  roster(@Request() req: any) {
    return this.devices.roster(req.device);
  }

  @Post('roster/result')
  rosterResult(@Body() body: any, @Request() req: any) {
    return this.devices.rosterResult(req.device, body?.results);
  }

  @Post('events')
  events(@Body() body: any, @Request() req: any) {
    return this.devices.ingestEvents(req.device, body?.events);
  }
}
