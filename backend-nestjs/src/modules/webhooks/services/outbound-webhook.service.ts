import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import * as crypto from 'crypto';

export type WebhookEvent =
  | 'proposal.created'
  | 'proposal.sent'
  | 'proposal.viewed'
  | 'proposal.approved'
  | 'proposal.declined'
  | 'proposal.signed'
  | 'proposal.expired'
  | 'comment.added'
  | 'payment.received'
  | 'payment.failed'
  | 'contract.signed'
  | 'invoice.paid'
  | 'client.created'
  | 'client.updated';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, any>;
  userId: string;
  webhookId: string;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  response?: string;
  duration: number;
  error?: string;
}

@Injectable()
export class OutboundWebhookService {
  private readonly logger = new Logger(OutboundWebhookService.name);
  private readonly maxRetries = 5;
  private readonly retryDelays = [60, 300, 900, 3600, 14400]; // seconds: 1min, 5min, 15min, 1hr, 4hr

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ==================== Webhook Management ====================

  async createWebhook(
    userId: string,
    data: {
      url: string;
      events: WebhookEvent[];
      description?: string;
    },
  ): Promise<any> {
    // Validate URL
    if (!this.isValidUrl(data.url)) {
      throw new BadRequestException('Invalid webhook URL');
    }

    // Generate secret for signature verification
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = await this.prisma.webhook.create({
      data: {
        userId,
        url: data.url,
        events: data.events,
        description: data.description,
        secret,
        isActive: true,
      },
    });

    return {
      ...webhook,
      secret, // Only returned on creation
    };
  }

