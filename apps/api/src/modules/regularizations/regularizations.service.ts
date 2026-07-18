import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRegularizationDto } from './dto/create-regularization.dto';

@Injectable()
export class RegularizationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Employee ───────────────────────────────────────────────────────────────

  async submit(dto: CreateRegularizationDto, employeeId: string) {
    const date = new Date(dto.date);
    if (isNaN(date.getTime())) throw new BadRequestException('Invalid date');
    if (date > new Date())     throw new BadRequestException('Cannot regularize a future date');

    // Guard duplicate pending/approved request for same date
    const existing = await this.prisma.regularization.findFirst({
      where: { employeeId, date, status: { in: ['PENDING', 'APPROVED'] } },
    });
    if (existing) throw new BadRequestException('A regularization request already exists for this date');

    // Validate time fields based on requestType
    if ((dto.requestType === 'PUNCH_IN' || dto.requestType === 'BOTH') && !dto.punchInTime) {
      throw new BadRequestException('punchInTime is required for this request type');
    }
    if ((dto.requestType === 'PUNCH_OUT' || dto.requestType === 'BOTH') && !dto.punchOutTime) {
      throw new BadRequestException('punchOutTime is required for this request type');
    }

    return this.prisma.regularization.create({
      data: {
        employeeId,
        date,
        requestType: dto.requestType,
        punchInTime:  dto.punchInTime,
        punchOutTime: dto.punchOutTime,
        reason: dto.reason,
      },
      include: { employee: { select: { id: true, name: true } } },
    });
  }

  findMyRequests(employeeId: string) {
    return this.prisma.regularization.findMany({
      where: { employeeId },
      orderBy: { date: 'desc' },
    });
  }

  async cancel(id: string, employeeId: string) {
    const reg = await this.prisma.regularization.findUnique({ where: { id }, select: { id: true, status: true, employeeId: true } });
    if (!reg) throw new NotFoundException('Request not found');
    if (reg.employeeId !== employeeId) throw new BadRequestException('Not your request');
    if (reg.status !== 'PENDING') throw new BadRequestException('Only pending requests can be cancelled');
    await this.prisma.regularization.delete({ where: { id } });
    return { cancelled: true };
  }

  // ─── Admin ──────────────────────────────────────────────────────────────────

  findAll(status?: string, employeeId?: string) {
    const where: any = {};
    if (status)     where.status     = status;
    if (employeeId) where.employeeId = employeeId;
    return this.prisma.regularization.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { id: true, name: true, phone: true, defaultSite: { select: { name: true } } } },
      },
    });
  }

  async approve(id: string, adminId: string) {
    const reg = await this.prisma.regularization.findUnique({
      where: { id },
      include: { employee: { select: { id: true, defaultSiteId: true } } },
    });
    if (!reg) throw new NotFoundException('Request not found');
    if (reg.status !== 'PENDING') throw new BadRequestException(`Request is already ${reg.status}`);

    const siteId = reg.employee.defaultSiteId;
    if (!siteId) throw new BadRequestException('Employee has no default site — cannot create punch records');

    // Build the punch records to create
    const punches: any[] = [];

    const buildPunchTime = (dateStr: Date, timeStr: string) => {
      const d = new Date(dateStr);
      const [h, m] = timeStr.split(':').map(Number);
      d.setHours(h, m, 0, 0);
      return d;
    };

    if (reg.requestType === 'PUNCH_IN' || reg.requestType === 'BOTH') {
      if (!reg.punchInTime) throw new BadRequestException('Missing punchInTime on request');
      punches.push({
        employeeId: reg.employeeId,
        siteId,
        type: 'IN',
        timestampServer: buildPunchTime(reg.date, reg.punchInTime),
        timestampDevice: buildPunchTime(reg.date, reg.punchInTime),
        lat: 0, long: 0, accuracy: 0,
        address: 'Regularized',
        photoKey: '',
        approvalStatus: 'APPROVED',
        approvedById: adminId,
        approvedAt: new Date(),
      });
    }

    if (reg.requestType === 'PUNCH_OUT' || reg.requestType === 'BOTH') {
      if (!reg.punchOutTime) throw new BadRequestException('Missing punchOutTime on request');
      punches.push({
        employeeId: reg.employeeId,
        siteId,
        type: 'OUT',
        timestampServer: buildPunchTime(reg.date, reg.punchOutTime),
        timestampDevice: buildPunchTime(reg.date, reg.punchOutTime),
        lat: 0, long: 0, accuracy: 0,
        address: 'Regularized',
        photoKey: '',
        approvalStatus: 'APPROVED',
        approvedById: adminId,
        approvedAt: new Date(),
      });
    }

    await this.prisma.$transaction([
      ...punches.map(p => this.prisma.punch.create({ data: p })),
      this.prisma.regularization.update({
        where: { id },
        data: { status: 'APPROVED', approvedById: adminId, approvedAt: new Date() },
      }),
    ]);

    return { approved: true, punchesCreated: punches.length };
  }

  async reject(id: string, adminId: string, reason: string) {
    const reg = await this.prisma.regularization.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!reg) throw new NotFoundException('Request not found');
    if (reg.status !== 'PENDING') throw new BadRequestException(`Request is already ${reg.status}`);
    return this.prisma.regularization.update({
      where: { id },
      data: { status: 'REJECTED', approvedById: adminId, approvedAt: new Date(), rejectionReason: reason },
      include: { employee: { select: { id: true, name: true } } },
    });
  }
}
