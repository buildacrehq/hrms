import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { PunchesController } from './controllers/punches.controller';
import { AdminPunchesController } from './controllers/admin-punches.controller';
import { PunchesService } from './services/punches.service';
import { AdminPunchesService } from './services/admin-punches.service';
import { PhotoRetentionService } from './services/photo-retention.service';

// SettingsService is injected directly from the global SettingsModule (no import needed here).

@Module({
  imports: [StorageModule, AuthModule],
  controllers: [PunchesController, AdminPunchesController],
  providers: [PunchesService, AdminPunchesService, PhotoRetentionService],
})
export class PunchesModule {}
