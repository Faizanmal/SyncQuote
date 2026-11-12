import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as os from 'os';

@Injectable()
export class MonitoringService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async getMetrics(_userId: string, range = '1h', env = 'production') {
    const mem = process.memoryUsage();
    const heapUsed = mem.heapUsed;
    const heapTotal = mem.heapTotal || 1;
    const memoryUsage = Math.min(100, Math.round((heapUsed / heapTotal) * 100));
    const load = os.loadavg()[0] || 0;
    const cpuCount = os.cpus()?.length || 1;
    const cpuUsage = Math.min(100, Math.round((load / cpuCount) * 100));
    return {
      range,
      env,
      avgResponseTime: null,
      throughput: null,
      errorRate: null,
      activeUsers: null,
      healthScore: null,
      cpu: { usage: cpuUsage },
      memory: { usage: memoryUsage },
      disk: null,
      network: null,
    };
  }

  async getPerformance(_range = '1h') {
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
        history: [],
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
        history: [],
        threshold: { warning: 80, critical: 95 },
      },
    ];
  }

  async getUptime() {
    const seconds = process.uptime();
    const days = Math.floor(seconds / 86400);
    return {
      percentage: null,
      streak: days,
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
        status: sentry ? 'configured' : 'inactive',
        lastSync: null,
        metricsCount: null,
        alertsCount: null,
        config: { configured: sentry },
        logo: '',
      },
      {
        id: 'prometheus',
        name: 'Prometheus',
        type: 'prometheus',
        status: 'inactive',
        lastSync: null,
        metricsCount: null,
        alertsCount: null,
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

    return existing.map((deployment) => this.serializeDeployment(deployment));
  }

  async rollbackDeployment(userId: string, deploymentId: string) {
    const deployment = await this.prisma.monitoringDeployment.findFirst({
      where: { id: deploymentId, userId },
    });
    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }
    throw new NotImplementedException('Deployment rollback is not connected to a deployment provider');
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
}
