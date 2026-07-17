import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { SettingsService } from '../../settings/settings.service';
import { ListPunchesQueryDto } from '../dto/list-punches-query.dto';
import { Prisma } from '@prisma/client';

const PAGE_SIZE = 30;

@Injectable()
export class AdminPunchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
  ) {}

  async getPending(siteId?: string, cursor?: string) {
    const where: Prisma.PunchWhereInput = { approvalStatus: 'PENDING' };
    if (siteId) where.siteId = siteId;

    const punches = await this.prisma.punch.findMany({
      where,
      orderBy: { timestampServer: 'asc' }, // oldest first for the review queue
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        employee: { select: { id: true, name: true, phone: true } },
        site: { select: { name: true } },
      },
    });

    return {
      punches,
      nextCursor: punches.length === PAGE_SIZE ? punches[punches.length - 1].id : null,
    };
  }

  async getAll(query: ListPunchesQueryDto) {
    const where: Prisma.PunchWhereInput = {};
    const isRangeQuery = !!(query.startDate || query.endDate);

    if (query.date) {
      const d = new Date(query.date);
      where.timestampServer = {
        gte: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0),
        lte: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999),
      };
    } else if (isRangeQuery) {
      const ts: Prisma.DateTimeFilter = {};
      if (query.startDate) {
        const d = new Date(query.startDate);
        ts.gte = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      }
      if (query.endDate) {
        const d = new Date(query.endDate);
        ts.lte = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      }
      where.timestampServer = ts;
    }

    if (query.siteId)    where.siteId         = query.siteId;
    if (query.status)    where.approvalStatus  = query.status;
    if (query.punchType) where.type            = query.punchType;

    // Range queries (monthly reports) skip pagination and return all matching rows.
    const limit = isRangeQuery ? 5000 : PAGE_SIZE;

    const punches = await this.prisma.punch.findMany({
      where,
      orderBy: { timestampServer: 'desc' },
      take: limit,
      ...(!isRangeQuery && query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      include: {
        employee: { select: { id: true, name: true, phone: true } },
        site: { select: { name: true } },
      },
    });

    return {
      punches,
      nextCursor: !isRangeQuery && punches.length === PAGE_SIZE ? punches[punches.length - 1].id : null,
    };
  }

  async approve(punchId: string, adminId: string) {
    await this.assertExists(punchId);
    return this.prisma.punch.update({
      where: { id: punchId },
      data: { approvalStatus: 'APPROVED', approvedById: adminId, approvedAt: new Date() },
    });
  }

  async reject(punchId: string, adminId: string, reason: string) {
    await this.assertExists(punchId);
    return this.prisma.punch.update({
      where: { id: punchId },
      data: {
        approvalStatus: 'REJECTED',
        approvedById: adminId,
        approvedAt: new Date(),
        rejectionReason: reason,
      },
    });
  }

  /**
   * Bulk-approve "normal" PENDING punches for a given date.
   *
   * A punch is "normal" (safe to auto-approve) when ALL of:
   *  1. photoKey is present (camera didn't fail)
   *  2. GPS accuracy is within the configured threshold (0 = any accuracy accepted)
   *  3. For IN punches: timestamp is within shift_start + grace_minutes (not late)
   *  4. OUT punches: always eligible if conditions 1–2 pass
   *
   * Late IN punches and low-accuracy punches stay PENDING for individual review.
   */
  async approveAllNormal(
    date: string,
    adminId: string,
  ): Promise<{ approvedCount: number }> {
    const d = new Date(date);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

    const pending = await this.prisma.punch.findMany({
      where: {
        approvalStatus: 'PENDING',
        timestampServer: { gte: dayStart, lte: dayEnd },
      },
    });

    const [shiftStart, graceMinutes, minAccuracy] = await Promise.all([
      this.settings.get('shift_start', '10:00'),
      this.settings.getNumber('grace_minutes', 15),
      this.settings.getNumber('min_gps_accuracy', 0),
    ]);

    const lateThreshold = this.buildLateThreshold(d, shiftStart, graceMinutes);

    const normalIds = pending
      .filter((p) => {
        if (!p.photoKey) return false;
        if (minAccuracy > 0 && p.accuracy > minAccuracy) return false;
        if (p.type === 'IN' && p.timestampServer > lateThreshold) return false;
        return true;
      })
      .map((p) => p.id);

    if (normalIds.length === 0) return { approvedCount: 0 };

    await this.prisma.punch.updateMany({
      where: { id: { in: normalIds } },
      data: { approvalStatus: 'APPROVED', approvedById: adminId, approvedAt: new Date() },
    });

    return { approvedCount: normalIds.length };
  }

  async getPhotoUrl(punchId: string): Promise<{ signedUrl: string; expiresInSeconds: number }> {
    const punch = await this.prisma.punch.findUnique({
      where: { id: punchId },
      select: { photoKey: true },
    });
    if (!punch) throw new NotFoundException('Punch not found');
    if (!punch.photoKey) throw new NotFoundException('No photo recorded for this punch');

    const signedUrl = await this.storage.getSignedViewUrl(punch.photoKey);
    return { signedUrl, expiresInSeconds: 300 };
  }

  private buildLateThreshold(date: Date, shiftStart: string, graceMinutes: number): Date {
    const [hours, minutes] = shiftStart.split(':').map(Number);
    const threshold = new Date(date);
    threshold.setHours(hours, minutes + graceMinutes, 0, 0);
    return threshold;
    // Note: this comparison assumes the API server runs in the same timezone as the business (IST).
    // For multi-timezone support, store a 'timezone' setting and use a timezone-aware library.
  }

  private async assertExists(punchId: string): Promise<void> {
    const punch = await this.prisma.punch.findUnique({
      where: { id: punchId },
      select: { id: true },
    });
    if (!punch) throw new NotFoundException(`Punch ${punchId} not found`);
  }
}
