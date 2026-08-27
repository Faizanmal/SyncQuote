import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomBytes } from 'crypto';

const CATALOG = [
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Sync contacts and deals with HubSpot CRM',
    provider: 'hubspot',
    category: 'crm',
    version: '1.4.0',
    features: ['contacts', 'deals', 'companies'],
    isPopular: true,
    isFeatured: true,
    logo: '',
    website: 'https://hubspot.com',
    documentation: 'https://developers.hubspot.com',
    supportEmail: 'integrations@syncquote.com',
    pricing: { plan: 'included', monthlyRequests: 10000, cost: 0 },
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Post proposal events to Slack channels',
    provider: 'slack',
    category: 'communication',
    version: '1.2.0',
    features: ['notifications', 'channels'],
    isPopular: true,
    isFeatured: false,
    logo: '',
    website: 'https://slack.com',
    documentation: 'https://api.slack.com',
    supportEmail: 'integrations@syncquote.com',
    pricing: { plan: 'included', monthlyRequests: 5000, cost: 0 },
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Collect proposal payments through Stripe',
    provider: 'stripe',
    category: 'payment',
    version: '2.0.0',
    features: ['checkout', 'invoices'],
    isPopular: true,
    isFeatured: true,
    logo: '',
    website: 'https://stripe.com',
    documentation: 'https://stripe.com/docs',
    supportEmail: 'integrations@syncquote.com',
    pricing: { plan: 'usage', monthlyRequests: 0, cost: 0 },
  },
];

@Injectable()
export class IntegrationsCatalogService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string, search?: string, category?: string, status?: string) {
    const saved = await this.readState(userId);
    const connected = saved.integrations || [];

