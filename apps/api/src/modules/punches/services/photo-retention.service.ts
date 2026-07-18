import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class PhotoRetentionService {
  private readonly logger = new Logger(PhotoRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
  ) {}

  /** Runs daily at 03:00 — deletes punch photos older than the configured retention period. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runRetentionCleanup(): Promise<void> {
    const retentionDays = await this.settings.getNumber('photo_retention_days', 90);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const stale = await this.prisma.punch.findMany({
      where: {
        photoKey: { not: '' },
        timestampServer: { lt: cutoff },
      },
      select: { id: true, photoKey: true },
      take: 500, // process in batches to avoid memory spikes
    });

    if (stale.length === 0) {
      this.logger.log('Photo retention: no stale photos found.');
      return;
    }

    this.logger.log(`Photo retention: deleting ${stale.length} photo(s) older than ${retentionDays} days…`);

    let deleted = 0;
    let failed  = 0;

    for (const punch of stale) {
      try {
        await this.storage.deleteObject(punch.photoKey);
        await this.prisma.punch.update({
          where: { id: punch.id },
          data: { photoKey: '' },
        });
        deleted++;
      } catch (err) {
        this.logger.error(`Failed to delete photo for punch ${punch.id}: ${err}`);
        failed++;
      }
    }

    this.logger.log(`Photo retention done: ${deleted} deleted, ${failed} failed.`);
  }
}
