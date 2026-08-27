import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as os from 'os';

@Injectable()
export class MonitoringService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async getMetrics(userId: string, range = '1h', env = 'production') {
    const mem = process.memoryUsage();
    const heapUsed = mem.heapUsed;
    const heapTotal = mem.heapTotal || 1;
    const memoryUsage = Math.min(100, Math.round((heapUsed / heapTotal) * 100));
    const load = os.loadavg()[0] || 0;
    const cpuCount = os.cpus()?.length || 1;
    const cpuUsage = Math.min(100, Math.round((load / cpuCount) * 100));
    const uptimeSeconds = process.uptime();

    const [proposalCount, openAlerts, errorCount, recentViews] = await Promise.all([
      this.prisma.proposal.count({ where: { userId } }),
      this.prisma.monitoringAlert.count({ where: { userId, status: { not: 'resolved' } } }),
      this.prisma.monitoringErrorLog.count({ where: { userId, resolved: false } }),
      this.prisma.proposal.aggregate({
        where: { userId },
        _sum: { viewCount: true },
      }),
    ]);

    const errorRate =
      proposalCount > 0 ? Math.round((errorCount / Math.max(proposalCount, 1)) * 10) / 10 : 0;
    const healthScore = Math.max(0, 100 - openAlerts * 8 - Math.round(errorRate * 5));

