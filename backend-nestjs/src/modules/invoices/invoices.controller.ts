import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InvoiceService, CreateInvoiceDto } from './services/invoice.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

class ListInvoicesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === 'all' || value === '' ? undefined : value))
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;
}

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new invoice' })
  async createInvoice(@Req() req: any, @Body() dto: CreateInvoiceDto) {
    return this.invoiceService.createInvoice(req.user.id, {
      ...dto,
      dueDate: new Date(dto.dueDate),
    });
  }

  @Post('from-proposal/:proposalId')
  @ApiOperation({ summary: 'Create invoice from approved proposal' })
  async createFromProposal(
    @Req() req: any,
    @Param('proposalId') proposalId: string,
    @Body()
    body: {
      dueDate?: string;
      paymentTerms?: string;
      notes?: string;
    },
  ) {
    return this.invoiceService.createInvoiceFromProposal(req.user.id, proposalId, {
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      paymentTerms: body.paymentTerms,
      notes: body.notes,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List invoices (paginated)' })
  async getInvoices(@Req() req: any, @Query() query: ListInvoicesQueryDto) {
    const userId = req.user?.id || req.user?.sub;
    return this.invoiceService.getInvoicesByUser(userId, {
      status: query.status as any,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get invoice statistics' })
  async getStats(@Req() req: any) {
    return this.invoiceService.getInvoiceStats(req.user.id);
  }

  @Get(':invoiceId')
  @ApiOperation({ summary: 'Get invoice by ID' })
  async getInvoice(@Req() req: any, @Param('invoiceId') invoiceId: string) {
    return this.invoiceService.getInvoice(req.user.id, invoiceId);
  }

  @Post(':invoiceId/send')
  @ApiOperation({ summary: 'Send invoice to client' })
  async sendInvoice(@Req() req: any, @Param('invoiceId') invoiceId: string) {
    await this.invoiceService.sendInvoice(req.user.id, invoiceId);
    return { success: true };
  }

  @Post(':invoiceId/payment')
  @ApiOperation({ summary: 'Record payment for invoice' })
  async recordPayment(
    @Req() req: any,
    @Param('invoiceId') invoiceId: string,
    @Body()
    body: {
      amount: number;
      method: string;
      reference?: string;
      stripePaymentIntentId?: string;
    },
  ) {
    return this.invoiceService.recordPayment(req.user.id, invoiceId, body);
  }

  @Post(':invoiceId/cancel')
  @ApiOperation({ summary: 'Cancel invoice' })
  async cancelInvoice(@Req() req: any, @Param('invoiceId') invoiceId: string) {
    await this.invoiceService.cancelInvoice(req.user.id, invoiceId);
    return { success: true };
  }

  @Post(':invoiceId/refund')
  @ApiOperation({ summary: 'Refund invoice' })
  async refundInvoice(
    @Req() req: any,
    @Param('invoiceId') invoiceId: string,
    @Body() body: { amount?: number },
  ) {
    return this.invoiceService.refundInvoice(req.user.id, invoiceId, body.amount);
  }

  @Post('recurring')
  @ApiOperation({ summary: 'Create recurring invoice configuration' })
  async createRecurring(
    @Req() req: any,
    @Body()
    body: {
      templateInvoice: any;
      frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';
      startDate: string;
      endDate?: string;
      isActive: boolean;
    },
  ) {
    return this.invoiceService.createRecurringInvoice(req.user.id, {
      ...body,
      userId: req.user.id,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    });
  }
}
