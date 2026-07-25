import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';
import { SettingsModule } from './modules/settings/settings.module';
import { AuthModule } from './modules/auth/auth.module';
import { PunchesModule } from './modules/punches/punches.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { SitesModule } from './modules/sites/sites.module';
import { HolidaysModule } from './modules/holidays/holidays.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RegularizationsModule } from './modules/regularizations/regularizations.module';
import { InternalModule } from './modules/internal/internal.module';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    SettingsModule,
    AuthModule,
    PunchesModule,
    EmployeesModule,
    SitesModule,
    HolidaysModule,
    LeavesModule,
    NotificationsModule,
    RegularizationsModule,
    InternalModule,
  ],
})
export class AppModule {}
