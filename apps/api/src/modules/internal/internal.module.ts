import { Module } from '@nestjs/common';
import { LeavesModule } from '../leaves/leaves.module';
import { PunchesModule } from '../punches/punches.module';
import { InternalController } from './internal.controller';

@Module({
  imports: [LeavesModule, PunchesModule],
  controllers: [InternalController],
})
export class InternalModule {}
