import { Controller, Get, Headers, ForbiddenException, Logger } from '@nestjs/common';
import { LeaveAccrualService } from '../leaves/leave-accrual.service';
import { PhotoRetentionService } from '../punches/services/photo-retention.service';

@Controller('internal')
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(
    private readonly leaveAccrual: LeaveAccrualService,
    private readonly photoRetention: PhotoRetentionService,
  ) {}

  private checkSecret(auth: string) {
    const secret = process.env.CRON_SECRET;
    if (!secret || auth !== `Bearer ${secret}`) throw new ForbiddenException();
  }

  @Get('accrue-leaves')
  async accrueLeaves(@Headers('authorization') auth: string) {
    this.checkSecret(auth);
    this.logger.log('Cron: accrue-leaves triggered');
    await this.leaveAccrual.runMonthlyAccrual();
    return { done: true };
  }

  @Get('cleanup-photos')
  async cleanupPhotos(@Headers('authorization') auth: string) {
    this.checkSecret(auth);
    this.logger.log('Cron: cleanup-photos triggered');
    await this.photoRetention.runRetentionCleanup();
    return { done: true };
  }
}
