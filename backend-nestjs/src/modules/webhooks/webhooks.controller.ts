import { Controller, Post, Headers, Body, RawBodyRequest, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) { }

  @Post('stripe')
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!signature) {
      throw new Error('Missing stripe-signature header');
    }

    // Verify webhook signature for security
    // Note: This requires the raw body, which is configured in main.ts
    const event = await this.webhooksService.verifyAndParseWebhook(
      req.rawBody as Buffer,
      signature,
    );

    await this.webhooksService.handleStripeWebhook(event);

    return { received: true };
  }
}
