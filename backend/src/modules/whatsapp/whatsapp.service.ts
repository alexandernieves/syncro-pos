import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppGateway } from './whatsapp.gateway';
import { AiAgentService } from '../ai-agent/ai-agent.service';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger('WhatsAppService');
  private readonly sentMessageIds = new Set<string>();
  private readonly botSessionMessageIds = new Map<string, string[]>();
  private readonly botPhones = new Map<string, string>();

  constructor(
    private prisma: PrismaService,
    private gateway: WhatsAppGateway,
    private aiAgentService: AiAgentService,
  ) {}

  /**
   * Returns Evolution API connection params for the CUSTOMER CHAT module.
   * Instance name: "syncropos-{businessId}"  (unchanged, backward-compatible)
   */
  private getUrlAndKey(businessId: string) {
    const url = (process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
    const apiKey = process.env.EVOLUTION_API_KEY || 'apikey123';
    const instance = `syncropos-${businessId}`;
    return { url, apiKey, instance };
  }

  /**
   * Returns Evolution API connection params for the AI BOT.
   * Instance name: "syncropos-bot-{businessId}"  — completely separate from chat.
   */
  private getBotUrlAndKey(businessId: string) {
    const url = (process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
    const apiKey = process.env.EVOLUTION_API_KEY || 'apikey123';
    const instance = `syncropos-bot-${businessId}`;
    return { url, apiKey, instance };
  }

  async getStatus(businessId: string) {
    const { url, apiKey, instance } = this.getUrlAndKey(businessId);
    try {
      const res = await fetch(`${url}/instance/connectionState/${instance}`, {
        headers: { apikey: apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        const connected = data.instance?.state === 'open';
        if (connected) {
          this.ensureChatWebhook(businessId).catch(() => {});
        }
        return { connected, state: data.instance?.state };
      }
      return { connected: false, state: 'DISCONNECTED' };
    } catch (e) {
      this.logger.error(`Error checking Evolution status for business ${businessId}: ${e.message}`);
      return { connected: false, state: 'ERROR', error: e.message };
    }
  }

  async getQrCode(businessId: string) {
    const { url, apiKey, instance } = this.getUrlAndKey(businessId);
    try {
      const statusRes = await this.getStatus(businessId);
      if (statusRes.connected) {
        return { status: 'CONNECTED' };
      }

      this.ensureChatWebhook(businessId).catch(() => {});

      const res = await fetch(`${url}/instance/connect/${instance}`, {
        headers: { apikey: apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        const qrValue = data.qrcode?.base64 || data.base64 || data.qrcode?.code || data.code;
        return { status: 'QR', qr: qrValue };
      }

      this.logger.log(`Instance ${instance} may not exist. Attempting to create it...`);
      await this.createChatInstance(businessId);

      const retryRes = await fetch(`${url}/instance/connect/${instance}`, {
        headers: { apikey: apiKey },
      });
      if (retryRes.ok) {
        const data = await retryRes.json();
        const qrValue = data.qrcode?.base64 || data.base64 || data.qrcode?.code || data.code;
        return { status: 'QR', qr: qrValue };
      }

      return { status: 'ERROR', message: 'No se pudo conectar con la API de WhatsApp' };
    } catch (e) {
      this.logger.error(`Error getting QR code for business ${businessId}: ${e.message}`);
      return { status: 'ERROR', message: e.message };
    }
  }

  /** Creates the Evolution API instance for the CUSTOMER CHAT module. */
  async createChatInstance(businessId: string) {
    const { url, apiKey, instance } = this.getUrlAndKey(businessId);
    const backendBase = process.env.BACKEND_WEBHOOK_URL?.replace('/whatsapp/webhook', '') || 'http://host.docker.internal:9000';
    const webhookUrl = `${backendBase}/whatsapp/webhook?businessId=${businessId}`;
    try {
      const res = await fetch(`${url}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ instanceName: instance, token: apiKey, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
      });
      if (res.ok) {
        await fetch(`${url}/webhook/set/${instance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: apiKey },
          body: JSON.stringify({ webhook: { enabled: true, url: webhookUrl, byEvents: false, events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'] } }),
        }).catch((e) => this.logger.error(`Webhook config failed: ${e.message}`));
      }
      return res.ok;
    } catch (e) {
      this.logger.error(`Error creating chat instance for business ${businessId}: ${e.message}`);
      return false;
    }
  }

  // ─── BOT-SPECIFIC METHODS (separate instance, no DB chat records) ────────

  async getBotStatus(businessId: string) {
    const { url, apiKey, instance } = this.getBotUrlAndKey(businessId);
    try {
      const fetchRes = await fetch(`${url}/instance/fetchInstances`, {
        headers: { apikey: apiKey },
      });
      if (fetchRes.ok) {
        const instances = await fetchRes.json();
        const currentInstance = instances.find((inst: any) => inst.name === instance);
        if (currentInstance && currentInstance.ownerJid) {
          const cleanOwnerPhone = currentInstance.ownerJid.split('@')[0].replace(/\D/g, '');
          this.botPhones.set(businessId, cleanOwnerPhone);
        }
      }

      const res = await fetch(`${url}/instance/connectionState/${instance}`, {
        headers: { apikey: apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        const connected = data.instance?.state === 'open';
        if (connected) {
          this.ensureBotWebhook(businessId).catch(() => {});
        }
        return { connected, state: data.instance?.state };
      }
      return { connected: false, state: 'DISCONNECTED' };
    } catch (e) {
      this.logger.error(`[Bot] Error checking status for business ${businessId}: ${e.message}`);
      return { connected: false, state: 'ERROR', error: e.message };
    }
  }

  async getBotQrCode(businessId: string) {
    const { url, apiKey, instance } = this.getBotUrlAndKey(businessId);
    try {
      const statusRes = await this.getBotStatus(businessId);
      if (statusRes.connected) return { status: 'CONNECTED' };

      this.ensureBotWebhook(businessId).catch(() => {});

      const res = await fetch(`${url}/instance/connect/${instance}`, {
        headers: { apikey: apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        const qrValue = data.qrcode?.base64 || data.base64 || data.qrcode?.code || data.code;
        return { status: 'QR', qr: qrValue };
      }

      this.logger.log(`[Bot] Instance ${instance} may not exist. Creating...`);
      await this.createBotInstance(businessId);

      const retryRes = await fetch(`${url}/instance/connect/${instance}`, {
        headers: { apikey: apiKey },
      });
      if (retryRes.ok) {
        const data = await retryRes.json();
        const qrValue = data.qrcode?.base64 || data.base64 || data.qrcode?.code || data.code;
        return { status: 'QR', qr: qrValue };
      }
      return { status: 'ERROR', message: 'No se pudo conectar con la API de WhatsApp' };
    } catch (e) {
      this.logger.error(`[Bot] Error getting QR for business ${businessId}: ${e.message}`);
      return { status: 'ERROR', message: e.message };
    }
  }

  async createBotInstance(businessId: string) {
    const { url, apiKey, instance } = this.getBotUrlAndKey(businessId);
    const backendBase = process.env.BACKEND_WEBHOOK_URL?.replace('/whatsapp/webhook', '') || 'http://host.docker.internal:9000';
    // Bot uses a dedicated webhook endpoint so messages don't mix with customer chat
    const webhookUrl = `${backendBase}/whatsapp/bot-webhook?businessId=${businessId}`;
    try {
      const res = await fetch(`${url}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({
          instanceName: instance,
          token: apiKey,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      });
      if (res.ok) {
        this.logger.log(`[Bot] Instance ${instance} created. Webhook: ${webhookUrl}`);
        await fetch(`${url}/webhook/set/${instance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: apiKey },
          body: JSON.stringify({
            webhook: {
              enabled: true,
              url: webhookUrl,
              byEvents: false,
              events: ['MESSAGES_UPSERT'],
            },
          }),
        }).catch((e) => this.logger.error(`[Bot] Webhook config failed: ${e.message}`));
      }
      return res.ok;
    } catch (e) {
      this.logger.error(`[Bot] Error creating instance for business ${businessId}: ${e.message}`);
      return false;
    }
  }

  async ensureChatWebhook(businessId: string) {
    const { url, apiKey, instance } = this.getUrlAndKey(businessId);
    const backendBase = process.env.BACKEND_WEBHOOK_URL?.replace('/whatsapp/webhook', '') || 'http://host.docker.internal:9000';
    const webhookUrl = `${backendBase}/whatsapp/webhook?businessId=${businessId}`;
    try {
      await fetch(`${url}/webhook/set/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'],
          },
        }),
      });
    } catch (e) {
      this.logger.error(`Failed to ensure chat webhook for ${businessId}: ${e.message}`);
    }
  }

  async ensureBotWebhook(businessId: string) {
    const { url, apiKey, instance } = this.getBotUrlAndKey(businessId);
    const backendBase = process.env.BACKEND_WEBHOOK_URL?.replace('/whatsapp/webhook', '') || 'http://host.docker.internal:9000';
    const webhookUrl = `${backendBase}/whatsapp/bot-webhook?businessId=${businessId}`;
    try {
      await fetch(`${url}/webhook/set/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            events: ['MESSAGES_UPSERT'],
          },
        }),
      });
    } catch (e) {
      this.logger.error(`[Bot] Failed to ensure bot webhook for ${businessId}: ${e.message}`);
    }
  }

  async logoutBotInstance(businessId: string) {
    const { url, apiKey, instance } = this.getBotUrlAndKey(businessId);
    try {
      const res = await fetch(`${url}/instance/logout/${instance}`, {
        method: 'POST',
        headers: { apikey: apiKey },
      });
      if (res.ok) return { success: true };
      const del = await fetch(`${url}/instance/delete/${instance}`, {
        method: 'DELETE',
        headers: { apikey: apiKey },
      });
      return { success: del.ok };
    } catch (e) {
      this.logger.error(`[Bot] Logout error for business ${businessId}: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  async sendBotTextMessage(phone: string, text: string, businessId: string) {
    const { url, apiKey, instance } = this.getBotUrlAndKey(businessId);
    const cleanPhone = phone.replace(/\D/g, '');
    try {
      const res = await fetch(`${url}/message/sendText/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ number: cleanPhone, text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error al enviar por Evolution API (bot)');
      }
      const data = await res.json();
      const msgId = data.key?.id;
      if (msgId) {
        this.sentMessageIds.add(msgId);
        const sessionKey = `bot-${cleanPhone}-${businessId}`;
        if (this.botSessionMessageIds.has(sessionKey)) {
          this.botSessionMessageIds.get(sessionKey)!.push(msgId);
        }
      }
      return { success: true, key: data.key, messageId: msgId };
    } catch (e) {
      this.logger.error(`[Bot] Error sending to ${phone} (business ${businessId}): ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  private trackSessionMessage(businessId: string, phone: string, messageId: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    const sessionKey = `bot-${cleanPhone}-${businessId}`;
    if (!this.botSessionMessageIds.has(sessionKey)) {
      this.botSessionMessageIds.set(sessionKey, []);
    }
    this.botSessionMessageIds.get(sessionKey)!.push(messageId);
  }

  private cleanupBotSessionMessages(businessId: string, phone: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    const sessionKey = `bot-${cleanPhone}-${businessId}`;
    const messageIds = this.botSessionMessageIds.get(sessionKey);
    if (!messageIds || messageIds.length === 0) return;

    this.botSessionMessageIds.delete(sessionKey);

    const farewellId = messageIds[messageIds.length - 1];
    const otherIds = messageIds.slice(0, -1);

    // Delete all conversation messages immediately
    for (const msgId of otherIds) {
      this.deleteMessageForEveryone(phone, msgId, businessId).catch((err) => {
        this.logger.error(`[Bot] Error deleting session message ${msgId}: ${err.message}`);
      });
    }

    // Delete the farewell message after 5 seconds to give time to read it
    if (farewellId) {
      setTimeout(() => {
        this.deleteMessageForEveryone(phone, farewellId, businessId).catch((err) => {
          this.logger.error(`[Bot] Error deleting farewell message ${farewellId}: ${err.message}`);
        });
        for (const msgId of messageIds) {
          this.sentMessageIds.delete(msgId);
        }
      }, 5000);
    } else {
      for (const msgId of messageIds) {
        this.sentMessageIds.delete(msgId);
      }
    }
  }

  async deleteMessageForEveryone(phone: string, messageId: string, businessId: string) {
    const { url, apiKey, instance } = this.getBotUrlAndKey(businessId);
    const cleanPhone = phone.replace(/\D/g, '');
    const remoteJid = `${cleanPhone}@s.whatsapp.net`;
    try {
      const res = await fetch(`${url}/chat/deleteMessageForEveryone/${instance}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({
          remoteJid,
          id: messageId,
          fromMe: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        this.logger.error(`[Bot] Failed to delete message ${messageId}: ${err.message || res.statusText}`);
      }
    } catch (e) {
      this.logger.error(`[Bot] Error deleting message ${messageId}: ${e.message}`);
    }
  }

  /**
   * Webhook handler for BOT instance messages.
   * Only handles AI activation / deactivation / responses.
   * Does NOT write to WhatsApp chat DB tables.
   */
  async handleBotWebhook(body: any, businessId: string) {
    if (!businessId) return { success: false, error: 'Missing businessId' };

    const event = body.event;
    if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') return { success: true, ignored: true };

    const messageData = body.data;
    if (!messageData?.key) return { success: false, error: 'Invalid payload' };

    const remoteJid = messageData.key.remoteJid;
    if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast') || remoteJid.includes('@lid')) {
      return { success: true, ignored: true };
    }

    const rawPhone = remoteJid.split('@')[0].split(':')[0];
    const phone = rawPhone.replace(/\D/g, '');
    const fromMe = messageData.key.fromMe || false;

    // Ignore bot's own replies sent via API
    if (fromMe && this.sentMessageIds.has(messageData.key.id)) {
      return { success: true, ignored: true };
    }

    let botPhone = this.botPhones.get(businessId);
    if (!botPhone) {
      const { url, apiKey, instance } = this.getBotUrlAndKey(businessId);
      try {
        const fetchRes = await fetch(`${url}/instance/fetchInstances`, {
          headers: { apikey: apiKey },
        });
        if (fetchRes.ok) {
          const instances = await fetchRes.json();
          const currentInstance = instances.find((inst: any) => inst.name === instance);
          if (currentInstance && currentInstance.ownerJid) {
            botPhone = currentInstance.ownerJid.split('@')[0].split(':')[0].replace(/\D/g, '');
            this.botPhones.set(businessId, botPhone!);
          }
        }
      } catch (e) {
        this.logger.error(`[Bot] Error fetching instance for owner phone: ${e.message}`);
      }
    }

    if (fromMe) {
      // Only process fromMe messages if it is a chat with the bot's own number (self-chat)
      if (!botPhone || phone !== botPhone) {
        return { success: true, ignored: true };
      }
    }

    const msg = messageData.message;
    if (!msg) return { success: true, ignored: true };

    let text = msg.conversation || msg.extendedTextMessage?.text || '';
    if (!text || typeof text !== 'string') return { success: true, ignored: true };

    this.logger.log(`[Bot Webhook] Message from ${phone} (fromMe: ${fromMe}): "${text}"`);

    try {
      const setting = await this.prisma.setting.findFirst({ where: { businessId } });
      if (!setting?.whatsappBotEnabled) {
        this.logger.warn(`[Bot Webhook] Ignored: whatsappBotEnabled is false for business ${businessId}`);
        return { success: true, ignored: true };
      }

      const cleanPhone = phone;
      const isAuthorized = fromMe || setting.whatsappAuthorizedPhones.some(
        (p) => p.replace(/\D/g, '') === cleanPhone,
      );
      if (!isAuthorized) {
        this.logger.warn(`[Bot Webhook] Ignored: Phone ${cleanPhone} is not authorized for business ${businessId}. Authorized phones: ${JSON.stringify(setting.whatsappAuthorizedPhones)}`);
        return { success: true, ignored: true };
      }

      const user = await this.prisma.user.findFirst({
        where: { businessId, role: { in: ['admin', 'owner'] } },
      }) || await this.prisma.user.findFirst({ where: { businessId } });
      if (!user) return { success: true, ignored: true };

      let branchId: string | undefined = user.branchIds?.[0];
      if (!branchId) {
        const branch = await this.prisma.branch.findFirst({ where: { businessId } });
        branchId = branch?.id;
      }
      if (!branchId) return { success: true, ignored: true };
      const confirmedBranchId = branchId;

      const cleanMsg = text.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // Use a virtual chat key in the DB just for session state (no visible chat record in UI)
      const sessionKey = `bot-${cleanPhone}-${businessId}`;
      let botChat = await this.prisma.whatsAppChat.findFirst({
        where: { phone: sessionKey, businessId },
      });

      if (!botChat?.whatsappBotSessionActive) {
        // Not in AI session — look for activation keyword
        if (cleanMsg === 'syncroai') {
          if (!botChat) {
            botChat = await this.prisma.whatsAppChat.create({
              data: { phone: sessionKey, businessId, name: '_bot_session_', whatsappBotSessionActive: true },
              include: { client: true },
            });
          } else {
            await this.prisma.whatsAppChat.update({
              where: { id: botChat.id },
              data: { whatsappBotSessionActive: true },
            });
          }

          // Initialize message ID tracking list
          this.botSessionMessageIds.set(sessionKey, []);

          // Track the user's initial triggering message ("syncroai")
          if (messageData.key.id) {
            this.trackSessionMessage(businessId, phone, messageData.key.id);
          }

          const welcomeRes = await this.sendBotTextMessage(phone, '🤖 *Syncro IA activada.*\n¿En qué te puedo ayudar hoy?\n\n_Escribe *salir* para desactivarme._', businessId);
          if (welcomeRes?.messageId) {
            this.trackSessionMessage(businessId, phone, welcomeRes.messageId);
          }
        }
        return { success: true };
      }

      // In AI session

      // Track the user's incoming query / command
      if (messageData.key.id) {
        this.trackSessionMessage(businessId, phone, messageData.key.id);
      }

      const sessionId = `bot-${cleanPhone}`;

      if (cleanMsg === 'activa ads') {
        await this.prisma.aiChatSession.upsert({
          where: { id: sessionId },
          update: { type: 'ADS_COPILOT' },
          create: { id: sessionId, businessId, userId: user.id, title: 'WhatsApp Bot Session', type: 'ADS_COPILOT' }
        });
        const welcomeAds = await this.sendBotTextMessage(phone, '🤖 *Modo Ads activado.*\nAhora responderé basándome en tu biblioteca de entrenamiento de anuncios.\n\n_Escribe *salir ads* para volver al modo general o *salir* para desactivarme._', businessId);
        if (welcomeAds?.messageId) {
          this.trackSessionMessage(businessId, phone, welcomeAds.messageId);
        }
        return { success: true };
      }

      if (cleanMsg === 'salir ads') {
        await this.prisma.aiChatSession.upsert({
          where: { id: sessionId },
          update: { type: 'GENERAL' },
          create: { id: sessionId, businessId, userId: user.id, title: 'WhatsApp Bot Session', type: 'GENERAL' }
        });
        const goodbyeAds = await this.sendBotTextMessage(phone, '🤖 *Modo Ads desactivado.*\nHe regresado al asistente general de Syncro POS.', businessId);
        if (goodbyeAds?.messageId) {
          this.trackSessionMessage(businessId, phone, goodbyeAds.messageId);
        }
        return { success: true };
      }

      if (['salir', 'desactivar', 'chao', 'adios', 'bye'].includes(cleanMsg)) {
        await this.prisma.whatsAppChat.update({
          where: { id: botChat.id },
          data: { whatsappBotSessionActive: false },
        });
        await this.prisma.whatsAppPendingAction.deleteMany({ where: { phone: cleanPhone, businessId } });
        
        await this.prisma.aiChatSession.upsert({
          where: { id: sessionId },
          update: { type: 'GENERAL' },
          create: { id: sessionId, businessId, userId: user.id, title: 'WhatsApp Bot Session', type: 'GENERAL' }
        }).catch(() => {});

        const farewellRes = await this.sendBotTextMessage(phone, '👋 *Syncro IA desactivada.*\nConversación normal restaurada.', businessId);
        if (farewellRes?.messageId) {
          this.trackSessionMessage(businessId, phone, farewellRes.messageId);
        }
 
        // Trigger message cleanup!
        this.cleanupBotSessionMessages(businessId, phone);
 
        return { success: true };
      }

      await this.processBotAiResponse(cleanPhone, text, businessId, user.id, confirmedBranchId);
    } catch (err) {
      this.logger.error(`[Bot] Error processing bot webhook: ${err.message}`, err.stack);
    }
    return { success: true };
  }

  private async processBotAiResponse(
    phone: string,
    text: string,
    businessId: string,
    userId: string,
    branchId: string,
  ) {
    const cleanMsg = text.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const pendingAction = await this.prisma.whatsAppPendingAction.findFirst({
      where: { phone, businessId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (pendingAction) {
      if (['si', 'yes', 'confirmar', 'confirm'].includes(cleanMsg)) {
        try {
          const actionObj = JSON.parse(pendingAction.actionJson);
          const result = await this.aiAgentService.confirmAction(userId, businessId, branchId, actionObj);
          await this.prisma.whatsAppPendingAction.delete({ where: { id: pendingAction.id } });
          await this.sendBotTextMessage(phone, result.message, businessId);
        } catch (e) {
          this.logger.error(`[Bot] Confirm action error: ${e.message}`);
          await this.sendBotTextMessage(phone, '⚠️ Ocurrió un error al confirmar la acción.', businessId);
        }
      } else if (['no', 'cancelar', 'cancel'].includes(cleanMsg)) {
        await this.prisma.whatsAppPendingAction.delete({ where: { id: pendingAction.id } }).catch(() => {});
        await this.sendBotTextMessage(phone, '❌ Acción cancelada.', businessId);
      } else {
        await this.sendBotTextMessage(phone, '⚠️ Tienes una acción pendiente. Responde *SI* para confirmar o *NO* para cancelar.', businessId);
      }
      return;
    }

    try {
      const sessionId = `bot-${phone}`;
      const aiResponse = await this.aiAgentService.chat(userId, businessId, text, sessionId);
      if (aiResponse.action) {
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);
        await this.prisma.whatsAppPendingAction.create({
          data: { phone, businessId, userId, branchId, actionJson: JSON.stringify(aiResponse.action), expiresAt },
        });
        await this.sendBotTextMessage(phone, `${aiResponse.message}\n\nResponde *SI* para confirmar o *NO* para cancelar.`, businessId);
      } else {
        await this.sendBotTextMessage(phone, aiResponse.message, businessId);
      }
    } catch (e) {
      this.logger.error(`[Bot] AI agent error: ${e.message}`);
      await this.sendBotTextMessage(phone, '⚠️ Lo siento, ocurrió un error al procesar tu solicitud.', businessId);
    }
  }

  // ─── END BOT METHODS ────────────────────────────────────────────────────

  async sendTextMessage(phone: string, text: string, businessId: string, agentId?: string) {
    const { url, apiKey, instance } = this.getUrlAndKey(businessId);
    const cleanPhone = phone.replace(/\D/g, '');

    try {
      const res = await fetch(`${url}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({ number: cleanPhone, text }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Error al enviar por Evolution API');
      }

      const responseData = await res.json();
      const whatsappMsgId = responseData.key?.id || null;

      const chat = await this.findOrCreateChat(cleanPhone, businessId);

      const message = await this.prisma.whatsAppMessage.create({
        data: {
          chatId: chat.id,
          senderType: 'AGENT',
          agentId: agentId || null,
          text,
          type: 'text',
          status: 'SENT',
          whatsappMsgId,
        },
      });

      this.gateway.emitNewMessage({ ...message, businessId });
      this.gateway.emitChatUpdated({ ...chat, lastMessage: text, updatedAt: new Date(), businessId });

      return message;
    } catch (e) {
      this.logger.error(`Error sending message to ${phone} (business ${businessId}): ${e.message}`);
      throw new BadRequestException(`No se pudo enviar el mensaje: ${e.message}`);
    }
  }

  async handleWebhook(body: any, businessId: string) {
    if (!businessId) {
      this.logger.warn('Webhook received without businessId — ignoring');
      return { success: false, error: 'Missing businessId' };
    }

    const event = body.event;

    // Process message status updates (Delivered, Read, Played)
    if (event === 'messages.update' || event === 'MESSAGES_UPDATE') {
      const updateData = body.data;
      if (updateData && Array.isArray(updateData)) {
        for (const upd of updateData) {
          if (upd.key && upd.update) {
            await this.processMessageStatusUpdate(upd.key.id, upd.update.status);
          }
        }
      } else if (updateData && updateData.key && updateData.update) {
        await this.processMessageStatusUpdate(updateData.key.id, updateData.update.status);
      }
      return { success: true, updated: true };
    }

    if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') return { success: true, ignored: true };

    const messageData = body.data;
    if (!messageData || !messageData.key) return { success: false, error: 'Invalid payload' };

    const remoteJid = messageData.key.remoteJid;
    if (!remoteJid || !remoteJid.endsWith('@s.whatsapp.net')) return { success: true, ignored: true };

    const phone = remoteJid.split('@')[0];
    const fromMe = messageData.key.fromMe || false;
    const whatsappMsgId = messageData.key.id;

    let text = '';
    let type = 'text';
    const mediaUrl = null;

    const msg = messageData.message;
    if (!msg) return { success: true, ignored: true };

    if (msg.conversation) {
      text = msg.conversation;
    } else if (msg.extendedTextMessage?.text) {
      text = msg.extendedTextMessage.text;
    } else if (msg.imageMessage) {
      text = msg.imageMessage.caption || 'Imagen';
      type = 'image';
    } else if (msg.audioMessage) {
      text = 'Nota de voz';
      type = 'audio';
    } else if (msg.videoMessage) {
      text = msg.videoMessage.caption || 'Video';
      type = 'video';
    } else if (msg.documentMessage) {
      text = msg.documentMessage.title || 'Documento';
      type = 'document';
    } else {
      text = 'Mensaje de WhatsApp';
    }

    // Get/Create Chat scoped to this business
    const chatName = !fromMe ? (body.data.pushName || null) : null;
    let chat = await this.findOrCreateChat(phone, businessId, chatName);

    // Update name if it was generic or missing
    if (!fromMe && body.data.pushName && (chat.name === '💻' || chat.name?.startsWith('Contacto ') || chat.name === chat.phone || !chat.name)) {
      chat = await this.prisma.whatsAppChat.update({
        where: { id: chat.id },
        data: { name: body.data.pushName },
        include: { client: true },
      });
    }

    const senderType = fromMe ? 'AGENT' : 'CLIENT';
    const message = await this.prisma.whatsAppMessage.create({
      data: {
        chatId: chat.id,
        senderType,
        text,
        type,
        mediaUrl,
        status: 'DELIVERED',
        whatsappMsgId,
      },
    });

    this.gateway.emitNewMessage({ ...message, businessId });
    this.gateway.emitChatUpdated({ ...chat, lastMessage: text, updatedAt: new Date(), businessId });

    // AI Bot Integration
    if (!fromMe && type === 'text') {
      this.prisma.setting.findFirst({
        where: { businessId },
      }).then(async (setting) => {
        if (setting && setting.whatsappBotEnabled) {
          const cleanSenderPhone = phone.replace(/\D/g, '');
          const isAuthorized = setting.whatsappAuthorizedPhones.some(
            (authPhone) => authPhone.replace(/\D/g, '') === cleanSenderPhone
          );

          if (isAuthorized) {
            const user = await this.prisma.user.findFirst({
              where: { businessId, role: { in: ['admin', 'owner'] } },
            }) || await this.prisma.user.findFirst({
              where: { businessId },
            });

            if (user) {
              let branchId: string | undefined = user.branchIds?.[0];
              if (!branchId) {
                const branch = await this.prisma.branch.findFirst({
                  where: { businessId },
                });
                branchId = branch?.id;
              }

              if (branchId) {
                const cleanMsg = text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                const freshChat = await this.prisma.whatsAppChat.findUnique({
                  where: { id: chat.id },
                });

                if (freshChat) {
                  if (!freshChat.whatsappBotSessionActive) {
                    if (cleanMsg === 'syncroai') {
                      await this.prisma.whatsAppChat.update({
                        where: { id: chat.id },
                        data: { whatsappBotSessionActive: true },
                      });
                      await this.sendTextMessage(
                        phone,
                        '🤖 *Syncro IA activada.*\n¿En qué te puedo ayudar hoy?\n\n_Escribe *salir* para desactivarme._',
                        businessId
                      );
                    }
                  } else {
                    const sessionId = `whatsapp-${cleanSenderPhone}`;

                    if (cleanMsg === 'activa ads') {
                      await this.prisma.aiChatSession.upsert({
                        where: { id: sessionId },
                        update: { type: 'ADS_COPILOT' },
                        create: { id: sessionId, businessId, userId: user.id, title: 'WhatsApp Session', type: 'ADS_COPILOT' }
                      });
                      await this.sendTextMessage(
                        phone,
                        '🤖 *Modo Ads activado.*\nAhora responderé basándome en tu biblioteca de entrenamiento de anuncios.\n\n_Escribe *salir ads* para volver al modo general o *salir* para desactivarme._',
                        businessId
                      );
                    } else if (cleanMsg === 'salir ads') {
                      await this.prisma.aiChatSession.upsert({
                        where: { id: sessionId },
                        update: { type: 'GENERAL' },
                        create: { id: sessionId, businessId, userId: user.id, title: 'WhatsApp Session', type: 'GENERAL' }
                      });
                      await this.sendTextMessage(
                        phone,
                        '🤖 *Modo Ads desactivado.*\nHe regresado al asistente general de Syncro POS.',
                        businessId
                      );
                    } else if (['salir', 'desactivar', 'chao', 'adios', 'bye'].includes(cleanMsg)) {
                      await this.prisma.whatsAppChat.update({
                        where: { id: chat.id },
                        data: { whatsappBotSessionActive: false },
                      });
                      await this.prisma.whatsAppPendingAction.deleteMany({
                        where: { phone: cleanSenderPhone, businessId },
                      });
                      await this.prisma.aiChatSession.upsert({
                        where: { id: sessionId },
                        update: { type: 'GENERAL' },
                        create: { id: sessionId, businessId, userId: user.id, title: 'WhatsApp Session', type: 'GENERAL' }
                      }).catch(() => {});
                      await this.sendTextMessage(
                        phone,
                        '👋 *Syncro IA desactivada.*\nConversación normal restaurada.',
                        businessId
                      );
                    } else {
                      await this.processAiResponse(cleanSenderPhone, text, businessId, user.id, branchId, chat.id);
                    }
                  }
                }
              } else {
                this.logger.warn(`Could not find branch for user ${user.id} to run AI agent`);
              }
            } else {
              this.logger.warn(`Could not find authorized user for business ${businessId} to run AI agent`);
            }
          }
        }
      }).catch((err) => {
        this.logger.error(`Error processing AI response on WhatsApp: ${err.message}`, err.stack);
      });
    }

    return { success: true, messageId: message.id };
  }

  private async processAiResponse(
    phone: string,
    text: string,
    businessId: string,
    userId: string,
    branchId: string,
    chatId: string
  ) {
    const cleanMsg = text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Check if there is a pending action
    const pendingAction = await this.prisma.whatsAppPendingAction.findFirst({
      where: {
        phone,
        businessId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (pendingAction) {
      if (cleanMsg === 'si' || cleanMsg === 'yes' || cleanMsg === 'confirmar' || cleanMsg === 'confirm') {
        try {
          const actionObj = JSON.parse(pendingAction.actionJson);
          const result = await this.aiAgentService.confirmAction(
            userId,
            businessId,
            branchId,
            actionObj
          );

          await this.prisma.whatsAppPendingAction.delete({
            where: { id: pendingAction.id },
          });

          await this.sendTextMessage(phone, result.message, businessId);
        } catch (e) {
          this.logger.error(`Error confirming WhatsApp action: ${e.message}`);
          await this.sendTextMessage(phone, '⚠️ Ocurrió un error al intentar confirmar la acción.', businessId);
        }
        return;
      } else if (cleanMsg === 'no' || cleanMsg === 'cancelar' || cleanMsg === 'cancel') {
        try {
          await this.prisma.whatsAppPendingAction.delete({
            where: { id: pendingAction.id },
          });
          await this.sendTextMessage(phone, '❌ Acción cancelada.', businessId);
        } catch (e) {
          this.logger.error(`Error deleting pending WhatsApp action: ${e.message}`);
        }
        return;
      } else {
        await this.sendTextMessage(
          phone,
          '⚠️ Tienes una acción pendiente de confirmación. Responde *SI* para confirmar o *NO* para cancelar.',
          businessId
        );
        return;
      }
    }

    // No pending action, process with AI Chat
    try {
      const sessionId = `whatsapp-${phone}`;
      const aiResponse = await this.aiAgentService.chat(userId, businessId, text, sessionId);

      if (aiResponse.action) {
        // Save proposed action
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes TTL

        await this.prisma.whatsAppPendingAction.create({
          data: {
            chatId,
            phone,
            businessId,
            userId,
            branchId,
            actionJson: JSON.stringify(aiResponse.action),
            expiresAt,
          },
        });

        const replyText = `${aiResponse.message}\n\nResponde *SI* para confirmar o *NO* para cancelar.`;
        await this.sendTextMessage(phone, replyText, businessId);
      } else {
        await this.sendTextMessage(phone, aiResponse.message, businessId);
      }
    } catch (e) {
      this.logger.error(`Error calling AI agent from WhatsApp: ${e.message}`);
      await this.sendTextMessage(phone, '⚠️ Lo siento, ocurrió un error al procesar tu solicitud con Syncro IA.', businessId);
    }
  }

  /**
   * Finds or creates a WhatsAppChat scoped to a specific business.
   * Two businesses can have chats with the same phone number without collision.
   */
  async findOrCreateChat(phone: string, businessId: string, name?: string) {
    let chat = await this.prisma.whatsAppChat.findFirst({
      where: { phone, businessId },
      include: { client: true },
    });

    if (!chat) {
      // Look up if a client with this phone exists within the same business
      const client = await this.prisma.client.findFirst({
        where: {
          businessId,
          phone: { contains: phone.slice(-8) },
        },
      });

      chat = await this.prisma.whatsAppChat.create({
        data: {
          phone,
          businessId,
          name: name || client?.name || phone,
          clientId: client?.id || null,
        },
        include: { client: true },
      });
    }

    // Background populate avatar if missing
    if (!chat.avatarUrl) {
      this.getProfilePicture(phone, businessId).then((res) => {
        if (res.profilePictureUrl) {
          this.prisma.whatsAppChat.update({
            where: { id: chat.id },
            data: { avatarUrl: res.profilePictureUrl },
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    return chat;
  }

  async findChatByIdOrPhone(idOrPhone: string, businessId: string) {
    let chat = await this.prisma.whatsAppChat.findFirst({
      where: {
        businessId,
        OR: [{ id: idOrPhone }, { phone: idOrPhone }],
      },
      include: { client: true },
    });

    if (!chat) {
      chat = await this.findOrCreateChat(idOrPhone, businessId);
    }
    return chat;
  }

  async getChats(businessId: string) {
    const chats = await this.prisma.whatsAppChat.findMany({
      where: {
        businessId,
        phone: { not: { startsWith: 'bot-' } },
      },
      include: {
        client: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Background populate avatars
    chats.forEach((chat) => {
      if (!chat.avatarUrl) {
        this.getProfilePicture(chat.phone, businessId).then((res) => {
          if (res.profilePictureUrl) {
            this.prisma.whatsAppChat.update({
              where: { id: chat.id },
              data: { avatarUrl: res.profilePictureUrl },
            }).then((updatedChat) => {
              this.gateway.emitChatUpdated({
                ...updatedChat,
                lastMessage: chat.messages[0]?.text || '',
                lastMessageTime: chat.messages[0]?.createdAt || chat.updatedAt,
                businessId: updatedChat.businessId ?? businessId,
              });
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    });

    return chats.map((c: any) => ({
      ...c,
      lastMessage: c.messages[0]?.text || '',
      lastMessageTime: c.messages[0]?.createdAt || c.updatedAt,
    }));
  }

  async getMessages(chatId: string, businessId: string) {
    // Verify the chat belongs to this business before returning messages
    const chat = await this.prisma.whatsAppChat.findFirst({
      where: { id: chatId, businessId },
    });
    if (!chat) {
      throw new BadRequestException('Chat no encontrado o no pertenece a este negocio');
    }
    return this.prisma.whatsAppMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async assignChat(chatId: string, agentId: string, businessId: string) {
    const chat = await this.prisma.whatsAppChat.findFirst({
      where: { id: chatId, businessId },
    });
    if (!chat) throw new BadRequestException('Chat no encontrado o no pertenece a este negocio');

    return this.prisma.whatsAppChat.update({
      where: { id: chatId },
      data: { assignedTo: agentId },
      include: { user: true },
    });
  }

  async getProfilePicture(phone: string, businessId: string) {
    const { url, apiKey, instance } = this.getUrlAndKey(businessId);
    const cleanPhone = phone.replace(/\D/g, '');
    try {
      const res = await fetch(`${url}/chat/fetchProfilePictureUrl/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ number: `${cleanPhone}@s.whatsapp.net` }),
      });
      if (res.ok) {
        const data = await res.json();
        return { profilePictureUrl: data.profilePictureUrl || null };
      }
      return { profilePictureUrl: null };
    } catch (e) {
      this.logger.error(`Error fetching profile picture: ${e.message}`);
      return { profilePictureUrl: null };
    }
  }

  async getMessageById(id: string) {
    return this.prisma.whatsAppMessage.findUnique({ where: { id } });
  }

  async getMessageMedia(whatsappMsgId: string, businessId: string) {
    const { url, apiKey, instance } = this.getUrlAndKey(businessId);
    try {
      const res = await fetch(`${url}/chat/getBase64FromMediaMessage/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({
          message: { key: { id: whatsappMsgId } },
          convertToMp4: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return { base64: data.base64 };
      }
      const errText = await res.text();
      this.logger.error(`Error downloading media from Evolution: ${errText}`);
      return null;
    } catch (e) {
      this.logger.error(`Failed to get message media: ${e.message}`);
      return null;
    }
  }

  async sendMediaMessage(phone: string, mediatype: string, mediaBase64: string, businessId: string, fileName?: string, caption?: string, agentId?: string) {
    const { url, apiKey, instance } = this.getUrlAndKey(businessId);
    const cleanPhone = phone.replace(/\D/g, '');

    try {
      const res = await fetch(`${url}/message/sendMedia/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({
          number: cleanPhone,
          mediatype,
          media: mediaBase64,
          fileName: fileName || undefined,
          caption: caption || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Error al enviar media por Evolution API');
      }

      const responseData = await res.json();
      const whatsappMsgId = responseData.key?.id || null;

      const chat = await this.findOrCreateChat(cleanPhone, businessId);

      const message = await this.prisma.whatsAppMessage.create({
        data: {
          chatId: chat.id,
          senderType: 'AGENT',
          agentId: agentId || null,
          text: caption || `[Archivo: ${mediatype}]`,
          type: mediatype,
          mediaUrl: mediaBase64.startsWith('data:') ? mediaBase64 : null,
          status: 'SENT',
          whatsappMsgId,
        },
      });

      this.gateway.emitNewMessage({ ...message, businessId });
      this.gateway.emitChatUpdated({
        ...chat,
        lastMessage: caption || `[${mediatype}]`,
        updatedAt: new Date(),
        businessId: (chat as any).businessId ?? businessId,
      });

      return message;
    } catch (e) {
      this.logger.error(`Error sending media to ${phone} (business ${businessId}): ${e.message}`);
      throw new BadRequestException(`No se pudo enviar el archivo: ${e.message}`);
    }
  }

  // --- PREMIUM CHAT MANAGEMENT ACTIONS ---

  async updateChat(id: string, data: any, businessId: string) {
    const allowedFields = ['isPinned', 'isArchived', 'isRestricted', 'isFavorite', 'isMuted', 'isUnread', 'isBlocked', 'lists', 'avatarUrl'];
    const updateData: any = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        updateData[key] = data[key];
      }
    }

    const resolvedChat = await this.findChatByIdOrPhone(id, businessId);

    const chat = await this.prisma.whatsAppChat.update({
      where: { id: resolvedChat.id },
      data: updateData,
      include: {
        client: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    const formattedChat = {
      ...chat,
      lastMessage: chat.messages[0]?.text || '',
      lastMessageTime: chat.messages[0]?.createdAt || chat.updatedAt,
    };

    this.gateway.emitChatUpdated(formattedChat);
    return formattedChat;
  }

  async clearChat(id: string, businessId: string) {
    const resolvedChat = await this.findChatByIdOrPhone(id, businessId);

    await this.prisma.whatsAppMessage.deleteMany({ where: { chatId: resolvedChat.id } });

    const chat = await this.prisma.whatsAppChat.findUnique({
      where: { id: resolvedChat.id },
      include: { client: true },
    });

    if (chat) {
      const formattedChat = { ...chat, lastMessage: '', lastMessageTime: chat.updatedAt };
      this.gateway.emitChatUpdated(formattedChat);
      return formattedChat;
    }
    return null;
  }

  async deleteChat(id: string, businessId: string) {
    const resolvedChat = await this.findChatByIdOrPhone(id, businessId);

    await this.prisma.whatsAppMessage.deleteMany({ where: { chatId: resolvedChat.id } });
    const chat = await this.prisma.whatsAppChat.delete({ where: { id: resolvedChat.id } });

    this.gateway.emitChatDeleted(resolvedChat.id, businessId);
    return chat;
  }

  async logoutInstance(businessId: string) {
    const { url, apiKey, instance } = this.getUrlAndKey(businessId);
    try {
      const response = await fetch(`${url}/instance/logout/${instance}`, {
        method: 'POST',
        headers: { apikey: apiKey },
      });
      if (response.ok) return { success: true };

      const deleteResponse = await fetch(`${url}/instance/logout/${instance}`, {
        method: 'DELETE',
        headers: { apikey: apiKey },
      });
      if (deleteResponse.ok) return { success: true };

      return { success: false, message: 'Fallo al desconectar la instancia' };
    } catch (e) {
      this.logger.error(`Error logging out WhatsApp for business ${businessId}: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  async readAllChats(businessId: string) {
    try {
      await this.prisma.whatsAppChat.updateMany({
        where: { businessId },
        data: { isUnread: false },
      });
      this.gateway.server.emit('whatsapp_allRead', { businessId, success: true });
      return { success: true };
    } catch (e) {
      this.logger.error(`Error marking all chats as read for business ${businessId}: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  async processMessageStatusUpdate(whatsappMsgId: string, statusValue: number | string) {
    let statusString = 'SENT';
    if (statusValue === 2 || statusValue === 'DELIVERED') {
      statusString = 'DELIVERED';
    } else if (statusValue === 3 || statusValue === 4 || statusValue === 'READ' || statusValue === 'PLAYED') {
      statusString = 'READ';
    } else {
      return;
    }

    const message = await this.prisma.whatsAppMessage.findFirst({ where: { whatsappMsgId } });

    if (message && message.status !== statusString) {
      const updatedMessage = await this.prisma.whatsAppMessage.update({
        where: { id: message.id },
        data: { status: statusString },
      });

      // Fetch chat to get businessId for room routing
    const chatForEvent = await this.prisma.whatsAppChat.findUnique({ where: { id: updatedMessage.chatId }, select: { businessId: true } });
    this.gateway.emitMessageStatusUpdated({
        messageId: updatedMessage.id,
        chatId: updatedMessage.chatId,
        businessId: chatForEvent?.businessId || undefined,
        status: statusString,
      });
    }
  }
}
