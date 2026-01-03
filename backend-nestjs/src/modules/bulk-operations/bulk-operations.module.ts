import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BulkOperationsController } from './bulk-operations.controller';
import { BulkOperationsService } from './bulk-operations.service';
import { BulkExportService } from './bulk-export.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [ConfigModule, PrismaModule, EmailModule, StorageModule],
  controllers: [BulkOperationsController],
  providers: [BulkOperationsService, BulkExportService],
  exports: [BulkOperationsService, BulkExportService],
})
export class BulkOperationsModule {}
