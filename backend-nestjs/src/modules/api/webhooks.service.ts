import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto, UpdateWebhookDto, WebhookEvent } from './dto';
import { randomBytes, createHmac } from 'crypto';

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: any;
  statusCode?: number;
  response?: string;
  duration?: number;
  success: boolean;
  attempts: number;
  nextRetryAt?: Date;
}

@Injectable()
export class WebhooksService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new webhook endpoint
   */
  async createWebhook(userId: string, dto: CreateWebhookDto) {
    // Generate a signing secret if not provided
    const secret = dto.secret || `whsec_${randomBytes(24).toString('hex')}`;

    const webhook = await this.prisma.webhook.create({
      data: {
        userId,
        url: dto.url,
        events: dto.events,
        secret,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });

    return {
      ...webhook,
      secret, // Only return secret on creation
    };
  }

  /**
   * List all webhooks for a user
   */
  async listWebhooks(userId: string) {
    const webhooks = await this.prisma.webhook.findMany({
      where: { userId },
      select: {
        id: true,
        url: true,
        events: true,
        description: true,
        isActive: true,
        createdAt: true,
        lastTriggeredAt: true,
        successCount: true,
        failureCount: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return webhooks;
  }

  /**
   * Get webhook details
   */
  async getWebhook(userId: string, webhookId: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, userId },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    // Don't return the secret
    const { secret, ...rest } = webhook;
    return rest;
  }

  /**
   * Update webhook
   */
  async updateWebhook(userId: string, webhookId: string, dto: UpdateWebhookDto) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, userId },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const updated = await this.prisma.webhook.update({
      where: { id: webhookId },
      data: {
        url: dto.url,
        events: dto.events,
        isActive: dto.isActive,
        description: dto.description,
      },
    });

    const { secret, ...rest } = updated;
    return rest;
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(userId: string, webhookId: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, userId },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    await this.prisma.webhook.delete({
      where: { id: webhookId },
    });

    return { success: true };
  }

  /**
   * Regenerate webhook secret
   */
  async regenerateSecret(userId: string, webhookId: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, userId },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const newSecret = `whsec_${randomBytes(24).toString('hex')}`;

    await this.prisma.webhook.update({
      where: { id: webhookId },
      data: { secret: newSecret },
    });

    return { secret: newSecret };
  }

  /**
   * Trigger webhook for an event
   */
  async triggerWebhook(userId: string, event: WebhookEvent, payload: any) {
    // Find all active webhooks for this user subscribed to this event
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        userId,
        isActive: true,
        events: { has: event },
      },
    });

    const results = await Promise.all(
      webhooks.map((webhook) => this.deliverWebhook(webhook, event, payload)),
    );

    return results;
  }

  /**
   * Deliver webhook payload
   */
  private async deliverWebhook(webhook: any, event: WebhookEvent, payload: any) {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      id: `evt_${randomBytes(16).toString('hex')}`,
      event,
      timestamp,
      data: payload,
    });

    // Create signature
    const signature = this.createSignature(webhook.secret, timestamp, body);

    const startTime = Date.now();
    let success = false;
    let statusCode: number | undefined;
    let response: string | undefined;

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SyncQuote-Signature': signature,
          'X-SyncQuote-Timestamp': timestamp.toString(),
          'X-SyncQuote-Event': event,
        },
        body,
      });

      statusCode = res.status;
      response = await res.text();
      success = res.ok;
    } catch (error: any) {
      response = error.message;
      success = false;
    }

    const duration = Date.now() - startTime;

    // Log the delivery
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event,
        payload: JSON.parse(body),
        statusCode,
        response,
        duration,
        success,
        attempts: 1,
      },
    });

    // Update webhook stats
    await this.prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        lastTriggeredAt: new Date(),
        ...(success ? { successCount: { increment: 1 } } : { failureCount: { increment: 1 } }),
      },
    });

    // Schedule retry if failed
    if (!success) {
      await this.scheduleRetry(delivery.id);
    }

    return { webhookId: webhook.id, success, statusCode };
  }

  /**
   * Create HMAC signature for webhook
   */
  private createSignature(secret: string, timestamp: number, body: string): string {
    const payload = `${timestamp}.${body}`;
    return `v1=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  }

  /**
   * Schedule webhook retry
   */
  private async scheduleRetry(deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery || delivery.attempts >= 5) {
      return;
    }

    // Exponential backoff: 1min, 5min, 30min, 2hr, 24hr
    const delays = [60, 300, 1800, 7200, 86400];
    const delay = delays[Math.min(delivery.attempts - 1, delays.length - 1)];

    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        nextRetryAt: new Date(Date.now() + delay * 1000),
      },
    });
  }

  /**
   * Get webhook delivery history
   */
  async getDeliveryHistory(userId: string, webhookId: string, limit: number = 50) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, userId },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const deliveries = await this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        event: true,
        statusCode: true,
        success: true,
        duration: true,
        attempts: true,
        createdAt: true,
      },
    });

    return deliveries;
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(userId: string, webhookId: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, userId },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const testPayload = {
      message: 'This is a test webhook delivery',
      timestamp: new Date().toISOString(),
    };

    const result = await this.deliverWebhook(
      webhook,
      'proposal.created' as WebhookEvent, // Use a common event for testing
      testPayload,
    );

    return result;
  }

  /**
   * Process pending webhook retries
   */
  async processRetries() {
    const pendingRetries = await this.prisma.webhookDelivery.findMany({
      where: {
        success: false,
        attempts: { lt: 5 },
        nextRetryAt: { lte: new Date() },
      },
      include: { webhook: true },
    });

    for (const delivery of pendingRetries) {
      if (!delivery.webhook.isActive) continue;

      const timestamp = Math.floor(Date.now() / 1000);
      const body = JSON.stringify(delivery.payload);
      const signature = this.createSignature(delivery.webhook.secret, timestamp, body);

      let success = false;
      let statusCode: number | undefined;
      let response: string | undefined;

      try {
        const res = await fetch(delivery.webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SyncQuote-Signature': signature,
            'X-SyncQuote-Timestamp': timestamp.toString(),
            'X-SyncQuote-Event': delivery.event,
          },
          body,
        });

        statusCode = res.status;
        response = await res.text();
        success = res.ok;
      } catch (error: any) {
        response = error.message;
      }

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          attempts: { increment: 1 },
          statusCode,
          response,
          success,
          nextRetryAt: success ? null : new Date(Date.now() + 3600000), // 1 hour
        },
      });

      if (success) {
        await this.prisma.webhook.update({
          where: { id: delivery.webhookId },
          data: { successCount: { increment: 1 } },
        });
      }
    }
  }
}
