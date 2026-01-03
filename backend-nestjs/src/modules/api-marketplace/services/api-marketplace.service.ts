import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

export interface MarketplaceApp {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  developer: {
    id: string;
    name: string;
    company?: string;
    email: string;
    verified: boolean;
  };
  category: string;
  tags: string[];
  icon: string;
  screenshots: string[];
  pricing: {
    type: 'free' | 'paid' | 'freemium';
    price?: number;
    billingCycle?: 'monthly' | 'yearly' | 'one-time';
  };
  permissions: string[];
  webhookEvents: string[];
  endpoints: {
    install: string;
    uninstall: string;
    webhook?: string;
    oauth?: string;
  };
  documentation: string;
  supportUrl?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  rating: number;
  reviewCount: number;
  installCount: number;
  status: 'pending' | 'approved' | 'rejected' | 'published' | 'suspended';
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppInstallation {
  id: string;
  userId: string;
  appId: string;
  status: 'active' | 'suspended' | 'uninstalled';
  permissions: string[];
  config: Record<string, any>;
  accessToken?: string;
  refreshToken?: string;
  installedAt: Date;
  lastUsedAt?: Date;
}

export interface MarketplaceReview {
  id: string;
  appId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  content: string;
  helpful: number;
  createdAt: Date;
}

@Injectable()
export class ApiMarketplaceService {
  private readonly logger = new Logger(ApiMarketplaceService.name);

  // Categories for the marketplace
  private readonly categories = [
    { id: 'crm', name: 'CRM & Sales', icon: '💼' },
    { id: 'productivity', name: 'Productivity', icon: '⚡' },
    { id: 'communication', name: 'Communication', icon: '💬' },
    { id: 'analytics', name: 'Analytics', icon: '📊' },
    { id: 'payments', name: 'Payments', icon: '💳' },
    { id: 'storage', name: 'Storage', icon: '📁' },
    { id: 'automation', name: 'Automation', icon: '🤖' },
    { id: 'marketing', name: 'Marketing', icon: '📣' },
    { id: 'project-management', name: 'Project Management', icon: '📋' },
    { id: 'other', name: 'Other', icon: '🔧' },
  ];