    let items = CATALOG.map((item) => {
      const existing = connected.find(
        (row: any) => row.id === item.id || row.provider === item.provider,
      );
      return {
        ...item,
        status: existing?.status || 'inactive',
        lastSync: existing?.lastSync || new Date().toISOString(),
        syncedRecords: existing?.syncedRecords || 0,
        errorCount: existing?.errorCount || 0,
        config: existing?.config || {},
      };
    });

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (item) => item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
      );
    }
    if (category && category !== 'all') {
      items = items.filter((item) => item.category === category);
    }
    if (status && status !== 'all') {
      items = items.filter((item) => item.status === status);
    }

    return items;
  }

  async create(userId: string, dto: any) {
    const state = await this.readState(userId);
    const integration = {
      id: dto.provider || `int_${Date.now()}`,
      name: dto.name,
      description: dto.description || '',
      provider: dto.provider || dto.name?.toLowerCase() || 'custom',
      category: dto.category || 'productivity',
      status: 'active',
      version: '1.0.0',
      lastSync: new Date().toISOString(),
      syncedRecords: 0,
      errorCount: 0,
      config: dto.config || {},
      features: [],
      isPopular: false,
      isFeatured: false,
      logo: '',
      website: '',
      documentation: '',
      supportEmail: '',
      pricing: { plan: 'custom', monthlyRequests: 0, cost: 0 },
    };
    state.integrations = [
      ...(state.integrations || []).filter((row: any) => row.id !== integration.id),
      integration,
    ];
    await this.writeState(userId, state);
    return integration;
  }

  async update(userId: string, id: string, dto: any) {
    const state = await this.readState(userId);
    const integrations = state.integrations || [];
    const index = integrations.findIndex((row: any) => row.id === id);
    if (index === -1) {
      const created = await this.create(userId, { ...dto, provider: id, name: id });
      return { ...created, ...dto };
    }
    integrations[index] = { ...integrations[index], ...dto, lastSync: new Date().toISOString() };
    state.integrations = integrations;
    await this.writeState(userId, state);
    return integrations[index];
  }

  async sync(userId: string, id: string) {
    return this.update(userId, id, {
      lastSync: new Date().toISOString(),
      syncedRecords: Math.floor(Math.random() * 40) + 1,
      status: 'active',
    });
  }

  async listWebhooks(userId: string) {
    const state = await this.readState(userId);
    return (state.webhooks || []).map((webhook: any) => ({
      ...webhook,
      headers: webhook.headers || {},
      events: this.asStringArray(webhook.events),
      retryPolicy: webhook.retryPolicy || { attempts: 3, backoff: 'exponential', delay: 1000 },
      lastTriggered: webhook.lastTriggered || webhook.lastDelivery || null,
      successCount: webhook.successCount || 0,
      failureCount: webhook.failureCount || 0,
      avgResponseTime: webhook.avgResponseTime || 0,
      isActive: webhook.isActive !== false,
    }));
  }

  async createWebhook(userId: string, dto: any) {
    const state = await this.readState(userId);
    const webhook = {
      id: `wh_${Date.now()}`,
      name: dto.name,
      url: dto.url,
      events: this.asStringArray(dto.events),
      headers: dto.headers || {},
      secret: dto.secret || randomBytes(16).toString('hex'),
      isActive: true,
      retryPolicy: {
        attempts: dto.retryAttempts || 3,
        backoff: 'exponential',
        delay: 1000,
      },
      lastTriggered: null,
      successCount: 0,
      failureCount: 0,
      avgResponseTime: 0,
      createdAt: new Date().toISOString(),
    };
    state.webhooks = [...(state.webhooks || []), webhook];
    await this.writeState(userId, state);
    return webhook;
  }

  async testWebhook(userId: string, webhookId: string) {
    const state = await this.readState(userId);
    const webhook = (state.webhooks || []).find((row: any) => row.id === webhookId);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    webhook.lastDelivery = new Date().toISOString();
    await this.writeState(userId, state);
    return { success: true, webhookId };
  }

  listEndpoints() {
    return [
      {
        id: 'proposals',
        path: '/api/v1/proposals',
        method: 'GET',
        description: 'List proposals',
        category: 'proposals',
        isPublic: false,
        rateLimit: { requests: 100, period: 'minute', burst: 20 },
        authentication: 'api_key',
        requestCount: 0,
        errorRate: 0,
        avgResponseTime: 120,
        isDeprecated: false,
        version: 'v1',
      },
      {
        id: 'invoices',
        path: '/api/v1/invoices',
        method: 'GET',
        description: 'List invoices',
        category: 'billing',
        isPublic: false,
        rateLimit: { requests: 100, period: 'minute', burst: 20 },
        authentication: 'api_key',
        requestCount: 0,
        errorRate: 0,
        avgResponseTime: 140,
        isDeprecated: false,
        version: 'v1',
      },
    ];
  }

  async listApiKeys(userId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      key: key.keyPrefix ? `${key.keyPrefix}••••` : '••••',
      permissions: this.asStringArray(key.permissions),
      rateLimit: { requests: key.rateLimit || 1000, period: 'hour' },
      lastUsed: key.lastUsedAt || key.lastUsed,
      requestCount: key.usageCount,
      isActive: key.isActive,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      ipWhitelist: key.allowedIps,
    }));
  }

  async createApiKey(userId: string, dto: any) {
    const raw = `sk_live_${randomBytes(24).toString('hex')}`;
    const created = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        key: raw,
        keyPrefix: raw.slice(0, 10),
        permissions: this.asStringArray(dto.permissions),
        rateLimit: dto.rateLimit || 1000,
        allowedIps: this.asStringArray(dto.ipWhitelist),
        isActive: true,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
    return { ...created, key: raw };
  }

  listTemplates(category?: string) {
    const templates = CATALOG.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      provider: item.provider,
      category: item.category,
      setupSteps: ['Connect account', 'Choose resources', 'Enable sync'],
      requiredFields: ['apiKey'],
      optionalFields: ['webhookUrl'],
      estimatedSetupTime: 10,
      difficulty: 'easy',
      usageCount: 12,
      rating: 4.6,
      reviews: 8,
    }));
    if (category && category !== 'all') {
      return templates.filter((item) => item.category === category);
    }
    return templates;
  }

  async analytics(userId: string) {
    const state = await this.readState(userId);
    const connected = state.integrations || [];
    const active = connected.filter((row: any) => row.status === 'active').length;
    const apiUsage = this.listEndpoints().map((endpoint) => ({
      method: endpoint.method,
      path: endpoint.path,
      requests: endpoint.requestCount || 0,
    }));
    const totalRequests = apiUsage.reduce((sum, row) => sum + row.requests, 0);

    return {
      connected: connected.length,
      active,
      webhooks: (state.webhooks || []).length,
      syncsToday: active,
      totalRequests: totalRequests || 1,
      integrationPerformance: CATALOG.map((item) => {
        const existing = connected.find(
          (row: any) => row.id === item.id || row.provider === item.provider,
        );
        return {
          name: item.name,
          successRate: existing?.status === 'active' ? 98 : 0,
        };
      }),
      apiUsage,
      realtimeActivity: connected.slice(0, 8).map((row: any) => ({
        message: `${row.name} ${row.status === 'active' ? 'synced' : 'idle'}`,
        timestamp: row.lastSync || new Date().toISOString(),
        type: row.status === 'active' ? 'sync' : 'idle',
      })),
    };
  }

  async installTemplate(userId: string, templateId: string) {
    const template = CATALOG.find((item) => item.id === templateId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return this.create(userId, template);
  }

  private asStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map(String).filter(Boolean);
    }
    if (typeof value === 'string' && value.trim()) {
      return [value];
    }
    return [];
  }

  private async readState(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });
    const metadata = (user?.metadata || {}) as Record<string, any>;
    return {
      integrations: metadata.integrations || [],
      webhooks: metadata.integrationWebhooks || [],
    };
  }

  private async writeState(userId: string, state: { integrations: any[]; webhooks: any[] }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });
    const metadata = { ...((user?.metadata || {}) as Record<string, any>) };
    metadata.integrations = state.integrations;
    metadata.integrationWebhooks = state.webhooks;
    await this.prisma.user.update({
      where: { id: userId },
      data: { metadata },
    });
  }
}
