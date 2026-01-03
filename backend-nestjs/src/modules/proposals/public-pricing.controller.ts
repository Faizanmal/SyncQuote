import { Controller, Post, Get, Body, Param, Headers, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import { InteractivePricingService } from './interactive-pricing.service';
import {
    UpdatePricingSelectionsDto,
    PricingCalculationResultDto,
} from './dto/interactive-pricing.dto';

/**
 * Public controller for proposal pricing interactions
 * No authentication required - accessed by proposal recipients
 */
@ApiTags('Public Pricing')
@Controller('public/proposals')
export class PublicPricingController {
    constructor(private readonly interactivePricingService: InteractivePricingService) { }

    /**
     * Calculate pricing based on client selections
     * POST /public/proposals/:slug/pricing
     */
    @Post(':slug/pricing')
    @ApiOperation({ summary: 'Calculate pricing based on selections' })
    @ApiParam({ name: 'slug', description: 'Proposal public slug' })
    @ApiBody({ type: UpdatePricingSelectionsDto })
    @ApiResponse({ status: 200, type: PricingCalculationResultDto })
    async calculatePricing(
        @Param('slug') slug: string,
        @Body() dto: UpdatePricingSelectionsDto,
        @Ip() ipAddress: string,
        @Headers('user-agent') userAgent: string,
    ): Promise<PricingCalculationResultDto> {
        return this.interactivePricingService.calculatePricing(slug, dto);
    }

    /**
     * Get initial pricing breakdown for a proposal
     * GET /public/proposals/:slug/pricing
     */
    @Get(':slug/pricing')
    @ApiOperation({ summary: 'Get pricing breakdown for a proposal' })
    @ApiParam({ name: 'slug', description: 'Proposal public slug' })
    @ApiResponse({ status: 200, type: PricingCalculationResultDto })
    async getPricingBreakdown(
        @Param('slug') slug: string,
    ): Promise<PricingCalculationResultDto> {
        return this.interactivePricingService.getPricingBreakdown(slug);
    }
}
