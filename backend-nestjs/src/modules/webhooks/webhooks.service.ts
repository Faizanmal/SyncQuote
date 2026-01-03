import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Initialize Stripe
    const apiKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!apiKey) {
      this.logger.warn('STRIPE_SECRET_KEY not configured');
      // Create a placeholder instance - will fail if actually used
      this.stripe = null as any;
    } else {
      this.stripe = new Stripe(apiKey, { apiVersion: '2024-06-20' });
    }
  }

  /**
   * Verify Stripe webhook signature and parse event
   */
  async verifyAndParseWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<Stripe.Event> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET not configured');
      throw new BadRequestException('Webhook secret not configured');
    }

    if (!this.stripe) {
      throw new BadRequestException('Stripe not initialized');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
      this.logger.log(`Webhook signature verified: ${event.id}`);
      return event;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Webhook signature verification failed: ${message}`);
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleStripeWebhook(event: Stripe.Event) {
    this.logger.log(`Handling Stripe webhook: ${event.type}`);

    // Check if event already processed
    const existing = await this.prisma.stripeWebhookEvent.findUnique({
      where: { eventId: event.id },
    });

    if (existing?.processed) {
      this.logger.log(`Event ${event.id} already processed`);
      return;
    }

    // Store event
    await this.prisma.stripeWebhookEvent.upsert({
      where: { eventId: event.id },
      create: {
        eventId: event.id,
        type: event.type,
        data: JSON.parse(JSON.stringify(event.data)),
        processed: false,
      },
      update: {},
    });

    // Process based on event type
    switch (event.type) {
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }

    // Mark as processed
    await this.prisma.stripeWebhookEvent.update({
      where: { eventId: event.id },
      data: { processed: true },
    });
  }

  private async handleInvoicePaid(invoice: any) {
    const customerId = invoice.customer;

    // Update user subscription status
    await this.prisma.user.update({
      where: { stripeCustomerId: customerId },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt: new Date(invoice.period_end * 1000),
      },
    });

    this.logger.log(`Invoice paid for customer: ${customerId}`);
  }

  private async handlePaymentFailed(invoice: any) {
    const customerId = invoice.customer;

    await this.prisma.user.update({
      where: { stripeCustomerId: customerId },
      data: { subscriptionStatus: 'PAST_DUE' },
    });

    this.logger.log(`Payment failed for customer: ${customerId}`);
  }

  private async handleSubscriptionDeleted(subscription: any) {
    const customerId = subscription.customer;

    await this.prisma.user.update({
      where: { stripeCustomerId: customerId },
      data: {
        subscriptionStatus: 'CANCELED',
        stripeSubscriptionId: null,
      },
    });

    this.logger.log(`Subscription canceled for customer: ${customerId}`);
  }

  private async handleSubscriptionUpdated(subscription: any) {
    const customerId = subscription.customer;

    await this.prisma.user.update({
      where: { stripeCustomerId: customerId },
      data: {
        subscriptionStatus: subscription.status === 'active' ? 'ACTIVE' : 'PAST_DUE',
        subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
      },
    });

    this.logger.log(`Subscription updated for customer: ${customerId}`);
  }

  private async handlePaymentIntentSucceeded(paymentIntent: any) {
    // Handle deposit payments for proposals
    const metadata = paymentIntent.metadata;

    if (metadata?.proposalId) {
      await this.prisma.proposal.update({
        where: { id: metadata.proposalId },
        data: {
          depositPaid: true,
          depositPaidAt: new Date(),
          stripePaymentIntentId: paymentIntent.id,
        },
      });

      this.logger.log(`Deposit paid for proposal: ${metadata.proposalId}`);
    }
  }
}
