import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { PublicApiController } from './public-api.controller';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { OAuthService } from './oauth.service';
import { OAuthController } from './oauth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ProposalsModule } from '../proposals/proposals.module';

@Module({
  imports: [
    PrismaModule,
    ProposalsModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
  ],
  controllers: [ApiKeysController, PublicApiController, WebhooksController, OAuthController],
  providers: [ApiKeysService, WebhooksService, OAuthService],
  exports: [ApiKeysService, WebhooksService, OAuthService],
})
export class ApiModule {}
