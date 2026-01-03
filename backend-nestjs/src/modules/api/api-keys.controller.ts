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
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  /**
   * Create a new API key
   */
  @Post()
  async createApiKey(@Request() req: any, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.createApiKey(req.user.id, dto);
  }

  /**
   * List all API keys
   */
  @Get()
  async listApiKeys(@Request() req: any) {
    return this.apiKeysService.listApiKeys(req.user.id);
  }

  /**
   * Get API key details
   */
  @Get(':id')
  async getApiKey(@Request() req: any, @Param('id') id: string) {
    return this.apiKeysService.getApiKey(req.user.id, id);
  }

  /**
   * Update API key
   */
  @Put(':id')
  async updateApiKey(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateApiKeyDto) {
    return this.apiKeysService.updateApiKey(req.user.id, id, dto);
  }

  /**
   * Revoke API key
   */
  @Delete(':id')
  async revokeApiKey(@Request() req: any, @Param('id') id: string) {
    return this.apiKeysService.revokeApiKey(req.user.id, id);
  }

  /**
   * Get usage analytics for API key
   */
  @Get(':id/analytics')
  async getUsageAnalytics(
    @Request() req: any,
    @Param('id') id: string,
    @Query('days') days?: number,
  ) {
    return this.apiKeysService.getUsageAnalytics(req.user.id, id, days || 30);
  }
}
