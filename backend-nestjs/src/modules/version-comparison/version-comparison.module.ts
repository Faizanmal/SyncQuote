import { Module } from '@nestjs/common';
import { VersionComparisonService } from './version-comparison.service';
import { VersionComparisonController } from './version-comparison.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VersionComparisonController],
  providers: [VersionComparisonService],
  exports: [VersionComparisonService],
})
export class VersionComparisonModule {}
