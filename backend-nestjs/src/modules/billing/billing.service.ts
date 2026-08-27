import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutSessionDto, CreatePortalSessionDto } from './dto/billing.dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-06-20',
    });
  }

  async getSubscription(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const plan = this.planFromPriceId(user.metadata as Record<string, unknown> | null);

    if (user.stripeSubscriptionId) {
      try {
        const subscription = await this.stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        const priceId = subscription.items.data[0]?.price?.id;
        return {
          status: this.mapStripeStatus(subscription.status),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          plan: this.planFromPriceId(null, priceId) || plan || 'pro',
          trialEndsAt: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : user.trialEndsAt?.toISOString(),
        };
      } catch (error) {
        this.logger.warn(`Could not load Stripe subscription: ${(error as Error).message}`);
      }
    }

    const isTrialing =
      user.subscriptionStatus === 'TRIAL' && user.trialEndsAt && user.trialEndsAt > new Date();

    return {
      status: isTrialing ? 'trialing' : this.mapDbStatus(user.subscriptionStatus),
      currentPeriodEnd: (user.subscriptionEndsAt || user.trialEndsAt || new Date()).toISOString(),
      cancelAtPeriodEnd: user.subscriptionStatus === 'CANCELED',
      plan:
        user.subscriptionStatus === 'ACTIVE' || user.subscriptionStatus === 'PAST_DUE'
          ? plan || 'pro'
          : 'free',
      trialEndsAt: user.trialEndsAt?.toISOString(),
    };
  }

  async getPaymentMethod(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeCustomerId) {
      return null;
    }

    const methods = await this.stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: 'card',
      limit: 1,
    });

    const card = methods.data[0];
    if (!card?.card) {
      return null;
    }

    return {
      id: card.id,
      brand: card.card.brand,
      last4: card.card.last4,
      expMonth: card.card.exp_month,
      expYear: card.card.exp_year,
    };
  }

  async createCheckoutSession(userId: string, dto: CreateCheckoutSessionDto) {
    const secret = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secret) {
      throw new BadRequestException('Stripe is not configured');
    }

    const allowed = [
      this.configService.get<string>('STRIPE_PRO_PRICE_ID'),
      this.configService.get<string>('STRIPE_ENTERPRISE_PRICE_ID'),
      this.configService.get<string>('STRIPE_PRICE_ID'),
    ].filter(Boolean);

    if (allowed.length > 0 && !allowed.includes(dto.priceId)) {
      throw new BadRequestException('Unknown price');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const customerId = await this.ensureCustomer(user.id, user.email, user.name);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: dto.priceId, quantity: 1 }],
      success_url: dto.successUrl,
      cancel_url: dto.cancelUrl,
      client_reference_id: user.id,
      subscription_data: {
        metadata: { userId: user.id, priceId: dto.priceId },
      },
      metadata: { userId: user.id, priceId: dto.priceId },
    });

    if (!session.id) {
      throw new BadRequestException('Failed to create checkout session');
    }

    return { sessionId: session.id, url: session.url };
  }

  async createPortalSession(userId: string, dto: CreatePortalSessionDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeCustomerId) {
      throw new BadRequestException('No billing customer on this account');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: dto.returnUrl || `${frontendUrl}/settings/billing`,
    });

    return { url: session.url };
  }

  async applyCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.client_reference_id || session.metadata?.userId;
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    const priceId = session.metadata?.priceId;

    if (!userId && !customerId) {
      return;
    }

    const user = userId
      ? await this.prisma.user.findUnique({ where: { id: userId } })
      : await this.prisma.user.findFirst({ where: { stripeCustomerId: customerId } });

    if (!user) {
      return;
    }

    const metadata = {
      ...((user.metadata as Record<string, unknown>) || {}),
      stripePriceId: priceId,
    };

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        stripeCustomerId: customerId || user.stripeCustomerId,
        stripeSubscriptionId: subscriptionId || user.stripeSubscriptionId,
        subscriptionStatus: 'ACTIVE',
        metadata,
      },
    });
  }

  private async ensureCustomer(userId: string, email: string, name?: string | null) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await this.stripe.customers.create({
      email,
      name: name || undefined,
      metadata: { userId },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  private planFromPriceId(metadata: Record<string, unknown> | null, priceId?: string) {
    const id =
      priceId || (typeof metadata?.stripePriceId === 'string' ? metadata.stripePriceId : '');
    const pro =
      this.configService.get<string>('STRIPE_PRO_PRICE_ID') ||
      this.configService.get<string>('STRIPE_PRICE_ID');
    const enterprise = this.configService.get<string>('STRIPE_ENTERPRISE_PRICE_ID');
    if (id && enterprise && id === enterprise) {
      return 'enterprise' as const;
    }
    if (id && pro && id === pro) {
      return 'pro' as const;
    }
    return null;
  }

  private mapStripeStatus(status: Stripe.Subscription.Status) {
    switch (status) {
      case 'active':
        return 'active';
      case 'trialing':
        return 'trialing';
      case 'past_due':
        return 'past_due';
      case 'canceled':
      case 'unpaid':
        return 'canceled';
      default:
        return 'incomplete';
    }
  }

  private mapDbStatus(status: string) {
    switch (status) {
      case 'ACTIVE':
        return 'active';
      case 'TRIAL':
        return 'trialing';
      case 'PAST_DUE':
        return 'past_due';
      case 'CANCELED':
        return 'canceled';
      default:
        return 'incomplete';
    }
  }
}
