import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ApiMarketplaceService } from './services/api-marketplace.service';
import { ApiMarketplaceController } from './api-marketplace.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ApiMarketplaceController],
  providers: [ApiMarketplaceService],
  exports: [ApiMarketplaceService],
})
export class ApiMarketplaceModule {}
