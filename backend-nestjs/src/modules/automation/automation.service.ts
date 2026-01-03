import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';

export enum AutomationTrigger {
  PROPOSAL_SENT = 'PROPOSAL_SENT',
  PROPOSAL_VIEWED = 'PROPOSAL_VIEWED',
  PROPOSAL_UNOPENED = 'PROPOSAL_UNOPENED',
  PROPOSAL_APPROVED = 'PROPOSAL_APPROVED',
  PROPOSAL_DECLINED = 'PROPOSAL_DECLINED',
  PROPOSAL_EXPIRED = 'PROPOSAL_EXPIRED',
  COMMENT_ADDED = 'COMMENT_ADDED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
}

export enum AutomationAction {
  SEND_EMAIL = 'SEND_EMAIL',
  SEND_NOTIFICATION = 'SEND_NOTIFICATION',
  UPDATE_STATUS = 'UPDATE_STATUS',
  ASSIGN_TO = 'ASSIGN_TO',
  ADD_TAG = 'ADD_TAG',
  WEBHOOK = 'WEBHOOK',
  SLACK_NOTIFICATION = 'SLACK_NOTIFICATION',
}

export interface CreateWorkflowDto {
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  triggerConditions?: Record<string, any>;
  delayHours?: number;
  action: AutomationAction;
  actionConfig: Record<string, any>;
  targetTags?: string[];
  isActive?: boolean;
}

