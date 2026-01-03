import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatisticalAnalysisService } from './statistical-analysis.service';
import {
  CreateAbTestDto,
  UpdateAbTestDto,
  RecordConversionDto,
  TestStatus,
  TestType,
  WinnerMetric,
  AbTestResultsDto,
  UpdateVariantTrafficDto,
} from './dto/ab-testing.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AbTestingService {
  private readonly logger = new Logger(AbTestingService.name);

  constructor(
    private prisma: PrismaService,
    private statsService: StatisticalAnalysisService,
  ) {}

  // Create a new A/B test
  async createTest(userId: string, dto: CreateAbTestDto) {
    // Validate traffic allocation sums to 100
    const totalAllocation = dto.variants.reduce((sum, v) => sum + v.trafficAllocation, 0);
    if (Math.abs(totalAllocation - 100) > 0.01) {
      throw new BadRequestException('Traffic allocation must sum to 100%');
    }

    // Ensure at least one control
    const hasControl = dto.variants.some((v) => v.isControl);
    if (!hasControl) {
      dto.variants[0].isControl = true;
    }

    // Create test
    const test = await this.prisma.aBTest.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        primaryMetric: dto.primaryMetric,
        secondaryMetrics: dto.secondaryMetrics || [],
        status: TestStatus.DRAFT,
        confidenceLevel: dto.confidenceLevel || 0.95,
        minSampleSize: dto.minSampleSize || 100,
        autoSelectWinner: dto.autoSelectWinner ?? true,
        targetTemplateId: dto.targetTemplateId,
        startDate: dto.startDate,
        endDate: dto.endDate,
      },
    });

    // Create variants
    for (const variantDto of dto.variants) {
      await this.prisma.aBTestVariant.create({
        data: {
          testId: test.id,
          name: variantDto.name,
          description: variantDto.description,
          trafficAllocation: variantDto.trafficAllocation,
          content: variantDto.content,
          isControl: variantDto.isControl || false,
        },
      });
    }

    return this.getTest(userId, test.id);
  }

  // Get test by ID
  async getTest(userId: string, testId: string) {
    const test = await this.prisma.aBTest.findFirst({
      where: { id: testId, userId },
      include: {
        variants: true,
      },
    });

    if (!test) {
      throw new NotFoundException('A/B test not found');
    }

    return test;
  }

  // Get all tests for user
  async getTests(userId: string, status?: TestStatus) {
    return this.prisma.aBTest.findMany({
      where: {
        userId,
        ...(status && { status }),
      },
      include: {
        variants: {
          select: {
            id: true,
            name: true,
            isControl: true,
            trafficAllocation: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Update test
  async updateTest(userId: string, testId: string, dto: UpdateAbTestDto) {
    const test = await this.getTest(userId, testId);

    if (test.status === TestStatus.COMPLETED || test.status === TestStatus.ARCHIVED) {
      throw new BadRequestException('Cannot modify completed or archived tests');
    }

    return this.prisma.aBTest.update({
      where: { id: testId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status && { status: dto.status }),
        ...(dto.minSampleSize && { minSampleSize: dto.minSampleSize }),
        ...(dto.autoSelectWinner !== undefined && { autoSelectWinner: dto.autoSelectWinner }),
        ...(dto.endDate && { endDate: dto.endDate }),
        ...(dto.status === TestStatus.RUNNING && { startDate: test.startDate || new Date() }),
      },
      include: { variants: true },
    });
  }

  // Start test
  async startTest(userId: string, testId: string) {
    const test = await this.getTest(userId, testId);

    if (test.status !== TestStatus.DRAFT && test.status !== TestStatus.PAUSED) {
      throw new BadRequestException('Test can only be started from draft or paused state');
    }

    return this.prisma.aBTest.update({
      where: { id: testId },
      data: {
        status: TestStatus.RUNNING,
        startDate: test.startDate || new Date(),
      },
      include: { variants: true },
    });
  }

  // Pause test
  async pauseTest(userId: string, testId: string) {
    const test = await this.getTest(userId, testId);

    if (test.status !== TestStatus.RUNNING) {
      throw new BadRequestException('Only running tests can be paused');
    }

    return this.prisma.aBTest.update({
      where: { id: testId },
      data: { status: TestStatus.PAUSED },
      include: { variants: true },
    });
  }

  // Complete test and select winner
  async completeTest(userId: string, testId: string, winnerId?: string) {
    const test = await this.getTest(userId, testId);

    if (test.status !== TestStatus.RUNNING && test.status !== TestStatus.PAUSED) {
      throw new BadRequestException('Test must be running or paused to complete');
    }

    // If winner not specified, calculate based on results
    let finalWinnerId = winnerId;
    if (!finalWinnerId) {
      const results = await this.getTestResults(userId, testId);
      if (results.hasWinner) {
        finalWinnerId = results.winnerId;
      }
    }

    return this.prisma.aBTest.update({
      where: { id: testId },
      data: {
        status: TestStatus.COMPLETED,
        endDate: new Date(),
        winnerId: finalWinnerId,
      },
      include: { variants: true },
    });
  }

  // Delete test
  async deleteTest(userId: string, testId: string) {
    await this.getTest(userId, testId);
    await this.prisma.aBTest.delete({ where: { id: testId } });
    return { success: true };
  }

  // Update variant traffic allocation
  async updateTrafficAllocation(userId: string, testId: string, dto: UpdateVariantTrafficDto) {
    const test = await this.getTest(userId, testId);

    if (test.status === TestStatus.COMPLETED || test.status === TestStatus.ARCHIVED) {
      throw new BadRequestException('Cannot modify completed or archived tests');
    }

    // Validate sum to 100
    const totalAllocation = dto.allocations.reduce((sum, a) => sum + a.trafficAllocation, 0);
    if (Math.abs(totalAllocation - 100) > 0.01) {
      throw new BadRequestException('Traffic allocation must sum to 100%');
    }

    for (const allocation of dto.allocations) {
      await this.prisma.aBTestVariant.update({
        where: { id: allocation.variantId },
        data: { trafficAllocation: allocation.trafficAllocation },
      });
    }

    return this.getTest(userId, testId);
  }

  // Assign visitor to variant
  async assignVariant(
    testId: string,
    sessionId: string,
  ): Promise<{ variantId: string; content: any }> {
    const test = await this.prisma.aBTest.findUnique({
      where: { id: testId },
      include: { variants: true },
    });

    if (!test || test.status !== TestStatus.RUNNING) {
      throw new BadRequestException('Test not available');
    }

    // Check if already assigned
    const existing = await this.prisma.aBTestAssignment.findUnique({
      where: { testId_sessionId: { testId, sessionId } },
      include: { variant: true },
    });

    if (existing) {
      return { variantId: existing.variantId, content: existing.variant.content };
    }

    // Assign based on traffic allocation
    const random = Math.random() * 100;
    let cumulative = 0;
    let assignedVariant = test.variants[0];

    for (const variant of test.variants) {
      cumulative += variant.trafficAllocation;
      if (random <= cumulative) {
        assignedVariant = variant;
        break;
      }
    }

    // Record assignment
    await this.prisma.aBTestAssignment.create({
      data: {
        testId,
        variantId: assignedVariant.id,
        sessionId,
      },
    });

    // Update impressions
    await this.prisma.aBTestVariant.update({
      where: { id: assignedVariant.id },
      data: { impressions: { increment: 1 } },
    });

    return { variantId: assignedVariant.id, content: assignedVariant.content };
  }

  // Record conversion
  async recordConversion(dto: RecordConversionDto) {
    const test = await this.prisma.aBTest.findUnique({
      where: { id: dto.testId },
    });

    if (!test) {
      throw new NotFoundException('Test not found');
    }

    // Verify assignment exists
    const assignment = await this.prisma.aBTestAssignment.findFirst({
      where: {
        testId: dto.testId,
        variantId: dto.variantId,
        sessionId: dto.sessionId,
      },
    });

    if (!assignment) {
      // Auto-create assignment if doesn't exist
      await this.prisma.aBTestAssignment.create({
        data: {
          testId: dto.testId,
          variantId: dto.variantId,
          sessionId: dto.sessionId,
        },
      });
    }

    // Record conversion event
    await this.prisma.aBTestConversion.create({
      data: {
        testId: dto.testId,
        variantId: dto.variantId,
        sessionId: dto.sessionId,
        event: dto.event,
        value: dto.value,
        metadata: dto.metadata || {},
      },
    });

    // Update variant stats based on event
    const updateData: any = {};

    switch (dto.event) {
      case 'approval':
      case 'sign':
      case 'conversion':
        updateData.conversions = { increment: 1 };
        if (dto.value) {
          updateData.totalValue = { increment: dto.value };
        }
        break;
      case 'click':
        updateData.clicks = { increment: 1 };
        break;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.aBTestVariant.update({
        where: { id: dto.variantId },
        data: updateData,
      });
    }

    // Check if we should auto-select winner
    if (test.autoSelectWinner && test.status === TestStatus.RUNNING) {
      await this.checkForWinner(test.id);
    }

    return { success: true };
  }

  // Get test results with statistical analysis
  async getTestResults(userId: string, testId: string): Promise<AbTestResultsDto> {
    const test = await this.prisma.aBTest.findFirst({
      where: { id: testId, userId },
      include: {
        variants: true,
        conversions: true,
      },
    });

    if (!test) {
      throw new NotFoundException('Test not found');
    }

    const controlVariant = test.variants.find((v) => v.isControl);
    const variantResults = test.variants.map((variant) => {
      const conversionRate =
        variant.impressions > 0 ? variant.conversions / variant.impressions : 0;

      const result: any = {
        variantId: variant.id,
        variantName: variant.name,
        isControl: variant.isControl,
        impressions: variant.impressions,
        conversions: variant.conversions,
        conversionRate,
        avgValue: variant.conversions > 0 ? (variant.totalValue || 0) / variant.conversions : 0,
        totalValue: variant.totalValue || 0,
        standardError: this.statsService.calculateStandardError(
          conversionRate,
          variant.impressions,
        ),
        confidenceInterval: this.statsService.calculateConfidenceInterval(
          conversionRate,
          variant.impressions,
          test.confidenceLevel,
        ),
      };

      // Compare to control
      if (!variant.isControl && controlVariant) {
        const controlRate =
          controlVariant.impressions > 0
            ? controlVariant.conversions / controlVariant.impressions
            : 0;

        if (controlRate > 0) {
          result.relativeImprovement = ((conversionRate - controlRate) / controlRate) * 100;
        }

        result.pValue = this.statsService.calculatePValue(
          variant.conversions,
          variant.impressions,
          controlVariant.conversions,
          controlVariant.impressions,
        );
        result.isSignificant = result.pValue < 1 - test.confidenceLevel;
      }

      return result;
    });

    // Determine winner
    const { hasWinner, winnerId, winnerName } = this.determineWinner(
      variantResults,
      test.minSampleSize,
      test.confidenceLevel,
    );

    // Calculate statistical power
    const totalImpressions = test.variants.reduce((sum, v) => sum + v.impressions, 0);
    const totalConversions = test.variants.reduce((sum, v) => sum + v.conversions, 0);
    const statisticalPower = this.statsService.calculateStatisticalPower(
      variantResults,
      test.minSampleSize,
    );

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      variantResults,
      hasWinner,
      statisticalPower,
      totalConversions,
      test.minSampleSize,
    );

    // Estimate days to significance
    const daysToSignificance = !hasWinner
      ? this.estimateDaysToSignificance(test, totalConversions)
      : undefined;

    return {
      testId: test.id,
      testName: test.name,
      status: test.status as TestStatus,
      primaryMetric: test.primaryMetric as WinnerMetric,
      confidenceLevel: test.confidenceLevel,
      minSampleSize: test.minSampleSize,
      totalImpressions,
      totalConversions,
      variants: variantResults,
      hasWinner,
      winnerId,
      winnerName,
      statisticalPower,
      isStatisticallySignificant: hasWinner,
      recommendation,
      daysToSignificance,
    };
  }

  // Private helper methods
  private async checkForWinner(testId: string): Promise<void> {
    const test = await this.prisma.aBTest.findUnique({
      where: { id: testId },
      include: { variants: true },
    });

    if (!test) return;

    const results = await this.getTestResults(test.userId, testId);

    if (results.hasWinner && results.winnerId) {
      await this.prisma.aBTest.update({
        where: { id: testId },
        data: {
          status: TestStatus.COMPLETED,
          winnerId: results.winnerId,
          endDate: new Date(),
        },
      });

      this.logger.log(`A/B test ${testId} completed with winner: ${results.winnerName}`);
    }
  }

  private determineWinner(
    variants: any[],
    minSampleSize: number,
    confidenceLevel: number,
  ): { hasWinner: boolean; winnerId?: string; winnerName?: string } {
    const control = variants.find((v) => v.isControl);
    if (!control) return { hasWinner: false };

    // Need minimum sample size
    if (control.conversions < minSampleSize) {
      return { hasWinner: false };
    }

    // Find best performing variant with significance
    const significantWinners = variants
      .filter(
        (v: any) => !v.isControl && v.isSignificant && v.conversionRate > control.conversionRate,
      )
      .sort((a, b) => b.conversionRate - a.conversionRate);

    if (significantWinners.length > 0) {
      return {
        hasWinner: true,
        winnerId: significantWinners[0].variantId,
        winnerName: significantWinners[0].variantName,
      };
    }

    // Check if control is significantly better than all variants
    const allVariantsWorse = variants
      .filter((v: any) => !v.isControl)
      .every((v: any) => v.isSignificant && v.conversionRate < control.conversionRate);

    if (allVariantsWorse && control.conversions >= minSampleSize) {
      return {
        hasWinner: true,
        winnerId: control.variantId,
        winnerName: control.variantName,
      };
    }

    return { hasWinner: false };
  }

  private generateRecommendation(
    variants: any[],
    hasWinner: boolean,
    statisticalPower: number,
    totalConversions: number,
    minSampleSize: number,
  ): string {
    if (hasWinner) {
      const winner = variants.find((v) => v.isSignificant && !v.isControl);
      if (winner) {
        return `Winner found: "${winner.variantName}" shows a ${winner.relativeImprovement.toFixed(1)}% improvement over the control with ${(100 - winner.pValue * 100).toFixed(0)}% confidence. Consider implementing this variant.`;
      }
      return 'The control version performs best. No changes recommended.';
    }

    if (totalConversions < minSampleSize * 0.5) {
      return `Insufficient data. Need at least ${minSampleSize} conversions per variant for statistical significance. Continue running the test.`;
    }

    if (statisticalPower < 0.5) {
      return 'Low statistical power. Consider increasing traffic or running longer to detect meaningful differences.';
    }

    return 'No significant winner yet. Continue running the test to gather more data.';
  }

  private estimateDaysToSignificance(test: any, currentConversions: number): number | undefined {
    if (!test.startDate) return undefined;

    const daysRunning = Math.max(
      1,
      Math.ceil((Date.now() - new Date(test.startDate).getTime()) / (1000 * 60 * 60 * 24)),
    );

    const conversionsPerDay = currentConversions / daysRunning;
    if (conversionsPerDay === 0) return undefined;

    const needed = test.minSampleSize * test.variants.length - currentConversions;
    if (needed <= 0) return 0;

    return Math.ceil(needed / conversionsPerDay);
  }
}
