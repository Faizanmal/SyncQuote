import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceService } from '../invoices/services/invoice.service';

@Injectable()
export class PaymentsHubService {
  constructor(
    private prisma: PrismaService,
    private invoiceService: InvoiceService,
  ) {}

  async getOverview(userId: string) {
    const [invoiceStats, paymentTotals, succeeded, activeSubs] = await Promise.all([
      this.invoiceService.getInvoiceStats(userId),
      this.prisma.proposalPayment.aggregate({
        where: { proposal: { userId } },
        _count: true,
        _sum: { amount: true },
      }),
      this.prisma.proposalPayment.aggregate({
        where: { proposal: { userId }, status: 'succeeded' },
        _count: true,
        _sum: { amount: true },
      }),
      this.prisma.clientSubscription.count({
        where: { userId, status: 'active' },
      }),
    ]);

    const totalRevenue = (succeeded._sum.amount || 0) + invoiceStats.totalRevenue;
    const successRate =
      paymentTotals._count > 0 ? (succeeded._count / paymentTotals._count) * 100 : 100;

    return {
      totalRevenue,
      revenueGrowth: 0,
      mrr: activeSubs ? invoiceStats.paidThisMonth : 0,
      mrrGrowth: 0,
      activeSubscriptions: activeSubs,
      subscriptionGrowth: 0,
      churnRate: 0,
      successRate,
      successRateGrowth: 0,
    };
  }

  async listInvoices(userId: string, search?: string, status?: string) {
    const { data: invoices } = await this.invoiceService.getInvoicesByUser(userId, {
      ...(status && status !== 'all' ? { status: status as any } : {}),
      search,
      limit: 100,
    });

    return invoices.map((inv) => ({
      id: inv.id,
      number: inv.invoiceNumber,
      customerId: inv.clientEmail,
      customerName: inv.clientName,
      customerEmail: inv.clientEmail,
      status: inv.status,
      amount: inv.totalAmount,
      currency: inv.currency,
      dueDate: inv.dueDate,
      paidDate: inv.paidDate,
      items: inv.lineItems,
      notes: inv.notes,
      terms: inv.paymentTerms,
      remindersSent: 0,
      autoCollection: false,
      createdAt: inv.createdAt,
    }));
  }

