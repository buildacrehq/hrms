import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminEmployeesController } from './controllers/admin-employees.controller';
import { EmployeeProfileController } from './controllers/employee-profile.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminEmployeesController, EmployeeProfileController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
