import { ArgumentsHost, Body, CanActivate, Catch, Controller, ExceptionFilter, ExecutionContext, Get, HttpCode, HttpException, Injectable, Logger, Param, Post, Query, Request, UseFilters, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { GymAgentService, fail } from './gym-agent.service';

/** Koenyx sends X-Api-Key (the gym's key) and X-Gimnasio-Id (the gym's id in Syncro). */
@Injectable()
export class AgentKeyGuard implements CanActivate {
  constructor(private agent: GymAgentService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.agentBusinessId = await this.agent.authenticate(req.headers['x-api-key'] || req.headers['authorization'], req.headers['x-gimnasio-id']);
    // A tool variable the agent didn't fill ("{PARAM:CEDULA}") must never be saved as data
    for (const [field, value] of Object.entries({ ...(req.query || {}), ...(req.params || {}), ...(typeof req.body === 'object' && req.body ? req.body : {}) })) {
      if (typeof value === 'string' && UNFILLED.test(value)) {
        throw fail(400, 'dato_sin_reemplazar', `El campo ${field} llegó sin reemplazar (${value.slice(0, 60)}). Pídele el dato a la persona antes de llamar a la herramienta`);
      }
    }
    return true;
  }
}

/** {PARAM:CEDULA}, {{cedula}}, {cedula} and the like: a placeholder, not a value. */
const UNFILLED = /\{\s*PARAM\s*:|\{\{[^}]*\}\}|^\{[A-Za-z_]+\}$/i;

const CODES: Record<number, string> = { 400: 'datos_invalidos', 401: 'no_autorizado', 403: 'no_autorizado', 404: 'no_encontrado', 409: 'conflicto', 429: 'demasiadas_peticiones' };

/** Every error as {"error": "codigo", "mensaje": "texto en español"}, which the agent reads. */
@Catch()
export class AgentErrorFilter implements ExceptionFilter {
  private logger = new Logger('KoenyxAgent');
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as any;
      const mensaje = body?.mensaje ?? (Array.isArray(body?.message) ? body.message[0] : body?.message) ?? exception.message;
      const { error, mensaje: _m, message: _x, statusCode: _s, ...extra } = typeof body === 'object' && body ? body : ({} as any);
      return res.status(status).json({ error: typeof error === 'string' && /^[a-z_]+$/.test(error) ? error : CODES[status] ?? 'error', mensaje, ...extra });
    }
    this.logger.error((exception as Error)?.stack ?? String(exception));
    return res.status(500).json({ error: 'error_interno', mensaje: 'Syncro tuvo un problema al responder. Intenta de nuevo en un momento' });
  }
}

/** API for the Koenyx WhatsApp agent, following the contract Koenyx wrote. */
@SkipThrottle()
@UseGuards(AgentKeyGuard)
@UseFilters(AgentErrorFilter)
@Controller('koenyx/v1')
export class GymAgentController {
  constructor(private readonly agent: GymAgentService) {}

  @Get('contacts/lookup')
  lookup(@Query('phone') phone: string, @Request() req: any) {
    return this.agent.lookup(req.agentBusinessId, phone);
  }

  @Get('members/:id/membership')
  membership(@Param('id') id: string, @Request() req: any) {
    return this.agent.membership(req.agentBusinessId, id);
  }

  @Get('plans')
  plans(@Query('branch_id') branchId: string, @Request() req: any) {
    return this.agent.plans(req.agentBusinessId, branchId || undefined);
  }

  @Get('branches')
  branches(@Request() req: any) {
    return this.agent.branches(req.agentBusinessId);
  }

  @Get('classes')
  classes(@Query('branch_id') branchId: string, @Query('from') from: string, @Query('trial_only') trialOnly: string, @Request() req: any) {
    return this.agent.classes(req.agentBusinessId, branchId || undefined, from, trialOnly === 'true' || trialOnly === '1');
  }

  @HttpCode(200)
  @Post('classes/:id/bookings')
  booking(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.agent.booking(req.agentBusinessId, id, body);
  }

  @HttpCode(200)
  @Post('prospects/trial')
  trial(@Body() body: any, @Request() req: any) {
    return this.agent.trial(req.agentBusinessId, body);
  }

  @Get('members/:id/bookings')
  memberBookings(@Param('id') id: string, @Request() req: any) {
    return this.agent.memberBookings(req.agentBusinessId, id);
  }

  @HttpCode(200)
  @Post('prospects/:id/trial')
  changeTrial(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.agent.changeTrial(req.agentBusinessId, id, body);
  }

  @HttpCode(200)
  @Post('payments/reported')
  reportPayment(@Body() body: any, @Request() req: any) {
    return this.agent.reportPayment(req.agentBusinessId, body);
  }

  @HttpCode(200)
  @Post('conversations/handoff')
  handoff(@Body() body: any, @Request() req: any) {
    return this.agent.handoff(req.agentBusinessId, body);
  }
}
