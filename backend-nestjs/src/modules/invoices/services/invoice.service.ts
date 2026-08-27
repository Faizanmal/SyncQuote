import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../email/email.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { normalizePagination, paginatedResult } from '../../../common/pagination';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  proposalId?: string;
  userId: string;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled' | 'refunded';

  // Client info
  clientName: string;
  clientEmail: string;
  clientCompany?: string;
  clientAddress?: string;

  // Provider info
  providerName: string;
  providerCompany?: string;
  providerEmail: string;
  providerAddress?: string;

  // Line items
  lineItems: InvoiceLineItem[];

  // Amounts
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;

  // Dates
  invoiceDate: Date;
  dueDate: Date;
  paidDate?: Date;

  // Payment
  currency: string;
  paymentTerms?: string;
  notes?: string;
  stripePaymentIntentId?: string;
  stripeInvoiceId?: string;

  // Metadata
  pdfUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInvoiceDto {
  proposalId?: string;
  clientName: string;
  clientEmail: string;
  clientCompany?: string;
  clientAddress?: string;
  lineItems: Omit<InvoiceLineItem, 'amount'>[];
  dueDate: Date;
  taxRate?: number;
  discountPercent?: number;
  discountAmount?: number;
  paymentTerms?: string;
  notes?: string;
  currency?: string;
}

