import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LeavesService } from './leaves.service';

@Injectable()
export class LeaveAccrualService {
  private readonly logger = new Logger(LeaveAccrualService.name);

  constructor(private readonly leavesService: LeavesService) {}

  // Runs at 00:05 on the 1st of every month
  @Cron('5 0 1 * *')
  async runMonthlyAccrual(): Promise<void> {
    this.logger.log('Running monthly leave accrual…');
    await this.leavesService.accrueMonthlyBalances();
    this.logger.log('Monthly leave accrual complete.');
  }
}
