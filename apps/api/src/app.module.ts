import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AuthModule } from './modules/auth/auth.module';
import { PunchesModule } from './modules/punches/punches.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { SitesModule } from './modules/sites/sites.module';
import { HolidaysModule } from './modules/holidays/holidays.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    PrismaModule,
    SettingsModule,
    AuthModule,
    PunchesModule,
    EmployeesModule,
    SitesModule,
    HolidaysModule,
  ],
})
export class AppModule {}
