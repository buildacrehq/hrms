import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LeavesController } from './leaves.controller';
import { EmployeeLeavesController } from './employee-leaves.controller';
import { LeavesService } from './leaves.service';

@Module({
  imports: [AuthModule],
  controllers: [LeavesController, EmployeeLeavesController],
  providers: [LeavesService],
  exports: [LeavesService],
})
export class LeavesModule {}
