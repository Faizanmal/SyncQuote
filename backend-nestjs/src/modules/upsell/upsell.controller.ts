import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpsellService } from './upsell.service';
import { DynamicPricingService } from './dynamic-pricing.service';
import {
  GetRecommendationsDto,
  BundleRecommendationDto,
  PriceOptimizationDto,
  CrossSellOpportunityDto,
  CalculateDynamicPriceDto,
  ClientProfilingDto,
} from './dto/upsell.dto';

@ApiTags('Upsell Intelligence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('upsell')
export class UpsellController {
  constructor(
    private readonly upsellService: UpsellService,
    private readonly dynamicPricing: DynamicPricingService,
  ) {}

  @Post('recommendations')
  @ApiOperation({ summary: 'Get AI-powered upsell/cross-sell recommendations' })
  async getRecommendations(@Request() req: any, @Body() dto: GetRecommendationsDto) {
    return this.upsellService.getRecommendations(req.user.id, dto);
  }

  @Post('bundles')
  @ApiOperation({ summary: 'Get bundle recommendations' })
  async getBundleRecommendations(@Request() req: any, @Body() dto: BundleRecommendationDto) {
    return this.upsellService.getBundleRecommendations(
      req.user.id,
      dto.proposalId,
      dto.minItems || 2,
      dto.minDiscountPercentage || 10,
    );
  }

  @Post('optimize-pricing')
  @ApiOperation({ summary: 'Optimize proposal pricing using dynamic pricing engine' })
  async optimizePricing(@Request() req: any, @Body() dto: PriceOptimizationDto) {
    return this.upsellService.optimizeProposalPricing(
      req.user.id,
      dto.proposalId,
      dto.aggressiveDiscounting || false,
    );
  }

  @Post('cross-sell')
  @ApiOperation({ summary: 'Get cross-sell opportunities for client' })
  async getCrossSellOpportunities(@Request() req: any, @Body() dto: CrossSellOpportunityDto) {
    return this.upsellService.getCrossSellOpportunities(req.user.id, dto.clientId, dto.limit || 5);
  }

  @Post('dynamic-price')
  @ApiOperation({ summary: 'Calculate dynamic price for product/client' })
  async calculateDynamicPrice(@Request() req: any, @Body() dto: CalculateDynamicPriceDto) {
    return this.dynamicPricing.calculateDynamicPrice(
      dto.productId,
      dto.clientId,
      dto.basePrice || 1000,
      dto.strategy,
    );
  }

  @Post('optimize-price')
  @ApiOperation({ summary: 'Find optimal price point for maximum revenue' })
  async optimizePrice(
    @Request() req: any,
    @Body() dto: { productId: string; clientId: string; basePrice: number },
  ) {
    const optimizedPrice = await this.dynamicPricing.optimizePrice(
      dto.productId,
      dto.clientId,
      dto.basePrice,
    );

    return {
      productId: dto.productId,
      clientId: dto.clientId,
      basePrice: dto.basePrice,
      optimizedPrice: Math.round(optimizedPrice * 100) / 100,
      improvement: Math.round(((optimizedPrice - dto.basePrice) / dto.basePrice) * 10000) / 100,
    };
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get recommendation performance metrics' })
  async getPerformance(@Request() req: any, @Query('days') days?: string) {
    return this.upsellService.getRecommendationPerformance(req.user.id, days ? parseInt(days) : 30);
  }

  @Post('track-conversion')
  @ApiOperation({ summary: 'Track recommendation conversion' })
  async trackConversion(
    @Request() req: any,
    @Body() body: { recommendationId: string; accepted: boolean; revenue?: number },
  ) {
    await this.upsellService.trackRecommendationConversion(
      req.user.id,
      body.recommendationId,
      body.accepted,
      body.revenue,
    );

    return { success: true };
  }
}
