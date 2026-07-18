import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RegularizationsController } from './regularizations.controller';
import { EmployeeRegularizationsController } from './employee-regularizations.controller';
import { RegularizationsService } from './regularizations.service';

@Module({
  imports: [AuthModule],
  controllers: [RegularizationsController, EmployeeRegularizationsController],
  providers: [RegularizationsService],
})
export class RegularizationsModule {}
