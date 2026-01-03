import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * Create a new webhook
   */
  @Post()
  async createWebhook(@Request() req: any, @Body() dto: CreateWebhookDto) {
    return this.webhooksService.createWebhook(req.user.id, dto);
  }

  /**
   * List all webhooks
   */
  @Get()
  async listWebhooks(@Request() req: any) {
    return this.webhooksService.listWebhooks(req.user.id);
  }

  /**
   * Get webhook details
   */
  @Get(':id')
  async getWebhook(@Request() req: any, @Param('id') id: string) {
    return this.webhooksService.getWebhook(req.user.id, id);
  }

  /**
   * Update webhook
   */
  @Put(':id')
  async updateWebhook(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooksService.updateWebhook(req.user.id, id, dto);
  }

  /**
   * Delete webhook
   */
  @Delete(':id')
  async deleteWebhook(@Request() req: any, @Param('id') id: string) {
    return this.webhooksService.deleteWebhook(req.user.id, id);
  }

  /**
   * Regenerate webhook secret
   */
  @Post(':id/regenerate-secret')
  async regenerateSecret(@Request() req: any, @Param('id') id: string) {
    return this.webhooksService.regenerateSecret(req.user.id, id);
  }

  /**
   * Test webhook endpoint
   */
  @Post(':id/test')
  async testWebhook(@Request() req: any, @Param('id') id: string) {
    return this.webhooksService.testWebhook(req.user.id, id);
  }

  /**
   * Get webhook delivery history
   */
  @Get(':id/deliveries')
  async getDeliveryHistory(
    @Request() req: any,
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ) {
    return this.webhooksService.getDeliveryHistory(req.user.id, id, limit || 50);
  }
}
