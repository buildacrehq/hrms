import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LeavesController } from './leaves.controller';
import { EmployeeLeavesController } from './employee-leaves.controller';
import { LeavesService } from './leaves.service';
import { LeaveAccrualService } from './leave-accrual.service';

@Module({
  imports: [AuthModule],
  controllers: [LeavesController, EmployeeLeavesController],
  providers: [LeavesService, LeaveAccrualService],
  exports: [LeavesService],
})
export class LeavesModule {}
