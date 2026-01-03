import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { VideoProposalsController } from './video-proposals.controller';
import { VideoProposalsService } from './video-proposals.service';
import { VideoAnalyticsService } from './video-analytics.service';
import { LoomService } from './providers/loom.service';
import { VidyardService } from './providers/vidyard.service';
import { ScreenRecordingService } from './screen-recording.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 60000,
      maxRedirects: 5,
    }),
    ConfigModule,
    PrismaModule,
    StorageModule,
  ],
  controllers: [VideoProposalsController],
  providers: [
    VideoProposalsService,
    VideoAnalyticsService,
    LoomService,
    VidyardService,
    ScreenRecordingService,
  ],
  exports: [VideoProposalsService, VideoAnalyticsService],
})
export class VideoProposalsModule {}