  // Available permissions for apps
  private readonly availablePermissions = [
    { id: 'proposals:read', name: 'Read Proposals', description: 'View proposal data' },
    { id: 'proposals:write', name: 'Write Proposals', description: 'Create and update proposals' },
    { id: 'clients:read', name: 'Read Clients', description: 'View client data' },
    { id: 'clients:write', name: 'Write Clients', description: 'Create and update clients' },
    { id: 'templates:read', name: 'Read Templates', description: 'View templates' },
    { id: 'templates:write', name: 'Write Templates', description: 'Create and update templates' },
    { id: 'analytics:read', name: 'Read Analytics', description: 'View analytics data' },
    { id: 'payments:read', name: 'Read Payments', description: 'View payment data' },
    { id: 'payments:write', name: 'Write Payments', description: 'Process payments' },
    { id: 'webhooks:write', name: 'Manage Webhooks', description: 'Create and manage webhooks' },
    { id: 'team:read', name: 'Read Team', description: 'View team members' },
    { id: 'settings:read', name: 'Read Settings', description: 'View user settings' },
    { id: 'settings:write', name: 'Write Settings', description: 'Update user settings' },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ==================== App Discovery ====================

  async getCategories(): Promise<any[]> {
    return this.categories;
  }

  async getAvailablePermissions(): Promise<any[]> {
    return this.availablePermissions;
  }

  async listApps(filters?: {
    category?: string;
    search?: string;
    featured?: boolean;
    free?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ apps: MarketplaceApp[]; total: number }> {
    // In production, this would query a dedicated marketplace database
    // For now, return sample apps
    const sampleApps: MarketplaceApp[] = [
      {
        id: 'app-salesforce',
        name: 'Salesforce',
        slug: 'salesforce',
        description: 'Sync your proposals with Salesforce CRM. Automatically create deals, update stages, and sync contacts.',
        shortDescription: 'Connect SyncQuote with Salesforce CRM',
        developer: {
          id: 'dev-1',
          name: 'SyncQuote Team',
          company: 'SyncQuote',
          email: 'integrations@syncquote.com',
          verified: true,
        },
        category: 'crm',
        tags: ['crm', 'sales', 'sync'],
        icon: 'https://cdn.syncquote.com/apps/salesforce.png',
        screenshots: [],
        pricing: { type: 'free' },
        permissions: ['proposals:read', 'proposals:write', 'clients:read', 'clients:write'],
        webhookEvents: ['proposal.approved', 'proposal.signed'],
        endpoints: {
          install: '/api/integrations/salesforce/install',
          uninstall: '/api/integrations/salesforce/uninstall',
          oauth: '/api/integrations/salesforce/oauth',
        },
        documentation: 'https://docs.syncquote.com/integrations/salesforce',
        rating: 4.8,
        reviewCount: 127,
        installCount: 1523,
        status: 'published',
        featured: true,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-12-01'),
      },
      {
        id: 'app-slack',
        name: 'Slack',
        slug: 'slack',
        description: 'Get real-time notifications in Slack when proposals are viewed, approved, or signed.',
        shortDescription: 'Slack notifications for proposal activity',
        developer: {
          id: 'dev-1',
          name: 'SyncQuote Team',
          company: 'SyncQuote',
          email: 'integrations@syncquote.com',
          verified: true,
        },
        category: 'communication',
        tags: ['notifications', 'messaging', 'team'],
        icon: 'https://cdn.syncquote.com/apps/slack.png',
        screenshots: [],
        pricing: { type: 'free' },
        permissions: ['proposals:read'],
        webhookEvents: ['proposal.viewed', 'proposal.approved', 'proposal.signed'],
        endpoints: {
          install: '/api/integrations/slack/install',
          uninstall: '/api/integrations/slack/uninstall',
          oauth: '/api/integrations/slack/oauth',
        },
        documentation: 'https://docs.syncquote.com/integrations/slack',
        rating: 4.9,
        reviewCount: 89,
        installCount: 2341,
        status: 'published',
        featured: true,
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-11-15'),
      },
      {
        id: 'app-zapier',
        name: 'Zapier',
        slug: 'zapier',
        description: 'Connect SyncQuote to 5,000+ apps through Zapier. Automate your workflow with custom triggers and actions.',
        shortDescription: 'Automate workflows with Zapier',
        developer: {
          id: 'dev-1',
          name: 'SyncQuote Team',
          company: 'SyncQuote',
          email: 'integrations@syncquote.com',
          verified: true,
        },
        category: 'automation',
        tags: ['automation', 'workflow', 'integration'],
        icon: 'https://cdn.syncquote.com/apps/zapier.png',
        screenshots: [],
        pricing: { type: 'free' },
        permissions: ['proposals:read', 'proposals:write', 'clients:read', 'webhooks:write'],
        webhookEvents: ['*'],
        endpoints: {
          install: '/api/integrations/zapier/install',
          uninstall: '/api/integrations/zapier/uninstall',
          webhook: '/api/integrations/zapier/webhook',
        },
        documentation: 'https://docs.syncquote.com/integrations/zapier',
        rating: 4.7,
        reviewCount: 234,
        installCount: 4521,
        status: 'published',
        featured: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-12-10'),
      },
    ];

    let apps = [...sampleApps];

    if (filters?.category) {
      apps = apps.filter(a => a.category === filters.category);
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      apps = apps.filter(a => 
        a.name.toLowerCase().includes(search) ||
        a.description.toLowerCase().includes(search) ||
        a.tags.some(t => t.toLowerCase().includes(search))
      );
    }
    if (filters?.featured) {
      apps = apps.filter(a => a.featured);
    }
    if (filters?.free) {
      apps = apps.filter(a => a.pricing.type === 'free');
    }

    const total = apps.length;
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 20;
    apps = apps.slice(offset, offset + limit);

    return { apps, total };
  }

  async getApp(appId: string): Promise<MarketplaceApp | null> {
    const { apps } = await this.listApps();
    return apps.find(a => a.id === appId) || null;
  }

  async getFeaturedApps(): Promise<MarketplaceApp[]> {
    const { apps } = await this.listApps({ featured: true });
    return apps;
  }

  // ==================== App Installation ====================

  async installApp(
    userId: string,
    appId: string,
    config?: Record<string, any>,
  ): Promise<AppInstallation> {
    const app = await this.getApp(appId);
    if (!app) {
      throw new BadRequestException('App not found');
    }

    // Check if already installed
    const existing = await this.getInstallation(userId, appId);
    if (existing && existing.status === 'active') {
      throw new BadRequestException('App already installed');
    }

    // Generate access token for the app
    const accessToken = uuidv4();

    const installation: AppInstallation = {
      id: uuidv4(),
      userId,
      appId,
      status: 'active',
      permissions: app.permissions,
      config: config || {},
      accessToken,
      installedAt: new Date(),
    };

    // Store installation (in production, use dedicated table)
    await this.storeInstallation(userId, installation);

    // Notify app developer's install endpoint
    // In production: await this.notifyAppInstall(app, installation);

    this.logger.log(`App ${appId} installed for user ${userId}`);

    return installation;
  }

  async uninstallApp(userId: string, appId: string): Promise<void> {
    const installation = await this.getInstallation(userId, appId);
    if (!installation) {
      throw new BadRequestException('App not installed');
    }

    installation.status = 'uninstalled';
    await this.storeInstallation(userId, installation);

    // Notify app developer's uninstall endpoint
    // In production: await this.notifyAppUninstall(app, installation);

    this.logger.log(`App ${appId} uninstalled for user ${userId}`);
  }

  async getInstallation(userId: string, appId: string): Promise<AppInstallation | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });

