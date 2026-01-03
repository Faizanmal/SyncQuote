import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AutomationService, AutomationTrigger } from './automation.service';

@Injectable()
export class AutomationScheduler {
  private readonly logger = new Logger(AutomationScheduler.name);

  constructor(
    private prisma: PrismaService,
    private automationService: AutomationService,
  ) {}

  // Run every 10 minutes to execute scheduled automations
  @Cron(CronExpression.EVERY_10_MINUTES)
  async processScheduledAutomations() {
    this.logger.log('Processing scheduled automations...');

    const pendingExecutions = await this.prisma.automationExecution.findMany({
      where: {
        status: 'pending',
        scheduledFor: { lte: new Date() },
      },
      include: {
        workflow: true,
      },
    });

    for (const execution of pendingExecutions) {
      if (!execution.proposalId) continue;

      const proposal = await this.prisma.proposal.findUnique({
        where: { id: execution.proposalId },
        include: { user: true },
      });

      if (!proposal) {
        await this.prisma.automationExecution.update({
          where: { id: execution.id },
          data: { status: 'cancelled', result: { error: 'Proposal not found' } },
        });
        continue;
      }

      // Mark as executing
      await this.prisma.automationExecution.update({
        where: { id: execution.id },
        data: { status: 'executing' },
      });

      await this.automationService.executeWorkflow(execution.workflow, proposal);
    }

    this.logger.log(`Processed ${pendingExecutions.length} scheduled automations`);
  }

  // Run daily to check for unopened proposals
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkUnopenedProposals() {
    this.logger.log('Checking for unopened proposals...');

    // Find proposals that are SENT but have never been viewed
    const unopenedProposals = await this.prisma.proposal.findMany({
      where: {
        status: 'SENT',
        viewCount: 0,
        sentAt: { not: null },
      },
    });

    for (const proposal of unopenedProposals) {
      await this.automationService.triggerWorkflows(
        AutomationTrigger.PROPOSAL_UNOPENED,
        proposal.id,
        {
          daysSinceSent: Math.floor(
            (Date.now() - (proposal.sentAt?.getTime() || 0)) / (1000 * 60 * 60 * 24),
          ),
        },
      );
    }

    this.logger.log(`Checked ${unopenedProposals.length} unopened proposals`);
  }

  // Run daily to check for expired proposals
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkExpiredProposals() {
    this.logger.log('Checking for expired proposals...');

    const expiredProposals = await this.prisma.proposal.findMany({
      where: {
        status: { in: ['SENT', 'VIEWED'] },
        expiresAt: { lte: new Date() },
      },
    });

    for (const proposal of expiredProposals) {
      // Update status to expired (we could add this status)
      await this.automationService.triggerWorkflows(
        AutomationTrigger.PROPOSAL_EXPIRED,
        proposal.id,
      );
    }

    this.logger.log(`Checked ${expiredProposals.length} expired proposals`);
  }
}
