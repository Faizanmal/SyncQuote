import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AutomationService, AutomationTrigger } from '../automation/automation.service';
import Stripe from 'stripe';

export interface CreatePaymentIntentDto {
  proposalId: string;
  type: 'deposit' | 'milestone' | 'final';
  amount?: number; // Optional, will calculate from proposal if not provided
  payerEmail: string;
  payerName?: string;
}

export interface PaymentSummary {
  proposalId: string;
  totalValue: number;
  depositRequired: boolean;
  depositAmount: number;
  depositPaid: boolean;
  payments: {
    id: string;
    type: string;
    amount: number;
    status: string;
    paidAt: Date | null;
  }[];
  remainingBalance: number;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private automationService: AutomationService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2024-06-20',
    });
  }

  async createPaymentIntent(data: CreatePaymentIntentDto) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: data.proposalId },
      include: {
        user: true,
        blocks: {
          include: { pricingItems: true },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Calculate amount if not provided
    let amount = data.amount;
    if (!amount) {
      if (data.type === 'deposit') {
        amount = this.calculateDeposit(proposal);
      } else {
        amount = this.calculateTotal(proposal);
      }
    }

    if (amount <= 0) {
      throw new BadRequestException('Invalid payment amount');
    }

    // Check if user has Stripe Connect enabled
    const connectAccountId = proposal.user.stripeConnectId;

    // Create payment intent
    const paymentIntentData: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(amount * 100), // Convert to cents
      currency: proposal.currency.toLowerCase(),
      metadata: {
        proposalId: proposal.id,
        proposalTitle: proposal.title,
        paymentType: data.type,
        userId: proposal.userId,
      },
      receipt_email: data.payerEmail,
      description: `${data.type.charAt(0).toUpperCase() + data.type.slice(1)} for: ${proposal.title}`,
    };

    // If user has Stripe Connect, send payment to them
    if (connectAccountId && proposal.user.stripeConnectEnabled) {
      // Calculate platform fee (e.g., 2.9% + $0.30)
      const platformFee = Math.round(amount * 0.029 * 100) + 30;

      paymentIntentData.application_fee_amount = platformFee;
      paymentIntentData.transfer_data = {
        destination: connectAccountId,
      };
    }

    const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentData);

    // Create payment record
    await this.prisma.proposalPayment.create({
      data: {
        proposalId: proposal.id,
        type: data.type,
        amount,
        currency: proposal.currency,
        stripePaymentIntentId: paymentIntent.id,
        status: 'pending',
        payerEmail: data.payerEmail,
        payerName: data.payerName,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
      currency: proposal.currency,
    };
  }

  async handlePaymentSuccess(paymentIntentId: string) {
    const payment = await this.prisma.proposalPayment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!payment) {
      this.logger.warn(`Payment record not found for: ${paymentIntentId}`);
      return;
    }

    // Update payment status
    await this.prisma.proposalPayment.update({
      where: { id: payment.id },
      data: {
        status: 'succeeded',
        paidAt: new Date(),
      },
    });

    // Update proposal if it's a deposit
    if (payment.type === 'deposit') {
      await this.prisma.proposal.update({
        where: { id: payment.proposalId },
        data: {
          depositPaid: true,
          depositPaidAt: new Date(),
          stripePaymentIntentId: paymentIntentId,
        },
      });
    }

    // Get proposal for notifications
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: payment.proposalId },
    });

    if (proposal) {
      // Send notification to proposal owner
      await this.notificationsService.create({
        userId: proposal.userId,
        type: 'payment_received',
        title: 'Payment Received!',
        message: `${payment.payerName || payment.payerEmail} paid $${payment.amount} for "${proposal.title}"`,
        proposalId: proposal.id,
        metadata: {
          amount: payment.amount,
          currency: payment.currency,
          paymentType: payment.type,
        },
      });

      // Trigger automation workflows
      await this.automationService.triggerWorkflows(
        AutomationTrigger.PAYMENT_RECEIVED,
        proposal.id,
        {
          amount: payment.amount,
          paymentType: payment.type,
          payerEmail: payment.payerEmail,
        },
      );
    }
  }

  async handlePaymentFailed(paymentIntentId: string, errorMessage: string) {
    await this.prisma.proposalPayment.updateMany({
      where: { stripePaymentIntentId: paymentIntentId },
      data: {
        status: 'failed',
        metadata: { error: errorMessage },
      },
    });
  }

  async getPaymentSummary(proposalId: string): Promise<PaymentSummary> {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        blocks: {
          include: { pricingItems: true },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    const payments = await this.prisma.proposalPayment.findMany({
      where: { proposalId },
      orderBy: { createdAt: 'desc' },
    });

    const totalValue = this.calculateTotal(proposal);
    const depositAmount = this.calculateDeposit(proposal);
    const paidAmount = payments
      .filter((p: any) => p.status === 'succeeded')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      proposalId,
      totalValue,
      depositRequired: proposal.depositRequired,
      depositAmount,
      depositPaid: proposal.depositPaid,
      payments: payments.map((p) => ({
        id: p.id,
        type: p.type,
        amount: p.amount,
        status: p.status,
        paidAt: p.paidAt,
      })),
      remainingBalance: totalValue - paidAmount,
    };
  }

  async getProposalPayments(proposalId: string) {
    return this.prisma.proposalPayment.findMany({
      where: { proposalId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async refundPayment(paymentId: string, userId: string, reason?: string) {
    const payment = await this.prisma.proposalPayment.findUnique({
      where: { id: paymentId },
      include: {
        proposal: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Verify ownership
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: payment.proposalId },
    });

    if (proposal?.userId !== userId) {
      throw new BadRequestException('Not authorized to refund this payment');
    }

    if (payment.status !== 'succeeded') {
      throw new BadRequestException('Can only refund successful payments');
    }

    // Process refund via Stripe
    if (payment.stripePaymentIntentId) {
      await this.stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        reason: 'requested_by_customer',
      });
    }

    // Update payment record
    await this.prisma.proposalPayment.update({
      where: { id: paymentId },
      data: {
        status: 'refunded',
        refundedAt: new Date(),
        metadata: {
          ...((payment.metadata as object) || {}),
          refundReason: reason,
        },
      },
    });

    // If it was a deposit, update proposal
    if (payment.type === 'deposit') {
      await this.prisma.proposal.update({
        where: { id: payment.proposalId },
        data: {
          depositPaid: false,
          depositPaidAt: null,
        },
      });
    }

    return { success: true };
  }

  // Helper methods
  private calculateTotal(proposal: any): number {
    let total = 0;

    for (const block of proposal.blocks) {
      if (block.type === 'PRICING_TABLE' && block.pricingItems) {
        for (const item of block.pricingItems) {
          if (item.type !== 'OPTIONAL') {
            total += item.price;
          }
        }
      }
    }

    // Apply tax if configured
    if (proposal.taxRate > 0) {
      total = total * (1 + proposal.taxRate / 100);
    }

    return Math.round(total * 100) / 100;
  }

  private calculateDeposit(proposal: any): number {
    if (!proposal.depositRequired) return 0;

    const total = this.calculateTotal(proposal);

    if (proposal.depositAmount) {
      return proposal.depositAmount;
    }

    if (proposal.depositPercentage) {
      return Math.round(total * (proposal.depositPercentage / 100) * 100) / 100;
    }

    // Default to 50% if deposit is required but no amount specified
    return Math.round(total * 0.5 * 100) / 100;
  }

  // Stripe Connect methods
  async createConnectAccount(userId: string, email: string) {
    const account = await this.stripe.accounts.create({
      type: 'express',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        stripeConnectId: account.id,
        stripeConnectEnabled: false, // Will be enabled after onboarding
      },
    });

    return account;
  }

  async createConnectAccountLink(userId: string, returnUrl: string, refreshUrl: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.stripeConnectId) {
      throw new BadRequestException('Stripe Connect account not found');
    }

    const accountLink = await this.stripe.accountLinks.create({
      account: user.stripeConnectId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return accountLink;
  }

  async getConnectAccountStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.stripeConnectId) {
      return { connected: false };
    }

    const account = await this.stripe.accounts.retrieve(user.stripeConnectId);

    const isEnabled = account.charges_enabled && account.payouts_enabled;

    // Update local status
    if (isEnabled !== user.stripeConnectEnabled) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeConnectEnabled: isEnabled },
      });
    }

    return {
      connected: true,
      enabled: isEnabled,
      accountId: user.stripeConnectId,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    };
  }
}
