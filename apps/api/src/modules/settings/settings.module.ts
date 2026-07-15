import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController, MobileSettingsController } from './settings.controller';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [SettingsController, MobileSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