    const installations = ((user as any)?.metadata?.appInstallations || []) as AppInstallation[];
    return installations.find(i => i.appId === appId) || null;
  }

  async getUserInstallations(userId: string): Promise<AppInstallation[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });

    return ((user as any)?.metadata?.appInstallations || [])
      .filter((i: AppInstallation) => i.status === 'active');
  }

  async updateInstallationConfig(
    userId: string,
    appId: string,
    config: Record<string, any>,
  ): Promise<AppInstallation> {
    const installation = await this.getInstallation(userId, appId);
    if (!installation || installation.status !== 'active') {
      throw new BadRequestException('App not installed');
    }

    installation.config = { ...installation.config, ...config };
    await this.storeInstallation(userId, installation);

    return installation;
  }

  // ==================== Developer Portal ====================

  async registerApp(
    developerId: string,
    appData: Omit<MarketplaceApp, 'id' | 'rating' | 'reviewCount' | 'installCount' | 'status' | 'createdAt' | 'updatedAt'>,
  ): Promise<MarketplaceApp> {
    // Validate app data
    if (!appData.name || !appData.description || !appData.endpoints.install) {
      throw new BadRequestException('Missing required app fields');
    }

    const app: MarketplaceApp = {
      ...appData,
      id: uuidv4(),
      slug: appData.name.toLowerCase().replace(/\s+/g, '-'),
      rating: 0,
      reviewCount: 0,
      installCount: 0,
      status: 'pending',
      featured: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store app (in production, use dedicated table)
    // await this.storeApp(app);

    this.logger.log(`New app registered: ${app.name} by ${developerId}`);

    return app;
  }

  async updateApp(
    developerId: string,
    appId: string,
    updates: Partial<MarketplaceApp>,
  ): Promise<MarketplaceApp> {
    const app = await this.getApp(appId);
    if (!app) {
      throw new BadRequestException('App not found');
    }

    if (app.developer.id !== developerId) {
      throw new BadRequestException('Not authorized to update this app');
    }

    // In production: update app in database

    return { ...app, ...updates, updatedAt: new Date() };
  }

  async submitForReview(developerId: string, appId: string): Promise<void> {
    const app = await this.getApp(appId);
    if (!app) {
      throw new BadRequestException('App not found');
    }

    if (app.developer.id !== developerId) {
      throw new BadRequestException('Not authorized');
    }

    // In production: update app status to 'pending'
    this.logger.log(`App ${appId} submitted for review`);
  }

  // ==================== Reviews ====================

  async getAppReviews(appId: string): Promise<MarketplaceReview[]> {
    // In production, fetch from database
    return [];
  }

  async addReview(
    userId: string,
    appId: string,
    review: {
      rating: number;
      title: string;
      content: string;
    },
  ): Promise<MarketplaceReview> {
    // Verify user has app installed
    const installation = await this.getInstallation(userId, appId);
    if (!installation) {
      throw new BadRequestException('You must install the app before reviewing');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const newReview: MarketplaceReview = {
      id: uuidv4(),
      appId,
      userId,
      userName: user?.name || 'Anonymous',
      rating: review.rating,
      title: review.title,
      content: review.content,
      helpful: 0,
      createdAt: new Date(),
    };

    // In production: store review in database

    return newReview;
  }

  // ==================== API Keys for Apps ====================

  async generateAppApiKey(
    userId: string,
    appId: string,
    permissions: string[],
  ): Promise<{ apiKey: string; keyId: string }> {
    const installation = await this.getInstallation(userId, appId);
    if (!installation || installation.status !== 'active') {
      throw new BadRequestException('App not installed');
    }

    const apiKey = `sqk_${uuidv4().replace(/-/g, '')}`;
    const keyId = uuidv4();

    await this.prisma.apiKey.create({
      data: {
        id: keyId,
        userId,
        key: apiKey,
        name: `API Key for ${appId}`,
        permissions,
        isActive: true,
      },
    });

    return { apiKey, keyId };
  }

  async validateAppApiKey(
    apiKey: string,
    requiredPermission: string,
  ): Promise<{ valid: boolean; userId?: string }> {
    const key = await this.prisma.apiKey.findUnique({
      where: { key: apiKey },
    });

    if (!key || !key.isActive) {
      return { valid: false };
    }

    if (!key.permissions.includes(requiredPermission)) {
      return { valid: false };
    }

    // Update last used
    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { 
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    });

    return { valid: true, userId: key.userId };
  }

  // ==================== Helper Methods ====================

  private async storeInstallation(userId: string, installation: AppInstallation): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });

    const installations = ((user as any)?.metadata?.appInstallations || []) as AppInstallation[];
    const existingIndex = installations.findIndex(i => i.appId === installation.appId);

    if (existingIndex >= 0) {
      installations[existingIndex] = installation;
    } else {
      installations.push(installation);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        metadata: {
          ...(user as any)?.metadata,
          appInstallations: installations,
        },
      },
    });
  }
}
