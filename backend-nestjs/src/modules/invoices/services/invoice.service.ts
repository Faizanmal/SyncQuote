import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../email/email.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';

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
  private invoiceCounter = 1000;

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
    const lineItems: InvoiceLineItem[] = dto.lineItems.map(item => ({
      ...item,
      amount: item.quantity * item.unitPrice,
      taxRate: dto.taxRate,
    }));

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = dto.taxRate ? subtotal * (dto.taxRate / 100) : 0;
    const discountAmount = dto.discountAmount || (dto.discountPercent ? subtotal * (dto.discountPercent / 100) : 0);
    const totalAmount = subtotal + taxAmount - discountAmount;

    const invoice: Invoice = {
      id: uuidv4(),
      invoiceNumber: this.generateInvoiceNumber(),
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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });

    const invoices = ((user as any)?.metadata?.invoices || []) as Invoice[];
    return invoices.find(inv => inv.id === invoiceId) || null;
  }

  async getInvoicesByUser(
    userId: string,
    filters?: {
      status?: Invoice['status'];
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<Invoice[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });

    let invoices = ((user as any)?.metadata?.invoices || []) as Invoice[];

    if (filters?.status) {
      invoices = invoices.filter(inv => inv.status === filters.status);
    }
    if (filters?.startDate) {
      invoices = invoices.filter(inv => new Date(inv.invoiceDate) >= filters.startDate!);
    }
    if (filters?.endDate) {
      invoices = invoices.filter(inv => new Date(inv.invoiceDate) <= filters.endDate!);
    }

    return invoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getInvoiceStats(userId: string): Promise<{
    totalRevenue: number;
    outstanding: number;
    overdue: number;
    paidThisMonth: number;
    invoiceCount: number;
    averageInvoice: number;
  }> {
    const invoices = await this.getInvoicesByUser(userId);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const outstandingInvoices = invoices.filter(inv => ['sent', 'viewed'].includes(inv.status));
    const overdueInvoices = invoices.filter(inv => 
      ['sent', 'viewed'].includes(inv.status) && new Date(inv.dueDate) < now
    );
    const paidThisMonthInvoices = paidInvoices.filter(inv => 
      inv.paidDate && new Date(inv.paidDate) >= startOfMonth
    );

    return {
      totalRevenue: paidInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      outstanding: outstandingInvoices.reduce((sum, inv) => sum + inv.amountDue, 0),
      overdue: overdueInvoices.reduce((sum, inv) => sum + inv.amountDue, 0),
      paidThisMonth: paidThisMonthInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      invoiceCount: invoices.length,
      averageInvoice: invoices.length > 0 
        ? invoices.reduce((sum, inv) => sum + inv.totalAmount, 0) / invoices.length 
        : 0,
    };
  }

  // Recurring Invoices
  async createRecurringInvoice(
    userId: string,
    config: Omit<RecurringInvoiceConfig, 'id' | 'nextInvoiceDate' | 'invoiceCount' | 'lastGeneratedAt'>,
  ): Promise<RecurringInvoiceConfig> {
    const recurringConfig: RecurringInvoiceConfig = {
      ...config,
      id: uuidv4(),
      nextInvoiceDate: config.startDate,
      invoiceCount: 0,
    };

    await this.storeRecurringConfig(userId, recurringConfig);
    return recurringConfig;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processRecurringInvoices(): Promise<void> {
    this.logger.log('Processing recurring invoices');

    // In production, this would query the database for all active recurring configs
    // For now, this is a placeholder for the cron job
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendOverdueReminders(): Promise<void> {
    this.logger.log('Checking for overdue invoices');

    // In production, query all overdue invoices and send reminders
  }

  private generateInvoiceNumber(): string {
    const year = new Date().getFullYear();
    this.invoiceCounter++;
    return `INV-${year}-${this.invoiceCounter.toString().padStart(5, '0')}`;
  }

  private async storeInvoice(userId: string, invoice: Invoice): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });

    const invoices = ((user as any)?.metadata?.invoices || []) as Invoice[];
    const existingIndex = invoices.findIndex(inv => inv.id === invoice.id);

    if (existingIndex >= 0) {
      invoices[existingIndex] = invoice;
    } else {
      invoices.push(invoice);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        metadata: {
          ...(user as any)?.metadata,
          invoices,
        },
      },
    });
  }

  private async storeRecurringConfig(userId: string, config: RecurringInvoiceConfig): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });

    const configs = ((user as any)?.metadata?.recurringInvoices || []) as RecurringInvoiceConfig[];
    configs.push(config);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        metadata: {
          ...(user as any)?.metadata,
          recurringInvoices: configs,
        },
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

  async refundInvoice(
    userId: string,
    invoiceId: string,
    refundAmount?: number,
  ): Promise<Invoice> {
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
