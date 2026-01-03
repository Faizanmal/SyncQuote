import { IsString, IsUUID, IsOptional, IsArray, IsEnum, IsNumber, IsBoolean, IsDateString, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  VIEWED = 'viewed',
  PAID = 'paid',
  PARTIALLY_PAID = 'partially_paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentTerms {
  DUE_ON_RECEIPT = 'due_on_receipt',
  NET_7 = 'net_7',
  NET_15 = 'net_15',
  NET_30 = 'net_30',
  NET_45 = 'net_45',
  NET_60 = 'net_60',
  NET_90 = 'net_90',
  CUSTOM = 'custom',
}

export enum RecurringFrequency {
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEMIANNUAL = 'semiannual',
  ANNUAL = 'annual',
}

export class InvoiceLineItemDto {
  @ApiProperty({ description: 'Item description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Quantity' })
  @IsNumber()
  quantity: number;

  @ApiProperty({ description: 'Unit price' })
  @IsNumber()
  unitPrice: number;

  @ApiPropertyOptional({ description: 'Discount percentage' })
  @IsOptional()
  @IsNumber()
  discountPercent?: number;

  @ApiPropertyOptional({ description: 'Tax rate percentage' })
  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @ApiPropertyOptional({ description: 'Product or service code' })
  @IsOptional()
  @IsString()
  code?: string;
}

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Proposal ID to generate invoice from' })
  @IsUUID()
  proposalId: string;

  @ApiPropertyOptional({ description: 'Custom invoice number' })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional({ description: 'Invoice issue date' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiProperty({ description: 'Payment terms', enum: PaymentTerms })
  @IsEnum(PaymentTerms)
  paymentTerms: PaymentTerms;

  @ApiPropertyOptional({ description: 'Custom due date (for custom payment terms)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Custom line items (overrides proposal items)' })
  @IsOptional()
  @IsArray()
  @Type(() => InvoiceLineItemDto)
  lineItems?: InvoiceLineItemDto[];

  @ApiPropertyOptional({ description: 'Invoice notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Invoice footer text' })
  @IsOptional()
  @IsString()
  footer?: string;

  @ApiPropertyOptional({ description: 'Currency code (ISO 4217)' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Late fee percentage' })
  @IsOptional()
  @IsNumber()
  lateFeePercent?: number;

  @ApiPropertyOptional({ description: 'Deposit amount or percentage required' })
  @IsOptional()
  @IsNumber()
  depositAmount?: number;

  @ApiPropertyOptional({ description: 'Is deposit a percentage' })
  @IsOptional()
  @IsBoolean()
  depositIsPercent?: boolean;
}

export class UpdateInvoiceDto {
  @ApiPropertyOptional({ description: 'Invoice status', enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ description: 'Payment terms', enum: PaymentTerms })
  @IsOptional()
  @IsEnum(PaymentTerms)
  paymentTerms?: PaymentTerms;

  @ApiPropertyOptional({ description: 'Custom due date' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Line items' })
  @IsOptional()
  @IsArray()
  @Type(() => InvoiceLineItemDto)
  lineItems?: InvoiceLineItemDto[];

  @ApiPropertyOptional({ description: 'Invoice notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Invoice footer text' })
  @IsOptional()
  @IsString()
  footer?: string;
}

export class CreateRecurringInvoiceDto {
  @ApiProperty({ description: 'Base proposal ID' })
  @IsUUID()
  proposalId: string;

  @ApiProperty({ description: 'Recurring frequency', enum: RecurringFrequency })
  @IsEnum(RecurringFrequency)
  frequency: RecurringFrequency;

  @ApiProperty({ description: 'Start date for recurring invoices' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: 'End date for recurring invoices (optional)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Number of occurrences (alternative to end date)' })
  @IsOptional()
  @IsNumber()
  occurrences?: number;

  @ApiProperty({ description: 'Payment terms', enum: PaymentTerms })
  @IsEnum(PaymentTerms)
  paymentTerms: PaymentTerms;

  @ApiPropertyOptional({ description: 'Auto-send invoices when generated' })
  @IsOptional()
  @IsBoolean()
  autoSend?: boolean;

  @ApiPropertyOptional({ description: 'Template for invoice (line items, notes, etc.)' })
  @IsOptional()
  @IsObject()
  invoiceTemplate?: Partial<CreateInvoiceDto>;
}

export class RecordPaymentDto {
  @ApiProperty({ description: 'Invoice ID' })
  @IsUUID()
  invoiceId: string;

  @ApiProperty({ description: 'Payment amount' })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Payment method', examples: ['credit_card', 'bank_transfer', 'check', 'cash', 'other'] })
  @IsString()
  paymentMethod: string;

  @ApiPropertyOptional({ description: 'Payment reference/transaction ID' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Payment date' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ description: 'Payment notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SendInvoiceDto {
  @ApiProperty({ description: 'Invoice ID' })
  @IsUUID()
  invoiceId: string;

  @ApiPropertyOptional({ description: 'Recipient emails (defaults to client email)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientEmails?: string[];

  @ApiPropertyOptional({ description: 'Custom email subject' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Custom email message' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Include PDF attachment' })
  @IsOptional()
  @IsBoolean()
  includePdf?: boolean;

  @ApiPropertyOptional({ description: 'CC emails' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ccEmails?: string[];
}

export class InvoiceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  invoiceNumber: string;

  @ApiProperty()
  proposalId: string;

  @ApiProperty({ enum: InvoiceStatus })
  status: InvoiceStatus;

  @ApiProperty()
  issueDate: string;

  @ApiProperty()
  dueDate: string;

  @ApiProperty({ enum: PaymentTerms })
  paymentTerms: PaymentTerms;

  @ApiProperty({ type: [InvoiceLineItemDto] })
  lineItems: InvoiceLineItemDto[];

  @ApiProperty()
  subtotal: number;

  @ApiProperty()
  tax: number;

  @ApiProperty()
  discount: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  amountPaid: number;

  @ApiProperty()
  amountDue: number;

  @ApiProperty()
  currency: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiPropertyOptional()
  footer?: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiPropertyOptional()
  sentAt?: string;

  @ApiPropertyOptional()
  paidAt?: string;
}

export class RecurringInvoiceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  proposalId: string;

  @ApiProperty({ enum: RecurringFrequency })
  frequency: RecurringFrequency;

  @ApiProperty()
  startDate: string;

  @ApiPropertyOptional()
  endDate?: string;

  @ApiPropertyOptional()
  occurrences?: number;

  @ApiProperty()
  invoicesGenerated: number;

  @ApiProperty()
  nextInvoiceDate: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  autoSend: boolean;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class PaymentRecordResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  invoiceId: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  paymentMethod: string;

  @ApiPropertyOptional()
  reference?: string;

  @ApiProperty()
  paymentDate: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty()
  createdAt: string;
}