export interface RecurringInvoiceConfig {
  id: string;
  userId: string;
  templateInvoice: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt'>;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';
  startDate: Date;
  endDate?: Date;
  nextInvoiceDate: Date;
  isActive: boolean;
  invoiceCount: number;
  lastGeneratedAt?: Date;
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async createInvoice(userId: string, dto: CreateInvoiceDto): Promise<Invoice> {
    this.logger.log(`Creating invoice for user ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, companyName: true, email: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Calculate line item amounts
    const lineItems: InvoiceLineItem[] = dto.lineItems.map((item) => ({
      ...item,
      amount: item.quantity * item.unitPrice,
      taxRate: dto.taxRate,
    }));

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = dto.taxRate ? subtotal * (dto.taxRate / 100) : 0;
    const discountAmount =
      dto.discountAmount || (dto.discountPercent ? subtotal * (dto.discountPercent / 100) : 0);
    const totalAmount = subtotal + taxAmount - discountAmount;

    const invoice: Invoice = {
      id: uuidv4(),
      invoiceNumber: await this.generateInvoiceNumber(userId),
      proposalId: dto.proposalId,
      userId,
      status: 'draft',

      clientName: dto.clientName,
      clientEmail: dto.clientEmail,
      clientCompany: dto.clientCompany,
      clientAddress: dto.clientAddress,

      providerName: user.name || '',
      providerCompany: user.companyName || undefined,
      providerEmail: user.email,

      lineItems,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      amountPaid: 0,
      amountDue: totalAmount,

      invoiceDate: new Date(),
      dueDate: dto.dueDate,

      currency: dto.currency || 'USD',
      paymentTerms: dto.paymentTerms,
      notes: dto.notes,

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store invoice (in production, would use dedicated Invoice table)
    await this.storeInvoice(userId, invoice);

    return invoice;
  }

  async createInvoiceFromProposal(
    userId: string,
    proposalId: string,
    options?: {
      dueDate?: Date;
      paymentTerms?: string;
      notes?: string;
    },
  ): Promise<Invoice> {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: proposalId, userId },
      include: {
        blocks: { include: { pricingItems: true } },
        user: { select: { name: true, companyName: true, email: true } },
      },
    });

    if (!proposal) {
      throw new BadRequestException('Proposal not found');
    }

    if (proposal.status !== 'SIGNED' && proposal.status !== 'APPROVED') {
      throw new BadRequestException('Can only create invoice from approved/signed proposals');
    }

    // Extract line items from pricing blocks
    const lineItems: Omit<InvoiceLineItem, 'amount'>[] = [];

    for (const block of proposal.blocks) {
      if (block.type === 'PRICING_TABLE') {
        for (const item of block.pricingItems) {
          lineItems.push({
            description: item.name + (item.description ? ` - ${item.description}` : ''),
            quantity: 1,
            unitPrice: item.price,
          });
        }
      }
    }

    // Default due date is 30 days from now
    const dueDate = options?.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    return this.createInvoice(userId, {
      proposalId,
      clientName: proposal.recipientName || '',
      clientEmail: proposal.recipientEmail || '',
      lineItems,
      dueDate,
      taxRate: proposal.taxRate || 0,
      paymentTerms: options?.paymentTerms || 'Net 30',
      notes: options?.notes,
      currency: proposal.currency,
    });
  }

  async sendInvoice(userId: string, invoiceId: string): Promise<void> {
    const invoice = await this.getInvoice(userId, invoiceId);
    if (!invoice) {
      throw new BadRequestException('Invoice not found');
    }

    const frontendUrl = this.configService.get('FRONTEND_URL') || 'https://app.syncquote.com';
    const invoiceUrl = `${frontendUrl}/invoices/${invoiceId}`;

    await this.emailService.sendEmail({
      to: invoice.clientEmail,
      subject: `Invoice ${invoice.invoiceNumber} from ${invoice.providerCompany || invoice.providerName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Invoice ${invoice.invoiceNumber}</h2>
          <p>Dear ${invoice.clientName},</p>
          <p>Please find attached your invoice.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Invoice Number:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${invoice.invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Amount Due:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">$${invoice.amountDue.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Due Date:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${new Date(invoice.dueDate).toLocaleDateString()}</td>
            </tr>
          </table>
          
          <p>
            <a href="${invoiceUrl}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View & Pay Invoice
            </a>
          </p>
          
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            ${invoice.paymentTerms || 'Payment terms: Net 30'}
          </p>
          
          ${invoice.notes ? `<p style="color: #666; font-size: 14px;">${invoice.notes}</p>` : ''}
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            From: ${invoice.providerName}${invoice.providerCompany ? `, ${invoice.providerCompany}` : ''}
          </p>
        </div>
      `,
    });

    // Update invoice status
    invoice.status = 'sent';
    invoice.updatedAt = new Date();
    await this.storeInvoice(userId, invoice);

    this.logger.log(`Invoice ${invoice.invoiceNumber} sent to ${invoice.clientEmail}`);
  }

  async recordPayment(
    userId: string,
    invoiceId: string,
    payment: {
      amount: number;
      method: string;
      reference?: string;
      stripePaymentIntentId?: string;
    },
  ): Promise<Invoice> {
    const invoice = await this.getInvoice(userId, invoiceId);
    if (!invoice) {
      throw new BadRequestException('Invoice not found');
    }

    invoice.amountPaid += payment.amount;
    invoice.amountDue = invoice.totalAmount - invoice.amountPaid;

    if (invoice.amountDue <= 0) {
      invoice.status = 'paid';
      invoice.paidDate = new Date();
    }

    if (payment.stripePaymentIntentId) {
      invoice.stripePaymentIntentId = payment.stripePaymentIntentId;
    }

    invoice.updatedAt = new Date();
    await this.storeInvoice(userId, invoice);

    // Send payment confirmation
    await this.emailService.sendEmail({
      to: invoice.clientEmail,
      subject: `Payment Received - Invoice ${invoice.invoiceNumber}`,
      html: `
        <h2>Payment Received</h2>
        <p>Thank you for your payment of $${payment.amount.toLocaleString()} for invoice ${invoice.invoiceNumber}.</p>
        ${invoice.amountDue > 0 ? `<p>Remaining balance: $${invoice.amountDue.toLocaleString()}</p>` : '<p>Your invoice has been paid in full.</p>'}
      `,
    });

    return invoice;
  }

  async getInvoice(userId: string, invoiceId: string): Promise<Invoice | null> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
    });
    return invoice ? this.serialize(invoice) : null;
  }

  async getPublicInvoice(invoiceId: string): Promise<Invoice | null> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    return invoice ? this.serialize(invoice) : null;
  }

  async createPublicCheckout(invoiceId: string, successUrl: string, cancelUrl: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      throw new BadRequestException('Invoice not found');
    }
    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      throw new BadRequestException('Invoice cannot be paid');
    }

    const stripe = new (await import('stripe')).default(
      this.configService.get<string>('STRIPE_SECRET_KEY') || '',
      { apiVersion: '2024-06-20' },
    );

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: invoice.clientEmail,
      line_items: [
        {
          price_data: {
            currency: invoice.currency.toLowerCase(),
            product_data: { name: `Invoice ${invoice.invoiceNumber}` },
            unit_amount: Math.round(invoice.amountDue * 100),
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { invoiceId: invoice.id, type: 'client_invoice' },
      payment_intent_data: {
        metadata: { invoiceId: invoice.id, type: 'client_invoice' },
      },
    });

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    return { sessionId: session.id, url: session.url };
  }

  async getInvoicesByUser(
    userId: string,
    filters?: {
      status?: Invoice['status'];
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
      search?: string;
    },
  ) {
    const { page, limit, skip, take } = normalizePagination(filters);
    const search = filters?.search?.trim();
    const where = {
      userId,
      ...(filters?.status && filters.status !== 'all' ? { status: filters.status } : {}),
      ...(search
        ? {
            OR: [
              { clientName: { contains: search, mode: 'insensitive' as const } },
              { clientEmail: { contains: search, mode: 'insensitive' as const } },
              { invoiceNumber: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(filters?.startDate || filters?.endDate
        ? {
            invoiceDate: {
              ...(filters.startDate ? { gte: filters.startDate } : {}),
              ...(filters.endDate ? { lte: filters.endDate } : {}),
            },
          }
        : {}),
    };

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return paginatedResult(
      invoices.map((invoice) => this.serialize(invoice)),
      total,
      page,
      limit,
    );
  }

  async getInvoiceStats(userId: string): Promise<{
    totalRevenue: number;
    outstanding: number;
    overdue: number;
    paidThisMonth: number;
    invoiceCount: number;
    averageInvoice: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const paidStatuses = ['paid', 'PAID'];
    const openStatuses = ['sent', 'viewed'];

    const [paid, outstanding, overdue, paidThisMonth, totals] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { userId, status: { in: paidStatuses } },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.aggregate({
        where: { userId, status: { in: openStatuses } },
        _sum: { amountDue: true },
      }),
      this.prisma.invoice.aggregate({
        where: { userId, status: { in: openStatuses }, dueDate: { lt: now } },
        _sum: { amountDue: true },
      }),
      this.prisma.invoice.aggregate({
        where: { userId, status: { in: paidStatuses }, paidDate: { gte: startOfMonth } },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.aggregate({
        where: { userId },
        _count: true,
        _avg: { totalAmount: true },
      }),
    ]);

    return {
      totalRevenue: paid._sum.totalAmount || 0,
      outstanding: outstanding._sum.amountDue || 0,
      overdue: overdue._sum.amountDue || 0,
      paidThisMonth: paidThisMonth._sum.totalAmount || 0,
      invoiceCount: totals._count,
      averageInvoice: totals._avg.totalAmount || 0,
    };
  }

  // Recurring Invoices
  async createRecurringInvoice(
    userId: string,
    config: Omit<
      RecurringInvoiceConfig,
      'id' | 'nextInvoiceDate' | 'invoiceCount' | 'lastGeneratedAt'
    >,
  ): Promise<RecurringInvoiceConfig> {
    const recurringConfig: RecurringInvoiceConfig = {
      ...config,
      id: uuidv4(),
      nextInvoiceDate: config.startDate,
      invoiceCount: 0,
    };

    const created = await this.prisma.recurringInvoice.create({
      data: {
        id: recurringConfig.id,
        userId,
        template: JSON.parse(JSON.stringify(config.templateInvoice)),
        frequency: config.frequency,
        startDate: config.startDate,
        endDate: config.endDate,
        nextInvoiceDate: config.startDate,
        isActive: config.isActive,
      },
    });

    return {
      ...recurringConfig,
      id: created.id,
      nextInvoiceDate: created.nextInvoiceDate,
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processRecurringInvoices(): Promise<void> {
    this.logger.log('Processing recurring invoices');
    const due = await this.prisma.recurringInvoice.findMany({
      where: {
        isActive: true,
        nextInvoiceDate: { lte: new Date() },
      },
    });

    for (const config of due) {
      try {
        const template = config.template as unknown as CreateInvoiceDto;
        await this.createInvoice(config.userId, {
          ...template,
          dueDate: template.dueDate
            ? new Date(template.dueDate)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        await this.prisma.recurringInvoice.update({
          where: { id: config.id },
          data: {
            invoiceCount: { increment: 1 },
            lastGeneratedAt: new Date(),
            nextInvoiceDate: this.nextDate(config.nextInvoiceDate, config.frequency),
            isActive: config.endDate
              ? this.nextDate(config.nextInvoiceDate, config.frequency) <= config.endDate
              : true,
          },
        });
      } catch (error) {
        this.logger.error(`Recurring invoice ${config.id} failed: ${(error as Error).message}`);
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendOverdueReminders(): Promise<void> {
    this.logger.log('Checking for overdue invoices');
    const overdue = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['sent', 'viewed'] },
        dueDate: { lt: new Date() },
      },
    });

    for (const invoice of overdue) {
      try {
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: 'overdue' },
        });
        await this.emailService.sendEmail({
          to: invoice.clientEmail,
          subject: `Overdue invoice ${invoice.invoiceNumber}`,
          html: `<p>Invoice ${invoice.invoiceNumber} is overdue. Amount due: $${invoice.amountDue}.</p>`,
        });
      } catch (error) {
        this.logger.error(`Overdue reminder ${invoice.id} failed: ${(error as Error).message}`);
      }
    }
  }

  private nextDate(from: Date, frequency: string) {
    const date = new Date(from);
    switch (frequency) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'biweekly':
        date.setDate(date.getDate() + 14);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'annually':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        date.setMonth(date.getMonth() + 1);
    }
    return date;
  }

  private async generateInvoiceNumber(userId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.invoice.count({
      where: { userId, invoiceNumber: { startsWith: `INV-${year}-` } },
    });
    return `INV-${year}-${(count + 1).toString().padStart(5, '0')}`;
  }

  private serialize(invoice: {
    id: string;
    invoiceNumber: string;
    proposalId: string | null;
    userId: string;
    status: string;
    clientName: string;
    clientEmail: string;
    clientCompany: string | null;
    clientAddress: string | null;
    providerName: string;
    providerCompany: string | null;
    providerEmail: string;
    providerAddress: string | null;
    lineItems: unknown;
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    totalAmount: number;
    amountPaid: number;
    amountDue: number;
    invoiceDate: Date;
    dueDate: Date;
    paidDate: Date | null;
    currency: string;
    paymentTerms: string | null;
    notes: string | null;
    stripePaymentIntentId: string | null;
    stripeInvoiceId: string | null;
    pdfUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Invoice {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      proposalId: invoice.proposalId || undefined,
      userId: invoice.userId,
      status: invoice.status as Invoice['status'],
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      clientCompany: invoice.clientCompany || undefined,
      clientAddress: invoice.clientAddress || undefined,
      providerName: invoice.providerName,
      providerCompany: invoice.providerCompany || undefined,
      providerEmail: invoice.providerEmail,
      providerAddress: invoice.providerAddress || undefined,
      lineItems: (invoice.lineItems as InvoiceLineItem[]) || [],
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      discountAmount: invoice.discountAmount,
      totalAmount: invoice.totalAmount,
      amountPaid: invoice.amountPaid,
      amountDue: invoice.amountDue,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      paidDate: invoice.paidDate || undefined,
      currency: invoice.currency,
      paymentTerms: invoice.paymentTerms || undefined,
      notes: invoice.notes || undefined,
      stripePaymentIntentId: invoice.stripePaymentIntentId || undefined,
      stripeInvoiceId: invoice.stripeInvoiceId || undefined,
      pdfUrl: invoice.pdfUrl || undefined,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }

  private async storeInvoice(userId: string, invoice: Invoice): Promise<void> {
    await this.prisma.invoice.upsert({
      where: { id: invoice.id },
      create: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        proposalId: invoice.proposalId,
        userId,
        status: invoice.status,
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail,
        clientCompany: invoice.clientCompany,
        clientAddress: invoice.clientAddress,
        providerName: invoice.providerName,
        providerCompany: invoice.providerCompany,
        providerEmail: invoice.providerEmail,
        providerAddress: invoice.providerAddress,
        lineItems: JSON.parse(JSON.stringify(invoice.lineItems)),
        subtotal: invoice.subtotal,
        taxAmount: invoice.taxAmount,
        discountAmount: invoice.discountAmount,
        totalAmount: invoice.totalAmount,
        amountPaid: invoice.amountPaid,
        amountDue: invoice.amountDue,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        paidDate: invoice.paidDate,
        currency: invoice.currency,
        paymentTerms: invoice.paymentTerms,
        notes: invoice.notes,
        stripePaymentIntentId: invoice.stripePaymentIntentId,
        stripeInvoiceId: invoice.stripeInvoiceId,
        pdfUrl: invoice.pdfUrl,
      },
      update: {
        status: invoice.status,
        lineItems: JSON.parse(JSON.stringify(invoice.lineItems)),
        subtotal: invoice.subtotal,
        taxAmount: invoice.taxAmount,
        discountAmount: invoice.discountAmount,
        totalAmount: invoice.totalAmount,
        amountPaid: invoice.amountPaid,
        amountDue: invoice.amountDue,
        paidDate: invoice.paidDate,
        notes: invoice.notes,
        stripePaymentIntentId: invoice.stripePaymentIntentId,
        stripeInvoiceId: invoice.stripeInvoiceId,
        pdfUrl: invoice.pdfUrl,
      },
    });
  }

  async cancelInvoice(userId: string, invoiceId: string): Promise<void> {
    const invoice = await this.getInvoice(userId, invoiceId);
    if (!invoice) {
      throw new BadRequestException('Invoice not found');
    }

    invoice.status = 'cancelled';
    invoice.updatedAt = new Date();
    await this.storeInvoice(userId, invoice);
  }

  async refundInvoice(userId: string, invoiceId: string, refundAmount?: number): Promise<Invoice> {
    const invoice = await this.getInvoice(userId, invoiceId);
    if (!invoice) {
      throw new BadRequestException('Invoice not found');
    }

    if (invoice.status !== 'paid') {
      throw new BadRequestException('Can only refund paid invoices');
    }

    const amount = refundAmount || invoice.amountPaid;
    invoice.amountPaid -= amount;
    invoice.amountDue = invoice.totalAmount - invoice.amountPaid;
    invoice.status = 'refunded';
    invoice.updatedAt = new Date();

    await this.storeInvoice(userId, invoice);
    return invoice;
  }
}
