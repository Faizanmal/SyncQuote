import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillingService } from './billing.service';
import { CreateCheckoutSessionDto, CreatePortalSessionDto } from './dto/billing.dto';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('subscription')
  @ApiOperation({ summary: 'Get current SaaS subscription' })
  getSubscription(@Req() req: any) {
    return this.billingService.getSubscription(req.user.sub || req.user.id);
  }

  @Get('payment-method')
  @ApiOperation({ summary: 'Get default payment method' })
  getPaymentMethod(@Req() req: any) {
    return this.billingService.getPaymentMethod(req.user.sub || req.user.id);
  }

  @Post('create-checkout-session')
  @ApiOperation({ summary: 'Create Stripe Checkout session for a plan' })
  createCheckoutSession(@Req() req: any, @Body() dto: CreateCheckoutSessionDto) {
    return this.billingService.createCheckoutSession(req.user.sub || req.user.id, dto);
  }

  @Post('create-portal-session')
  @ApiOperation({ summary: 'Create Stripe Customer Portal session' })
  createPortalSession(@Req() req: any, @Body() dto: CreatePortalSessionDto) {
    return this.billingService.createPortalSession(req.user.sub || req.user.id, dto);
  }
}
