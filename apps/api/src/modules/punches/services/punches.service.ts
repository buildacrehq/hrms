import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { SettingsService } from '../../settings/settings.service';
import { CreatePunchDto } from '../dto/create-punch.dto';
import { PunchType } from '@prisma/client';

const PAGE_SIZE = 30;

@Injectable()
export class PunchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
  ) {}

  async getUploadUrl(
    employeeId: string,
    type: PunchType,
  ): Promise<{ uploadUrl: string; uploadToken: string; photoKey: string }> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const photoKey = `punches/${year}/${month}/${employeeId}/${type.toLowerCase()}-${randomUUID()}.jpg`;
    const { uploadUrl, uploadToken } = await this.storage.getPresignedUploadUrl(photoKey);
    return { uploadUrl, uploadToken, photoKey };
  }

  async create(employeeId: string, dto: CreatePunchDto) {
    const siteId = await this.getDefaultSite(employeeId);

    const requirePhoto = await this.settings.getBoolean('require_photo', true);
    const allowOnFail = await this.settings.getBoolean('allow_punch_on_camera_fail', true);

    if (requirePhoto && !dto.photoKey) {
      if (!allowOnFail) {
        throw new BadRequestException(
          'Photo is required. Enable "allow punch on camera fail" in Settings to allow unverified punches.',
        );
      }
      // photoKey is empty — punch is created but flagged (approvalStatus stays PENDING with no photo)
    }

    return this.prisma.punch.create({
      data: {
        employeeId,
        siteId,
        type: dto.type,
        timestampDevice: new Date(dto.timestampDevice),
        lat: dto.lat,
        long: dto.long,
        accuracy: dto.accuracy,
        address: dto.address ?? '',
        photoKey: dto.photoKey ?? '',
        syncedOffline: dto.syncedOffline ?? false,
      },
      include: {
        site: { select: { name: true } },
        employee: { select: { name: true } },
      },
    });
  }

  async getLastPunch(employeeId: string) {
    const punch = await this.prisma.punch.findFirst({
      where: { employeeId },
      orderBy: { timestampServer: 'desc' },
      select: { id: true, type: true, timestampServer: true },
    });
    return punch ?? null;
  }

  async getMyPunches(employeeId: string, month?: string, cursor?: string) {
    const where: Record<string, unknown> = { employeeId };

    if (month) {
      const [year, m] = month.split('-').map(Number);
      where.timestampServer = {
        gte: new Date(year, m - 1, 1),
        lte: new Date(year, m, 0, 23, 59, 59, 999),
      };
    }

    const punches = await this.prisma.punch.findMany({
      where,
      orderBy: { timestampServer: 'desc' },
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: { site: { select: { name: true } } },
    });

    return {
      punches,
      nextCursor: punches.length === PAGE_SIZE ? punches[punches.length - 1].id : null,
    };
  }

  private async guardNoDuplicateIn(employeeId: string): Promise<void> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const existing = await this.prisma.punch.findFirst({
      where: {
        employeeId,
        type: 'IN',
        approvalStatus: { in: ['PENDING', 'APPROVED'] },
        timestampServer: { gte: todayStart, lte: todayEnd },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'You already have a punch-in recorded for today. Please punch out first.',
      );
    }
  }

  private async getDefaultSite(employeeId: string): Promise<string> {
    const emp = await this.prisma.employee.findUniqueOrThrow({
      where: { id: employeeId },
      select: { defaultSiteId: true },
    });
    if (!emp.defaultSiteId) {
      throw new BadRequestException('No site assigned to your account. Contact your Admin.');
    }
    return emp.defaultSiteId;
  }
}
