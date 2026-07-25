import { Injectable, Logger } from '@nestjs/common';
import { LeavesService } from './leaves.service';

@Injectable()
export class LeaveAccrualService {
  private readonly logger = new Logger(LeaveAccrualService.name);

  constructor(private readonly leavesService: LeavesService) {}

  async runMonthlyAccrual(): Promise<void> {
    this.logger.log('Running monthly leave accrual…');
    await this.leavesService.accrueMonthlyBalances();
    this.logger.log('Monthly leave accrual complete.');
  }
}