  async updateWebhook(
    userId: string,
    webhookId: string,
    updates: {
      url?: string;
      events?: WebhookEvent[];
      description?: string;
      isActive?: boolean;
    },
  ): Promise<any> {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, userId },
    });

    if (!webhook) {
      throw new BadRequestException('Webhook not found');
    }

    if (updates.url && !this.isValidUrl(updates.url)) {
      throw new BadRequestException('Invalid webhook URL');
    }

    return this.prisma.webhook.update({
      where: { id: webhookId },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });
  }

  async deleteWebhook(userId: string, webhookId: string): Promise<void> {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, userId },
    });

    if (!webhook) {
      throw new BadRequestException('Webhook not found');
    }

    await this.prisma.webhook.delete({
      where: { id: webhookId },
    });
  }

  async getWebhooks(userId: string): Promise<any[]> {
    return this.prisma.webhook.findMany({
      where: { userId },
      include: {
        deliveries: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async getWebhookDeliveries(
    userId: string,
    webhookId: string,
    limit = 50,
  ): Promise<any[]> {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, userId },
    });

    if (!webhook) {
      throw new BadRequestException('Webhook not found');
    }

    return this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async regenerateSecret(userId: string, webhookId: string): Promise<string> {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, userId },
    });

    if (!webhook) {
      throw new BadRequestException('Webhook not found');
    }

    const newSecret = crypto.randomBytes(32).toString('hex');

    await this.prisma.webhook.update({
      where: { id: webhookId },
      data: { secret: newSecret },
    });

    return newSecret;
  }

  // ==================== Event Triggering ====================

  async triggerEvent(
    userId: string,
    event: WebhookEvent,
    data: Record<string, any>,
  ): Promise<void> {
    this.logger.log(`Triggering webhook event: ${event} for user ${userId}`);

    // Find all active webhooks subscribed to this event
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        userId,
        isActive: true,
        events: { has: event },
      },
    });

    if (webhooks.length === 0) {
      this.logger.debug(`No webhooks subscribed to ${event} for user ${userId}`);
      return;
    }

    // Trigger each webhook asynchronously
    await Promise.all(
      webhooks.map(webhook => this.deliverWebhook(webhook, event, data)),
    );
  }

  private async deliverWebhook(
    webhook: any,
    event: WebhookEvent,
    data: Record<string, any>,
  ): Promise<void> {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      userId: webhook.userId,
      webhookId: webhook.id,
    };

    const signature = this.generateSignature(payload, webhook.secret);
    const startTime = Date.now();

    let result: WebhookDeliveryResult;

    try {
      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-SyncQuote-Signature': signature,
          'X-SyncQuote-Event': event,
          'X-SyncQuote-Timestamp': payload.timestamp,
          'User-Agent': 'SyncQuote-Webhooks/1.0',
        },
        timeout: 30000, // 30 second timeout
        validateStatus: () => true, // Don't throw on non-2xx
      });

      result = {
        success: response.status >= 200 && response.status < 300,
        statusCode: response.status,
        response: typeof response.data === 'string' 
          ? response.data.substring(0, 1000) 
          : JSON.stringify(response.data).substring(0, 1000),
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      result = {
        success: false,
        duration: Date.now() - startTime,
        error: error.message,
      };
    }

    // Record delivery
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event,
        payload,
        statusCode: result.statusCode,
        response: result.response,
        duration: result.duration,
        success: result.success,
        attempts: 1,
        lastAttempt: new Date(),
        nextRetryAt: result.success ? undefined : this.calculateNextRetry(1),
      },
    });

    // Update webhook stats
    await this.prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        lastTriggeredAt: new Date(),
        successCount: result.success ? { increment: 1 } : undefined,
        failureCount: !result.success ? { increment: 1 } : undefined,
      },
    });

    if (!result.success) {
      this.logger.warn(
        `Webhook delivery failed: ${webhook.url} - ${result.error || result.statusCode}`,
      );
    }
  }

  // ==================== Retry Logic ====================

  @Cron(CronExpression.EVERY_MINUTE)
  async processRetries(): Promise<void> {
    const failedDeliveries = await this.prisma.webhookDelivery.findMany({
      where: {
        success: false,
        attempts: { lt: this.maxRetries },
        nextRetryAt: { lte: new Date() },
      },
      include: {
        webhook: true,
      },
      take: 100,
    });

    for (const delivery of failedDeliveries) {
      if (!delivery.webhook.isActive) continue;

      this.logger.log(`Retrying webhook delivery ${delivery.id}`);

      const payload = delivery.payload as WebhookPayload;
      const signature = this.generateSignature(payload, delivery.webhook.secret);
      const startTime = Date.now();

      let result: WebhookDeliveryResult;

      try {
        const response = await axios.post(delivery.webhook.url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-SyncQuote-Signature': signature,
            'X-SyncQuote-Event': delivery.event,
            'X-SyncQuote-Timestamp': payload.timestamp,
            'X-SyncQuote-Retry': delivery.attempts.toString(),
            'User-Agent': 'SyncQuote-Webhooks/1.0',
          },
          timeout: 30000,
          validateStatus: () => true,
        });

        result = {
          success: response.status >= 200 && response.status < 300,
          statusCode: response.status,
          response: typeof response.data === 'string' 
            ? response.data.substring(0, 1000) 
            : JSON.stringify(response.data).substring(0, 1000),
          duration: Date.now() - startTime,
        };
      } catch (error: any) {
        result = {
          success: false,
          duration: Date.now() - startTime,
          error: error.message,
        };
      }

      const newAttempts = delivery.attempts + 1;

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          attempts: newAttempts,
          lastAttempt: new Date(),
          success: result.success,
          statusCode: result.statusCode,
          response: result.response || result.error,
          duration: result.duration,
          nextRetryAt: result.success ? null : this.calculateNextRetry(newAttempts),
        },
      });

      if (result.success) {
        await this.prisma.webhook.update({
          where: { id: delivery.webhookId },
          data: { successCount: { increment: 1 } },
        });
      }
    }
  }

  // ==================== Testing ====================

  async testWebhook(userId: string, webhookId: string): Promise<WebhookDeliveryResult> {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, userId },
    });

    if (!webhook) {
      throw new BadRequestException('Webhook not found');
    }

    const testPayload: WebhookPayload = {
      event: 'proposal.created',
      timestamp: new Date().toISOString(),
      data: {
        test: true,
        message: 'This is a test webhook from SyncQuote',
        proposalId: 'test-proposal-id',
        title: 'Test Proposal',
      },
      userId,
      webhookId,
    };

    const signature = this.generateSignature(testPayload, webhook.secret);
    const startTime = Date.now();

    try {
      const response = await axios.post(webhook.url, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-SyncQuote-Signature': signature,
          'X-SyncQuote-Event': 'test',
          'X-SyncQuote-Timestamp': testPayload.timestamp,
          'User-Agent': 'SyncQuote-Webhooks/1.0',
        },
        timeout: 30000,
        validateStatus: () => true,
      });

      return {
        success: response.status >= 200 && response.status < 300,
        statusCode: response.status,
        response: typeof response.data === 'string' 
          ? response.data.substring(0, 1000) 
          : JSON.stringify(response.data).substring(0, 1000),
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  // ==================== Helper Methods ====================

  private generateSignature(payload: WebhookPayload, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  private calculateNextRetry(attempts: number): Date {
    const delaySeconds = this.retryDelays[Math.min(attempts - 1, this.retryDelays.length - 1)];
    return new Date(Date.now() + delaySeconds * 1000);
  }

  // ==================== Event Helpers ====================

  async onProposalCreated(userId: string, proposal: any): Promise<void> {
    await this.triggerEvent(userId, 'proposal.created', {
      proposalId: proposal.id,
      title: proposal.title,
      status: proposal.status,
      recipientEmail: proposal.recipientEmail,
      recipientName: proposal.recipientName,
      totalAmount: proposal.totalAmount,
      createdAt: proposal.createdAt,
    });
  }

  async onProposalSent(userId: string, proposal: any): Promise<void> {
    await this.triggerEvent(userId, 'proposal.sent', {
      proposalId: proposal.id,
      title: proposal.title,
      recipientEmail: proposal.recipientEmail,
      recipientName: proposal.recipientName,
      sentAt: new Date().toISOString(),
    });
  }

  async onProposalViewed(userId: string, proposal: any, viewerInfo?: any): Promise<void> {
    await this.triggerEvent(userId, 'proposal.viewed', {
      proposalId: proposal.id,
      title: proposal.title,
      recipientEmail: proposal.recipientEmail,
      viewCount: proposal.viewCount,
      viewerInfo,
      viewedAt: new Date().toISOString(),
    });
  }

  async onProposalApproved(userId: string, proposal: any): Promise<void> {
    await this.triggerEvent(userId, 'proposal.approved', {
      proposalId: proposal.id,
      title: proposal.title,
      recipientEmail: proposal.recipientEmail,
      recipientName: proposal.recipientName,
      totalAmount: proposal.totalAmount,
      approvedAt: proposal.approvedAt,
    });
  }

  async onProposalSigned(userId: string, proposal: any): Promise<void> {
    await this.triggerEvent(userId, 'proposal.signed', {
      proposalId: proposal.id,
      title: proposal.title,
      recipientEmail: proposal.recipientEmail,
      recipientName: proposal.recipientName,
      totalAmount: proposal.totalAmount,
      signedAt: proposal.signedAt,
      signatureData: proposal.signatureData,
    });
  }

  async onPaymentReceived(userId: string, payment: any): Promise<void> {
    await this.triggerEvent(userId, 'payment.received', {
      paymentId: payment.id,
      proposalId: payment.proposalId,
      amount: payment.amount,
      currency: payment.currency,
      payerEmail: payment.payerEmail,
      paidAt: payment.paidAt,
    });
  }
}
