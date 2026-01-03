import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { StorageModule } from '../storage/storage.module';
import { ContractManagementService } from './services/contract-management.service';
import { ContractsController } from './contracts.controller';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => EmailModule),
    forwardRef(() => StorageModule),
  ],
  controllers: [ContractsController],
  providers: [ContractManagementService],
  exports: [ContractManagementService],
})
export class ContractsModule {}
