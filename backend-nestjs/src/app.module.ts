import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProposalsModule } from './modules/proposals/proposals.module';
import { CommentsModule } from './modules/comments/comments.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { StorageModule } from './modules/storage/storage.module';
import { EmailModule } from './modules/email/email.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditModule } from './modules/audit/audit.module';
import { VersionsModule } from './modules/versions/versions.module';
import { CurrencyModule } from './modules/currency/currency.module';
import { ClientPortalModule } from './modules/client-portal/client-portal.module';
import { AIModule } from './modules/ai/ai.module';
// New feature modules
import { ViewAnalyticsModule } from './modules/view-analytics/view-analytics.module';
import { SnippetsModule } from './modules/snippets/snippets.module';
import { AutomationModule } from './modules/automation/automation.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ForecastingModule } from './modules/forecasting/forecasting.module';
import { TeamsModule } from './modules/teams/teams.module';
// Advanced feature modules (Deep Integration)
import { CrmIntegrationsModule } from './modules/crm-integrations/crm-integrations.module';
import { VideoProposalsModule } from './modules/video-proposals/video-proposals.module';
import { BulkOperationsModule } from './modules/bulk-operations/bulk-operations.module';
import { AbTestingModule } from './modules/ab-testing/ab-testing.module';
import { HeatmapsModule } from './modules/heatmaps/heatmaps.module';
import { I18nModule } from './modules/i18n/i18n.module';
import { UpsellModule } from './modules/upsell/upsell.module';
// Ecosystem & Business Feature Modules
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { ApiMarketplaceModule } from './modules/api-marketplace/api-marketplace.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Logging
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'development'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
                },
              }
            : undefined,
        serializers: {
          req: (req: any) => ({
            method: req.method,
            url: req.url,
            params: req.params,
            query: req.query,
          }),
          res: (res: any) => ({
            statusCode: res.statusCode,
          }),
        },
        autoLogging: true,
        level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      },
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10) * 1000,
        limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      },
      {
        name: 'auth',
        ttl: 60 * 1000, // 1 minute
        limit: 5, // 5 attempts per minute for auth endpoints
      },
    ]),

    // Scheduling (for background jobs)
    ScheduleModule.forRoot(),

    // Core modules
    PrismaModule,
    AuthModule,
    UsersModule,
    ProposalsModule,
    CommentsModule,
    WebhooksModule,
    StorageModule,
    EmailModule,
    EventsModule,
    HealthModule,

    // New feature modules
    TemplatesModule,
    NotificationsModule,
    AnalyticsModule,
    AuditModule,

    // Latest feature modules
    VersionsModule,
    CurrencyModule,
    ClientPortalModule,
    AIModule,

    // Advanced feature modules
    ViewAnalyticsModule,
    SnippetsModule,
    AutomationModule,
    PaymentsModule,
    ForecastingModule,
    TeamsModule,

    // Deep integration modules (7 major features)
    CrmIntegrationsModule,
    VideoProposalsModule,
    BulkOperationsModule,
    AbTestingModule,
    HeatmapsModule,
    I18nModule,
    UpsellModule,

    // Ecosystem & Business Feature Modules
    IntegrationsModule,
    ContractsModule,
    InvoicesModule,
    ApiMarketplaceModule,
  ],
})
export class AppModule {}
