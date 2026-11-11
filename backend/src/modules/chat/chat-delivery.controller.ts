import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChatGateway, readDeliveryToken } from './chat.gateway';

/**
 * The service worker calls this when a support notification reached the device (Syncro may be
 * closed, so there's no login): the signed token says which message, nothing else.
 */
@Controller('chat-delivery')
export class ChatDeliveryController {
  constructor(private readonly gateway: ChatGateway) {}

  @Post(':token')
  @HttpCode(204)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async delivered(@Param('token') token: string) {
    const id = readDeliveryToken(token);
    if (id) await this.gateway.markDelivered({ id });
  }
}
