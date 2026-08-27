import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { InvoiceService } from './services/invoice.service';
import { InvoicesController } from './invoices.controller';
import { InvoicePublicController } from './invoice-public.controller';

@Module({
  imports: [PrismaModule, forwardRef(() => EmailModule)],
  controllers: [InvoicesController, InvoicePublicController],
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoicesModule {}