  async createInvoice(userId: string, body: any) {
    const clientEmail = body.clientEmail || body.customerEmail || body.customerId;
    const clientName = body.clientName || body.customerName || clientEmail;
    if (!clientEmail || !body.dueDate) {
      throw new BadRequestException('Client email and due date are required');
    }
    const items = body.items || body.lineItems || [];
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('At least one line item is required');
    }
    return this.invoiceService.createInvoice(userId, {
      clientEmail,
      clientName,
      dueDate: new Date(body.dueDate),
      lineItems: items.map((item: any) => ({
        description: item.description,
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
      })),
      notes: body.notes,
    });
  }

  async sendInvoice(userId: string, invoiceId: string) {
    return this.invoiceService.sendInvoice(userId, invoiceId);
  }

  async listTransactions(userId: string) {
    const payments = await this.prisma.proposalPayment.findMany({
      where: { proposal: { userId } },
      include: { proposal: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return payments.map((payment) => ({
      id: payment.id,
      type: payment.status === 'refunded' ? 'refund' : 'payment',
      status: payment.status === 'succeeded' ? 'succeeded' : payment.status,
      amount: payment.amount,
      currency: payment.currency,
      customerName: payment.payerName || payment.payerEmail,
      description: `${payment.type} for ${payment.proposal.title}`,
      paymentMethod: 'card',
      processingFee: 0,
      netAmount: payment.amount,
      metadata: payment.metadata || {},
      createdAt: payment.createdAt,
      settledAt: payment.paidAt,
    }));
  }

  async listCustomers(userId: string, search?: string) {
    const { data: invoices } = await this.invoiceService.getInvoicesByUser(userId, { limit: 100 });
    const byEmail = new Map<string, typeof invoices>();
    for (const invoice of invoices) {
      const list = byEmail.get(invoice.clientEmail) || [];
      list.push(invoice);
      byEmail.set(invoice.clientEmail, list);
    }

    let customers = [...byEmail.entries()].map(([email, list]) => {
      const paid = list.filter((inv) => inv.status === 'paid');
      return {
        id: email,
        name: list[0].clientName,
        email,
        company: list[0].clientCompany,
        address: {
          line1: list[0].clientAddress || '',
          city: '',
          state: '',
          postalCode: '',
          country: '',
        },
        paymentMethods: [],
        balance: list
          .filter((inv) => ['sent', 'viewed', 'overdue'].includes(inv.status))
          .reduce((s, inv) => s + inv.amountDue, 0),
        totalSpent: paid.reduce((s, inv) => s + inv.totalAmount, 0),
        lifetimeValue: paid.reduce((s, inv) => s + inv.totalAmount, 0),
        subscriptions: 0,
        invoices: list.length,
        lastPayment: paid[0]?.paidDate,
        riskLevel: 'low' as const,
        tags: [],
        createdAt: list[0].createdAt,
      };
    });

    if (search) {
      const q = search.toLowerCase();
      customers = customers.filter(
        (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
      );
    }
    return customers;
  }

  async listPlans(userId: string) {
    const plans = await this.prisma.clientBillingPlan.findMany({
      where: { userId },
      include: { _count: { select: { subscriptions: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description || '',
      amount: plan.amount,
      currency: plan.currency,
      interval: plan.interval,
      intervalCount: plan.intervalCount,
      trialDays: plan.trialDays,
      features: (plan.features as string[]) || [],
      isPopular: plan.isPopular,
      isActive: plan.isActive,
      subscriberCount: plan._count.subscriptions,
      revenue: 0,
      conversionRate: 0,
      createdAt: plan.createdAt,
    }));
  }

  async createPlan(userId: string, body: any) {
    return this.prisma.clientBillingPlan.create({
      data: {
        userId,
        name: body.name,
        description: body.description,
        amount: Number(body.amount) || 0,
        currency: body.currency || 'USD',
        interval: body.interval || 'month',
        trialDays: body.trialDays,
        features: body.features || [],
      },
    });
  }

  async listSubscriptions(userId: string, status?: string) {
    const subscriptions = await this.prisma.clientSubscription.findMany({
      where: { userId, ...(status && status !== 'all' ? { status } : {}) },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    return subscriptions.map((sub) => ({
      id: sub.id,
      customerId: sub.customerEmail,
      customerName: sub.customerName,
      planId: sub.planId,
      planName: sub.plan.name,
      status: sub.status,
      amount: sub.amount,
      currency: sub.currency,
      interval: sub.interval,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      nextPayment: sub.nextPayment,
      paymentMethod: 'invoice',
      discounts: [],
      createdAt: sub.createdAt,
      pausedAt: sub.pausedAt,
      cancelledAt: sub.cancelledAt,
    }));
  }

  async createSubscription(userId: string, body: any) {
    const plan = await this.prisma.clientBillingPlan.findFirst({
      where: { id: body.planId, userId },
    });
    if (!plan) {
      throw new BadRequestException('Plan not found');
    }
    const customers = await this.listCustomers(userId);
    const customer = customers.find((c) => c.id === body.customerId) || {
      name: body.customerId,
      email: body.customerId,
    };
    const start = new Date();
    const end = new Date(start);
    if (plan.interval === 'year') {
      end.setFullYear(end.getFullYear() + 1);
    } else if (plan.interval === 'week') {
      end.setDate(end.getDate() + 7);
    } else {
      end.setMonth(end.getMonth() + 1);
    }
    return this.prisma.clientSubscription.create({
      data: {
        userId,
        planId: plan.id,
        customerName: customer.name,
        customerEmail: customer.email,
        amount: plan.amount,
        currency: plan.currency,
        interval: plan.interval,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        nextPayment: end,
      },
    });
  }

  async pauseSubscription(userId: string, id: string) {
    return this.prisma.clientSubscription.updateMany({
      where: { id, userId },
      data: { status: 'paused', pausedAt: new Date() },
    });
  }

  async cancelSubscription(userId: string, id: string) {
    return this.prisma.clientSubscription.updateMany({
      where: { id, userId },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });
  }
}