export interface UpdateWorkflowDto extends Partial<CreateWorkflowDto> {}

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  async create(userId: string, data: CreateWorkflowDto) {
    return this.prisma.automationWorkflow.create({
      data: {
        name: data.name,
        description: data.description,
        trigger: data.trigger,
        triggerConditions: data.triggerConditions || {},
        delayHours: data.delayHours || 0,
        action: data.action,
        actionConfig: data.actionConfig,
        targetTags: data.targetTags || [],
        isActive: data.isActive ?? true,
        userId,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.automationWorkflow.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { executions: true },
        },
      },
    });
  }

  async findOne(id: string, userId: string) {
    const workflow = await this.prisma.automationWorkflow.findUnique({
      where: { id },
      include: {
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    if (workflow.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return workflow;
  }

  async update(id: string, userId: string, data: UpdateWorkflowDto) {
    await this.findOne(id, userId);

    return this.prisma.automationWorkflow.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.trigger && { trigger: data.trigger }),
        ...(data.triggerConditions && { triggerConditions: data.triggerConditions }),
        ...(data.delayHours !== undefined && { delayHours: data.delayHours }),
        ...(data.action && { action: data.action }),
        ...(data.actionConfig && { actionConfig: data.actionConfig }),
        ...(data.targetTags && { targetTags: data.targetTags }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async delete(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.automationWorkflow.delete({ where: { id } });
  }

  async toggle(id: string, userId: string) {
    const workflow = await this.findOne(id, userId);
    return this.prisma.automationWorkflow.update({
      where: { id },
      data: { isActive: !workflow.isActive },
    });
  }

  // Trigger workflows based on events
  async triggerWorkflows(
    trigger: AutomationTrigger,
    proposalId: string,
    metadata?: Record<string, any>,
  ) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        user: true,
      },
    });

    if (!proposal) return;

    // Find matching workflows
    const workflows = await this.prisma.automationWorkflow.findMany({
      where: {
        userId: proposal.userId,
        trigger,
        isActive: true,
      },
    });

    for (const workflow of workflows) {
      // Check target tags if specified
      if (workflow.targetTags && workflow.targetTags.length > 0) {
        const proposalTags = await this.prisma.proposalTagAssignment.findMany({
          where: { proposalId },
          include: { tag: true },
        });
        type TagAssignment = { tag: { name: string } };
        const tagNames = proposalTags.map((pt: TagAssignment) => pt.tag.name);
        const hasMatchingTag = (workflow.targetTags as string[]).some((t: string) =>
          tagNames.includes(t),
        );
        if (!hasMatchingTag) continue;
      }

      // Schedule or execute immediately
      const scheduledFor = new Date();
      if (workflow.delayHours > 0) {
        scheduledFor.setHours(scheduledFor.getHours() + workflow.delayHours);
      }

      await this.prisma.automationExecution.create({
        data: {
          workflowId: workflow.id,
          proposalId,
          status: workflow.delayHours > 0 ? 'pending' : 'executing',
          scheduledFor,
        },
      });

      // Execute immediately if no delay
      if (workflow.delayHours === 0) {
        await this.executeWorkflow(workflow, proposal, metadata);
      }
    }
  }

  async executeWorkflow(workflow: any, proposal: any, metadata?: Record<string, any>) {
    const config = workflow.actionConfig as Record<string, any>;

    try {
      switch (workflow.action) {
        case AutomationAction.SEND_EMAIL:
          await this.executeSendEmail(config, proposal, metadata);
          break;

        case AutomationAction.SEND_NOTIFICATION:
          await this.executeSendNotification(config, proposal);
          break;

        case AutomationAction.UPDATE_STATUS:
          await this.executeUpdateStatus(config, proposal);
          break;

        case AutomationAction.ADD_TAG:
          await this.executeAddTag(config, proposal);
          break;

        case AutomationAction.WEBHOOK:
          await this.executeWebhook(config, proposal, metadata);
          break;

        case AutomationAction.SLACK_NOTIFICATION:
          await this.executeSlackNotification(config, proposal, metadata);
          break;
      }

      // Update workflow stats
      await this.prisma.automationWorkflow.update({
        where: { id: workflow.id },
        data: {
          executionCount: { increment: 1 },
          lastExecutedAt: new Date(),
        },
      });

      // Update execution status
      await this.prisma.automationExecution.updateMany({
        where: {
          workflowId: workflow.id,
          proposalId: proposal.id,
          status: 'executing',
        },
        data: {
          status: 'executed',
          executedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Workflow execution failed: ${(error as Error).message}`, (error as Error).stack);

      // Update execution with error
      await this.prisma.automationExecution.updateMany({
        where: {
          workflowId: workflow.id,
          proposalId: proposal.id,
          status: 'executing',
        },
        data: {
          status: 'failed',
          result: { error: (error as Error).message },
        },
      });
    }
  }

  private async executeSendEmail(
    config: Record<string, any>,
    proposal: any,
    metadata?: Record<string, any>,
  ) {
    const recipientEmail = config.to === 'client' ? proposal.recipientEmail : proposal.user.email;

    if (!recipientEmail) return;

    // Replace variables in subject and body
    const variables = {
      proposal_title: proposal.title,
      client_name: proposal.recipientName || 'Client',
      company_name: proposal.user.companyName || '',
      proposal_link: `${process.env.FRONTEND_URL}/p/${proposal.slug}`,
      ...metadata,
    };

    let subject = config.subject || 'Reminder about your proposal';
    let body = config.body || '';

    Object.entries(variables).forEach(([key, value]) => {
      subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value as string);
      body = body.replace(new RegExp(`{{${key}}}`, 'g'), value as string);
    });

    await this.emailService.send({
      to: recipientEmail,
      subject,
      html: body,
    });
  }

  private async executeSendNotification(config: Record<string, any>, proposal: any) {
    await this.notificationsService.create({
      userId: proposal.userId,
      type: config.notificationType || 'automation',
      title: config.title || 'Automation triggered',
      message: config.message || `Workflow executed for proposal: ${proposal.title}`,
      proposalId: proposal.id,
    });
  }

  private async executeUpdateStatus(config: Record<string, any>, proposal: any) {
    if (!config.newStatus) return;

    await this.prisma.proposal.update({
      where: { id: proposal.id },
      data: { status: config.newStatus },
    });
  }

  private async executeAddTag(config: Record<string, any>, proposal: any) {
    if (!config.tagName) return;

    // Find or create tag
    let tag = await this.prisma.proposalTag.findFirst({
      where: {
        userId: proposal.userId,
        name: config.tagName,
      },
    });

    if (!tag) {
      tag = await this.prisma.proposalTag.create({
        data: {
          name: config.tagName,
          color: config.tagColor || '#6366f1',
          userId: proposal.userId,
        },
      });
    }

    // Assign tag to proposal
    await this.prisma.proposalTagAssignment.upsert({
      where: {
        proposalId_tagId: {
          proposalId: proposal.id,
          tagId: tag.id,
        },
      },
      update: {},
      create: {
        proposalId: proposal.id,
        tagId: tag.id,
      },
    });
  }

  private async executeWebhook(
    config: Record<string, any>,
    proposal: any,
    metadata?: Record<string, any>,
  ) {
    if (!config.url) return;

    const payload = {
      event: 'automation_triggered',
      proposal: {
        id: proposal.id,
        title: proposal.title,
        status: proposal.status,
        recipientEmail: proposal.recipientEmail,
        recipientName: proposal.recipientName,
      },
      metadata,
      timestamp: new Date().toISOString(),
    };

    await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.headers || {}),
      },
      body: JSON.stringify(payload),
    });
  }

  private async executeSlackNotification(
    config: Record<string, any>,
    proposal: any,
    metadata?: Record<string, any>,
  ) {
    if (!config.webhookUrl) return;

    const message = config.message || `Proposal "${proposal.title}" triggered an automation`;

    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${config.title || 'Automation Triggered'}*\n${message}`,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Proposal:*\n${proposal.title}`,
              },
              {
                type: 'mrkdwn',
                text: `*Status:*\n${proposal.status}`,
              },
            ],
          },
        ],
      }),
    });
  }

  // Get workflow templates
  getWorkflowTemplates() {
    return [
      {
        name: 'Follow-up after no view',
        description: 'Send a reminder email if proposal is not viewed within 3 days',
        trigger: AutomationTrigger.PROPOSAL_UNOPENED,
        delayHours: 72,
        action: AutomationAction.SEND_EMAIL,
        actionConfig: {
          to: 'client',
          subject: 'Just checking in - {{proposal_title}}',
          body: 'Hi {{client_name}},<br><br>I wanted to make sure you received the proposal I sent. Please let me know if you have any questions.<br><br>Best regards',
        },
      },
      {
        name: 'Notify on proposal view',
        description: 'Get notified when a client views your proposal',
        trigger: AutomationTrigger.PROPOSAL_VIEWED,
        delayHours: 0,
        action: AutomationAction.SEND_NOTIFICATION,
        actionConfig: {
          title: 'Proposal Viewed',
          message: '{{client_name}} is viewing your proposal: {{proposal_title}}',
        },
      },
      {
        name: 'Slack alert on approval',
        description: 'Send a Slack message when a proposal is approved',
        trigger: AutomationTrigger.PROPOSAL_APPROVED,
        delayHours: 0,
        action: AutomationAction.SLACK_NOTIFICATION,
        actionConfig: {
          title: '🎉 Proposal Approved!',
          message: 'Great news! "{{proposal_title}}" has been approved by {{client_name}}.',
        },
      },
      {
        name: 'Tag declined proposals',
        description: 'Automatically tag declined proposals for follow-up',
        trigger: AutomationTrigger.PROPOSAL_DECLINED,
        delayHours: 0,
        action: AutomationAction.ADD_TAG,
        actionConfig: {
          tagName: 'Needs Follow-up',
          tagColor: '#ef4444',
        },
      },
    ];
  }
}