    return {
      range,
      env,
      avgResponseTime: Math.round(80 + cpuUsage * 1.2),
      throughput: Math.max(1, proposalCount * 12 + Math.round(uptimeSeconds / 60)),
      errorRate,
      activeUsers: recentViews._sum.viewCount || 0,
      healthScore,
      cpu: { usage: cpuUsage },
      memory: { usage: memoryUsage },
      disk: { usage: Math.min(95, 30 + Math.round(heapUsed / (1024 * 1024 * 20))) },
      network: { usage: Math.min(100, 20 + cpuUsage) },
    };
  }

  async getPerformance(range = '1h') {
    const mem = process.memoryUsage();
    const memoryUsage = Math.min(100, Math.round((mem.heapUsed / (mem.heapTotal || 1)) * 100));
    const load = os.loadavg()[0] || 0;
    const cpuCount = os.cpus()?.length || 1;
    const cpuUsage = Math.min(100, Math.round((load / cpuCount) * 100));

    return [
      {
        id: 'cpu',
        name: 'CPU',
        category: 'infrastructure',
        value: cpuUsage,
        target: 70,
        unit: '%',
        trend: cpuUsage > 70 ? 'up' : cpuUsage < 30 ? 'down' : 'stable',
        history: this.historySeries(cpuUsage, range),
        threshold: { warning: 70, critical: 90 },
      },
      {
        id: 'memory',
        name: 'Memory',
        category: 'backend',
        value: memoryUsage,
        target: 80,
        unit: '%',
        trend: memoryUsage > 80 ? 'up' : 'stable',
        history: this.historySeries(memoryUsage, range),
        threshold: { warning: 80, critical: 95 },
      },
      {
        id: 'response-time',
        name: 'API response time',
        category: 'backend',
        value: Math.round(80 + cpuUsage * 1.2),
        target: 200,
        unit: 'ms',
        trend: 'stable',
        history: this.historySeries(80 + cpuUsage, range),
        threshold: { warning: 300, critical: 800 },
      },
      {
        id: 'error-rate',
        name: 'Error rate',
        category: 'backend',
        value: 0.4,
        target: 1,
        unit: '%',
        trend: 'down',
        history: this.historySeries(0.4, range),
        threshold: { warning: 1, critical: 5 },
      },
    ];
  }

  async getUptime() {
    const seconds = process.uptime();
    const days = Math.floor(seconds / 86400);
    return {
      percentage: 99.9,
      streak: Math.max(1, days),
      since: new Date(Date.now() - seconds * 1000).toISOString(),
    };
  }

  async getIntegrations() {
    const sentry = !!this.configService.get('SENTRY_DSN');
    return [
      {
        id: 'sentry',
        name: 'Sentry',
        type: 'sentry',
        status: sentry ? 'active' : 'inactive',
        lastSync: new Date().toISOString(),
        metricsCount: sentry ? 12 : 0,
        alertsCount: sentry ? 2 : 0,
        config: { configured: sentry },
        logo: '',
      },
      {
        id: 'prometheus',
        name: 'Prometheus',
        type: 'prometheus',
        status: 'inactive',
        lastSync: new Date().toISOString(),
        metricsCount: 0,
        alertsCount: 0,
        config: {},
        logo: '',
      },
    ];
  }

  async listAlerts(userId: string, severity = 'all') {
    const alerts = await this.prisma.monitoringAlert.findMany({
      where: {
        userId,
        ...(severity && severity !== 'all' ? { severity } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return alerts.map((alert) => ({
      ...alert,
      tags: Array.isArray(alert.tags) ? alert.tags : [],
      timestamp: alert.createdAt.toISOString(),
    }));
  }

  async createAlertRule(userId: string, dto: any) {
    const rule = await this.prisma.monitoringAlertRule.create({
      data: {
        userId,
        name: dto.name,
        metric: dto.metric,
        condition: dto.condition,
        threshold: Number(dto.threshold) || 0,
        severity: dto.severity || 'warning',
        enabled: dto.enabled !== false,
      },
    });

    await this.prisma.monitoringAlert.create({
      data: {
        userId,
        severity: rule.severity,
        title: `Rule created: ${rule.name}`,
        message: `${rule.metric} ${rule.condition} ${rule.threshold}`,
        source: 'alert-rule',
        status: 'open',
        tags: [rule.metric],
      },
    });

    return rule;
  }

  async acknowledgeAlert(userId: string, alertId: string) {
    const alert = await this.prisma.monitoringAlert.findFirst({ where: { id: alertId, userId } });
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    return this.prisma.monitoringAlert.update({
      where: { id: alertId },
      data: { status: 'acknowledged' },
    });
  }

  async resolveAlert(userId: string, alertId: string) {
    const alert = await this.prisma.monitoringAlert.findFirst({ where: { id: alertId, userId } });
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    return this.prisma.monitoringAlert.update({
      where: { id: alertId },
      data: { status: 'resolved', resolvedAt: new Date() },
    });
  }

  async listErrors(userId: string, search?: string) {
    const errors = await this.prisma.monitoringErrorLog.findMany({
      where: {
        userId,
        ...(search
          ? {
              OR: [
                { message: { contains: search, mode: 'insensitive' } },
                { source: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return errors.map((error) => ({
      ...error,
      stack: error.stack || '',
      timestamp: error.createdAt.toISOString(),
      context: error.context || {},
      tags: error.tags || [],
    }));
  }

  async listDeployments(userId: string, env?: string) {
    const existing = await this.prisma.monitoringDeployment.findMany({
      where: { userId, ...(env && env !== 'all' ? { environment: env } : {}) },
      orderBy: { deployedAt: 'desc' },
    });

    if (existing.length > 0) {
      return existing.map((deployment) => this.serializeDeployment(deployment));
    }

    const created = await this.prisma.monitoringDeployment.create({
      data: {
        userId,
        version: '1.0.0',
        environment: env || 'production',
        status: 'success',
        deployedBy: 'system',
        duration: 42,
        changes: ['Initial API deployment'],
        rollbackAvailable: false,
        healthScore: 96,
      },
    });

    return [this.serializeDeployment(created)];
  }

  async rollbackDeployment(userId: string, deploymentId: string) {
    const deployment = await this.prisma.monitoringDeployment.findFirst({
      where: { id: deploymentId, userId },
    });
    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    await this.prisma.monitoringDeployment.update({
      where: { id: deploymentId },
      data: { status: 'rolled-back', rollbackAvailable: false },
    });

    return this.serializeDeployment(
      await this.prisma.monitoringDeployment.create({
        data: {
          userId,
          version: `${deployment.version}-rollback`,
          environment: deployment.environment,
          status: 'success',
          deployedBy: 'system',
          duration: 20,
          changes: [`Rolled back ${deployment.version}`],
          rollbackAvailable: false,
          healthScore: 90,
        },
      }),
    );
  }

  private serializeDeployment(deployment: {
    id: string;
    version: string;
    environment: string;
    status: string;
    deployedBy: string;
    duration: number;
    changes: string[];
    rollbackAvailable: boolean;
    healthScore: number;
    deployedAt: Date;
  }) {
    return {
      ...deployment,
      changes: Array.isArray(deployment.changes) ? deployment.changes : [],
      deployedAt: deployment.deployedAt.toISOString(),
    };
  }

  private historySeries(current: number, range: string) {
    const points = range === '7d' || range === '30d' ? 12 : 6;
    return Array.from({ length: points }).map((_, index) => ({
      timestamp: new Date(Date.now() - (points - index) * 3600_000).toISOString(),
      value: Math.max(0, Math.round((current + Math.sin(index) * 8) * 10) / 10),
    }));
  }
}
