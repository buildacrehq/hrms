import { Global, Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { PunchReminderService } from './punch-reminder.service';

@Global()
@Module({
  providers: [SmsService, PunchReminderService],
  exports: [SmsService],
})
export class NotificationsModule {}
