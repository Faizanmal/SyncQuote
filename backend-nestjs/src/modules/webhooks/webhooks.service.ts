import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { PaymentsService } from '../payments/payments.service';
import { TemplateMarketplaceService } from '../template-marketplace/template-marketplace.service';
import Stripe from 'stripe';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private billingService: BillingService,
    private paymentsService: PaymentsService,
    private templateMarketplaceService: TemplateMarketplaceService,
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
  async verifyAndParseWebhook(rawBody: Buffer, signature: string): Promise<Stripe.Event> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET not configured');
      throw new BadRequestException('Webhook secret not configured');
    }

    if (!this.stripe) {
      throw new BadRequestException('Stripe not initialized');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
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
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
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
    if (!customerId) {
      return;
    }

    await this.prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt: invoice.period_end ? new Date(invoice.period_end * 1000) : undefined,
      },
    });

    this.logger.log(`Invoice paid for customer: ${customerId}`);
  }

  private async handlePaymentFailed(invoice: any) {
    const customerId = invoice.customer;
    if (!customerId) {
      return;
    }

    await this.prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: { subscriptionStatus: 'PAST_DUE' },
    });

    this.logger.log(`Payment failed for customer: ${customerId}`);
  }

  private async handleSubscriptionDeleted(subscription: any) {
    const customerId = subscription.customer;
    if (!customerId) {
      return;
    }

    await this.prisma.user.updateMany({
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
    if (!customerId) {
      return;
    }

    await this.prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: {
        subscriptionStatus: subscription.status === 'active' ? 'ACTIVE' : 'PAST_DUE',
        subscriptionEndsAt: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : undefined,
        stripeSubscriptionId: subscription.id,
      },
    });

    this.logger.log(`Subscription updated for customer: ${customerId}`);
  }

  private async handlePaymentIntentSucceeded(paymentIntent: any) {
    const metadata = paymentIntent.metadata || {};

    if (paymentIntent.id) {
      await this.paymentsService.handlePaymentSuccess(paymentIntent.id);
    }

    if (metadata.invoiceId) {
      await this.prisma.invoice.updateMany({
        where: { id: metadata.invoiceId, status: { not: 'paid' } },
        data: {
          status: 'paid',
          amountPaid: (paymentIntent.amount || 0) / 100,
          amountDue: 0,
          paidDate: new Date(),
          stripePaymentIntentId: paymentIntent.id,
        },
      });
    }

    if (metadata?.proposalId) {
      await this.prisma.proposal.updateMany({
        where: { id: metadata.proposalId },
        data: {
          ...(metadata.paymentType === 'deposit'
            ? { depositPaid: true, depositPaidAt: new Date() }
            : {}),
          stripePaymentIntentId: paymentIntent.id,
        },
      });

      this.logger.log(`Deposit paid for proposal: ${metadata.proposalId}`);
    }
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    if (session.metadata?.type === 'template_purchase') {
      await this.templateMarketplaceService.fulfillPaidPurchase(session);
      return;
    }

    if (session.mode === 'subscription') {
      await this.billingService.applyCheckoutCompleted(session);
      return;
    }

    const invoiceId = session.metadata?.invoiceId;
    if (invoiceId) {
      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id;
      await this.prisma.invoice.updateMany({
        where: { id: invoiceId },
        data: {
          status: 'paid',
          amountDue: 0,
          paidDate: new Date(),
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
        },
      });
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    await this.prisma.proposalPayment.updateMany({
      where: {
        metadata: { path: ['checkoutSessionId'], equals: session.id },
      },
      data: {
        status: 'succeeded',
        paidAt: new Date(),
        ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
      },
    });

    if (paymentIntentId) {
      await this.paymentsService.handlePaymentSuccess(paymentIntentId);
    }
  }
}
