import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AbTestingService } from './ab-testing.service';
import { TestStatus } from './dto/ab-testing.dto';

@Injectable()
export class AbTestingScheduler {
  private readonly logger = new Logger(AbTestingScheduler.name);

  constructor(
    private prisma: PrismaService,
    private abTestingService: AbTestingService,
  ) {}

  // Check for test completion every hour
  @Cron(CronExpression.EVERY_HOUR)
  async checkTestCompletion(): Promise<void> {
    this.logger.log('Checking A/B tests for completion...');

    const runningTests = await this.prisma.aBTest.findMany({
      where: {
        status: TestStatus.RUNNING,
        autoSelectWinner: true,
      },
      include: { variants: true },
    });

    for (const test of runningTests) {
      try {
        // Check if end date has passed
        if (test.endDate && new Date(test.endDate) < new Date()) {
          const results = await this.abTestingService.getTestResults(test.userId, test.id);

          await this.prisma.aBTest.update({
            where: { id: test.id },
            data: {
              status: TestStatus.COMPLETED,
              winnerId: results.winnerId || undefined,
            },
          });

          this.logger.log(`A/B test ${test.id} auto-completed (end date reached)`);
          continue;
        }

        // Check if we have a statistically significant winner
        const results = await this.abTestingService.getTestResults(test.userId, test.id);

        if (results.hasWinner && results.winnerId) {
          await this.prisma.aBTest.update({
            where: { id: test.id },
            data: {
              status: TestStatus.COMPLETED,
              winnerId: results.winnerId,
              endDate: new Date(),
            },
          });

          this.logger.log(`A/B test ${test.id} completed with winner: ${results.winnerName}`);
        }
      } catch (error) {
        this.logger.error(`Error checking test ${test.id}:`, error);
      }
    }
  }

  // Clean up old completed tests (archive after 90 days)
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async archiveOldTests(): Promise<void> {
    this.logger.log('Archiving old A/B tests...');

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const result = await this.prisma.aBTest.updateMany({
      where: {
        status: TestStatus.COMPLETED,
        endDate: { lt: ninetyDaysAgo },
      },
      data: {
        status: TestStatus.ARCHIVED,
      },
    });

    if (result.count > 0) {
      this.logger.log(`Archived ${result.count} old A/B tests`);
    }
  }

  // Generate daily summary of running tests
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async generateDailySummary(): Promise<void> {
    this.logger.log('Generating daily A/B test summary...');

    const runningTests = await this.prisma.aBTest.findMany({
      where: { status: TestStatus.RUNNING },
      include: {
        variants: true,
        user: { select: { email: true, name: true } },
      },
    });

    for (const test of runningTests) {
      try {
        const results = await this.abTestingService.getTestResults(test.userId, test.id);

        // Log summary
        this.logger.log(
          `Test "${test.name}": ${results.totalConversions} conversions, ${
            results.hasWinner ? `Winner: ${results.winnerName}` : 'No winner yet'
          }`,
        );

        // Could also send email notifications here
      } catch (error) {
        this.logger.error(`Error generating summary for test ${test.id}:`, error);
      }
    }
  }
}
