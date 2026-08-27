import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvoiceService } from './services/invoice.service';

@ApiTags('Invoices')
@Controller('invoices/public')
export class InvoicePublicController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get(':invoiceId')
  @ApiOperation({ summary: 'View invoice without signing in' })
  getInvoice(@Param('invoiceId') invoiceId: string) {
    return this.invoiceService.getPublicInvoice(invoiceId);
  }

  @Post(':invoiceId/checkout')
  @ApiOperation({ summary: 'Start Stripe Checkout to pay an invoice' })
  createCheckout(
    @Param('invoiceId') invoiceId: string,
    @Body() body: { successUrl: string; cancelUrl: string },
  ) {
    return this.invoiceService.createPublicCheckout(invoiceId, body.successUrl, body.cancelUrl);
  }
}
