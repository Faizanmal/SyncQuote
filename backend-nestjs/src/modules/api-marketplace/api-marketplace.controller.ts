import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiMarketplaceService } from './services/api-marketplace.service';

@ApiTags('API Marketplace')
@Controller('marketplace')
export class ApiMarketplaceController {
  constructor(private readonly marketplaceService: ApiMarketplaceService) {}

  // ==================== Public Endpoints ====================

  @Get('categories')
  @ApiOperation({ summary: 'Get all app categories' })
  async getCategories() {
    return this.marketplaceService.getCategories();
  }

  @Get('apps')
  @ApiOperation({ summary: 'List marketplace apps' })
  async listApps(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('featured') featured?: string,
    @Query('free') free?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.marketplaceService.listApps({
      category,
      search,
      featured: featured === 'true',
      free: free === 'true',
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('apps/featured')
  @ApiOperation({ summary: 'Get featured apps' })
  async getFeaturedApps() {
    return this.marketplaceService.getFeaturedApps();
  }

  @Get('apps/:appId')
  @ApiOperation({ summary: 'Get app details' })
  async getApp(@Param('appId') appId: string) {
    return this.marketplaceService.getApp(appId);
  }

  @Get('apps/:appId/reviews')
  @ApiOperation({ summary: 'Get app reviews' })
  async getAppReviews(@Param('appId') appId: string) {
    return this.marketplaceService.getAppReviews(appId);
  }

  // ==================== Authenticated Endpoints ====================

  @Get('permissions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get available API permissions' })
  async getPermissions() {
    return this.marketplaceService.getAvailablePermissions();
  }

  @Get('installations')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user app installations' })
  async getUserInstallations(@Req() req: any) {
    return this.marketplaceService.getUserInstallations(req.user.id);
  }

  @Post('apps/:appId/install')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Install an app' })
  async installApp(
    @Req() req: any,
    @Param('appId') appId: string,
    @Body() body: { config?: Record<string, any> },
  ) {
    return this.marketplaceService.installApp(req.user.id, appId, body.config);
  }

  @Delete('apps/:appId/uninstall')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Uninstall an app' })
  async uninstallApp(@Req() req: any, @Param('appId') appId: string) {
    await this.marketplaceService.uninstallApp(req.user.id, appId);
    return { success: true };
  }

  @Post('apps/:appId/config')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update app configuration' })
  async updateConfig(
    @Req() req: any,
    @Param('appId') appId: string,
    @Body() body: Record<string, any>,
  ) {
    return this.marketplaceService.updateInstallationConfig(req.user.id, appId, body);
  }

  @Post('apps/:appId/reviews')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add app review' })
  async addReview(
    @Req() req: any,
    @Param('appId') appId: string,
    @Body() body: { rating: number; title: string; content: string },
  ) {
    return this.marketplaceService.addReview(req.user.id, appId, body);
  }

  @Post('apps/:appId/api-key')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Generate API key for app' })
  async generateApiKey(
    @Req() req: any,
    @Param('appId') appId: string,
    @Body() body: { permissions: string[] },
  ) {
    return this.marketplaceService.generateAppApiKey(req.user.id, appId, body.permissions);
  }

  // ==================== Developer Portal ====================

  @Post('developer/apps')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Register new app (developer)' })
  async registerApp(@Req() req: any, @Body() body: any) {
    return this.marketplaceService.registerApp(req.user.id, body);
  }

  @Post('developer/apps/:appId/submit')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Submit app for review' })
  async submitForReview(@Req() req: any, @Param('appId') appId: string) {
    await this.marketplaceService.submitForReview(req.user.id, appId);
    return { success: true };
  }
}
