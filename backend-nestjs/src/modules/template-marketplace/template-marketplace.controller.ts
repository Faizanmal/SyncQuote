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
import { TemplateMarketplaceService } from './template-marketplace.service';
import {
  PublishTemplateDto,
  UpdateMarketplaceTemplateDto,
  SearchMarketplaceDto,
  CreateReviewDto,
  UpdateReviewDto,
  PurchaseTemplateDto,
  ReportTemplateDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('marketplace')
export class TemplateMarketplaceController {
  constructor(private readonly marketplaceService: TemplateMarketplaceService) {}

  private userId(req: any) {
    return req.user?.id || req.user?.sub || req.user?.userId;
  }

  // ==================== PUBLIC ENDPOINTS ====================

  /**
   * Search marketplace templates (public)
   */
  @Get('templates')
  async searchTemplates(@Query() dto: SearchMarketplaceDto) {
    return this.marketplaceService.searchTemplates(dto);
  }

  /**
   * Get single template (public)
   */
  @Get('templates/:id')
  async getTemplate(@Param('id') id: string, @Request() req: any) {
    return this.marketplaceService.getTemplate(id, this.userId(req));
  }

  /**
   * Get featured templates (public)
   */
  @Get('featured')
  async getFeaturedTemplates(@Query('limit') limit?: number) {
    return this.marketplaceService.getFeaturedTemplates(limit || 10);
  }

  /**
   * Get popular templates by category (public)
   */
  @Get('categories/:category/popular')
  async getPopularByCategory(@Param('category') category: string, @Query('limit') limit?: number) {
    return this.marketplaceService.getPopularByCategory(category, limit || 10);
  }

  // ==================== AUTHENTICATED ENDPOINTS ====================

  /**
   * Publish template to marketplace
   */
  @Post('publish')
  @UseGuards(JwtAuthGuard)
  async publishTemplate(@Request() req: any, @Body() dto: PublishTemplateDto) {
    return this.marketplaceService.publishTemplate(this.userId(req), dto);
  }

  /**
   * Update marketplace listing
   */
  @Put('listings/:id')
  @UseGuards(JwtAuthGuard)
  async updateListing(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateMarketplaceTemplateDto,
  ) {
    return this.marketplaceService.updateListing(this.userId(req), id, dto);
  }

  /**
   * Purchase/download template
   */
  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  async purchaseTemplate(@Request() req: any, @Body() dto: PurchaseTemplateDto) {
    return this.marketplaceService.purchaseTemplate(this.userId(req), dto);
  }

  /**
   * Create review
   */
  @Post('reviews')
  @UseGuards(JwtAuthGuard)
  async createReview(@Request() req: any, @Body() dto: CreateReviewDto) {
    return this.marketplaceService.createReview(this.userId(req), dto);
  }

  /**
   * Update review
   */
  @Put('reviews/:id')
  @UseGuards(JwtAuthGuard)
  async updateReview(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.marketplaceService.updateReview(this.userId(req), id, dto);
  }

  /**
   * Delete review
   */
  @Delete('reviews/:id')
  @UseGuards(JwtAuthGuard)
  async deleteReview(@Request() req: any, @Param('id') id: string) {
    return this.marketplaceService.deleteReview(this.userId(req), id);
  }

  /**
   * Report template
   */
  @Post('report')
  @UseGuards(JwtAuthGuard)
  async reportTemplate(@Request() req: any, @Body() dto: ReportTemplateDto) {
    return this.marketplaceService.reportTemplate(this.userId(req), dto);
  }

  // ==================== SELLER ENDPOINTS ====================

  /**
   * Get seller's templates
   */
  @Get('seller/templates')
  @UseGuards(JwtAuthGuard)
  async getSellerTemplates(@Request() req: any) {
    return this.marketplaceService.getSellerTemplates(this.userId(req));
  }

  /**
   * Get seller statistics
   */
  @Get('seller/stats')
  @UseGuards(JwtAuthGuard)
  async getSellerStats(@Request() req: any) {
    return this.marketplaceService.getSellerStats(this.userId(req));
  }

  // ==================== BUYER ENDPOINTS ====================

  /**
   * Get user's purchases
   */
  @Get('purchases')
  @UseGuards(JwtAuthGuard)
  async getUserPurchases(@Request() req: any) {
    return this.marketplaceService.getUserPurchases(this.userId(req));
  }
}
