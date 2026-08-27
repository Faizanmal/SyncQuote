import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  RawBodyRequest,
  Headers,
} from '@nestjs/common';
import { PaymentsService, CreatePaymentIntentDto } from './payments.service';
import { PaymentsHubService } from './payments-hub.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import Stripe from 'stripe';

@Controller('payments')
export class PaymentsController {
  private stripe: Stripe;

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentsHubService: PaymentsHubService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2024-06-20',
    });
  }

  // Public endpoint - clients use this to pay
  @Post('create-intent')
  async createPaymentIntent(@Body() data: CreatePaymentIntentDto) {
    return this.paymentsService.createPaymentIntent(data);
  }

  @Post('create-checkout-session')
  async createProposalCheckout(
    @Body()
    data: CreatePaymentIntentDto & { successUrl: string; cancelUrl: string },
  ) {
    return this.paymentsService.createCheckoutSession(data);
  }

  // Public endpoint - get payment summary for a proposal
  @Get('proposal/:proposalId/summary')
  async getPaymentSummary(@Param('proposalId') proposalId: string) {
    return this.paymentsService.getPaymentSummary(proposalId);
  }

  // Stripe webhook
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(req.rawBody as Buffer, signature, webhookSecret);
    } catch (err: any) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await this.paymentsService.handlePaymentSuccess(paymentIntent.id);
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        await this.paymentsService.handlePaymentFailed(
          failedPayment.id,
          failedPayment.last_payment_error?.message || 'Payment failed',
        );
        break;

      case 'account.updated':
        // Handle Stripe Connect account updates
        // This is triggered when a connected account completes onboarding
        break;
    }

    return { received: true };
  }

  @Get('overview')
  @UseGuards(JwtAuthGuard)
  getOverview(
    @Req() req: any,
    @Query('range') _range?: string,
    @Query('currency') _currency?: string,
  ) {
    return this.paymentsHubService.getOverview(req.user.sub || req.user.id);
  }

  @Get('invoices')
  @UseGuards(JwtAuthGuard)
  listInvoices(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.paymentsHubService.listInvoices(req.user.sub || req.user.id, search, status);
  }

  @Post('invoices')
  @UseGuards(JwtAuthGuard)
  createInvoice(@Req() req: any, @Body() body: any) {
    return this.paymentsHubService.createInvoice(req.user.sub || req.user.id, body);
  }

  @Post('invoices/:invoiceId/send')
  @UseGuards(JwtAuthGuard)
  async sendHubInvoice(@Req() req: any, @Param('invoiceId') invoiceId: string) {
    await this.paymentsHubService.sendInvoice(req.user.sub || req.user.id, invoiceId);
    return { success: true };
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  listTransactions(@Req() req: any) {
    return this.paymentsHubService.listTransactions(req.user.sub || req.user.id);
  }

  @Get('customers')
  @UseGuards(JwtAuthGuard)
  listCustomers(@Req() req: any, @Query('search') search?: string) {
    return this.paymentsHubService.listCustomers(req.user.sub || req.user.id, search);
  }

  @Get('plans')
  @UseGuards(JwtAuthGuard)
  listPlans(@Req() req: any) {
    return this.paymentsHubService.listPlans(req.user.sub || req.user.id);
  }

  @Post('plans')
  @UseGuards(JwtAuthGuard)
  createPlan(@Req() req: any, @Body() body: any) {
    return this.paymentsHubService.createPlan(req.user.sub || req.user.id, body);
  }

  @Get('subscriptions')
  @UseGuards(JwtAuthGuard)
  listSubscriptions(@Req() req: any, @Query('status') status?: string) {
    return this.paymentsHubService.listSubscriptions(req.user.sub || req.user.id, status);
  }

  @Post('subscriptions')
  @UseGuards(JwtAuthGuard)
  createSubscription(@Req() req: any, @Body() body: any) {
    return this.paymentsHubService.createSubscription(req.user.sub || req.user.id, body);
  }

  @Post('subscriptions/:id/pause')
  @UseGuards(JwtAuthGuard)
  pauseSubscription(@Req() req: any, @Param('id') id: string) {
    return this.paymentsHubService.pauseSubscription(req.user.sub || req.user.id, id);
  }

  @Post('subscriptions/:id/cancel')
  @UseGuards(JwtAuthGuard)
  cancelSubscription(@Req() req: any, @Param('id') id: string) {
    return this.paymentsHubService.cancelSubscription(req.user.sub || req.user.id, id);
  }

  // Protected endpoints for proposal owners
  @Get('proposal/:proposalId')
  @UseGuards(JwtAuthGuard)
  async getProposalPayments(@Param('proposalId') proposalId: string) {
    return this.paymentsService.getProposalPayments(proposalId);
  }

  @Post(':paymentId/refund')
  @UseGuards(JwtAuthGuard)
  async refundPayment(
    @Req() req: any,
    @Param('paymentId') paymentId: string,
    @Body() body: { reason?: string },
  ) {
    return this.paymentsService.refundPayment(paymentId, req.user.sub, body.reason);
  }

  // Stripe Connect endpoints
  @Post('connect/create')
  @UseGuards(JwtAuthGuard)
  async createConnectAccount(@Req() req: any) {
    return this.paymentsService.createConnectAccount(req.user.sub, req.user.email);
  }

  @Get('connect/link')
  @UseGuards(JwtAuthGuard)
  async getConnectAccountLink(
    @Req() req: any,
    @Query('returnUrl') returnUrl: string,
    @Query('refreshUrl') refreshUrl: string,
  ) {
    return this.paymentsService.createConnectAccountLink(req.user.sub, returnUrl, refreshUrl);
  }

  @Get('connect/status')
  @UseGuards(JwtAuthGuard)
  async getConnectStatus(@Req() req: any) {
    return this.paymentsService.getConnectAccountStatus(req.user.sub);
  }
}
