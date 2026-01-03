import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
