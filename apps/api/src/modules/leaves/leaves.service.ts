import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, Gender } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsService } from '../notifications/sms.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ListLeaveRequestsQueryDto } from './dto/list-leave-requests-query.dto';
import { CreateEmployeeLeaveRequestDto } from './dto/create-employee-leave-request.dto';

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

@Injectable()
export class LeavesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  // ─── Leave Types ────────────────────────────────────────────────────────────

  findAllTypes(includeInactive = false) {
    return this.prisma.leaveType.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { requests: true } } },
    });
  }

  findTypesForGender(gender: Gender | null) {
    const scopeFilter = gender === 'MALE'
      ? { scope: { in: ['ALL', 'MALE_ONLY'] as any } }
      : gender === 'FEMALE'
      ? { scope: { in: ['ALL', 'FEMALE_ONLY'] as any } }
      : { scope: { in: ['ALL'] as any } };

    return this.prisma.leaveType.findMany({
      where: { isActive: true, ...scopeFilter },
      orderBy: { name: 'asc' },
    });
  }

  async createType(dto: CreateLeaveTypeDto) {
    return this.prisma.leaveType.create({ data: { ...dto } });
  }

  async updateType(id: string, dto: UpdateLeaveTypeDto) {
    await this.assertTypeExists(id);
    return this.prisma.leaveType.update({ where: { id }, data: { ...dto } });
  }

  async deleteType(id: string) {
    await this.assertTypeExists(id);
    await this.prisma.leaveType.update({ where: { id }, data: { isActive: false } });
    return { deleted: true };
  }

  // ─── Leave Requests ─────────────────────────────────────────────────────────

  async findAllRequests(query: ListLeaveRequestsQueryDto) {
    const where: Prisma.LeaveRequestWhereInput = {};

    if (query.status)      where.status      = query.status;
    if (query.employeeId)  where.employeeId  = query.employeeId;
    if (query.leaveTypeId) where.leaveTypeId = query.leaveTypeId;

    if (query.year) {
      const y = parseInt(query.year, 10);
      const m = query.month ? parseInt(query.month, 10) - 1 : undefined;
      if (m !== undefined) {
        const start = new Date(y, m, 1);
        const end   = new Date(y, m + 1, 0, 23, 59, 59, 999);
        where.OR = [
          { fromDate: { gte: start, lte: end } },
          { toDate:   { gte: start, lte: end } },
        ];
      } else {
        where.OR = [
          { fromDate: { gte: new Date(y, 0, 1), lte: new Date(y, 11, 31, 23, 59, 59, 999) } },
          { toDate:   { gte: new Date(y, 0, 1), lte: new Date(y, 11, 31, 23, 59, 59, 999) } },
        ];
      }
    }

    return this.prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { id: true, name: true, phone: true } },
        leaveType: { select: { id: true, name: true, paid: true } },
      },
    });
  }

  async createRequest(dto: CreateLeaveRequestDto, adminId: string) {
    const from = new Date(dto.fromDate);
    const to   = new Date(dto.toDate);
    if (from > to) throw new BadRequestException('fromDate must be before toDate');

    return this.prisma.leaveRequest.create({
      data: {
        employeeId:  dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        fromDate:    from,
        toDate:      to,
        reason:      dto.reason,
        status:      'APPROVED',
        approvedById: adminId,
        approvedAt:   new Date(),
      },
      include: {
        employee:  { select: { id: true, name: true } },
        leaveType: { select: { id: true, name: true } },
      },
    });
  }

  async approveRequest(id: string, adminId: string) {
    const req = await this.assertRequestExists(id);
    if (req.status !== 'PENDING') {
      throw new BadRequestException(`Leave request is already ${req.status}`);
    }
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: adminId, approvedAt: new Date() },
      include: {
        employee:  { select: { id: true, name: true, phone: true } },
        leaveType: { select: { id: true, name: true } },
      },
    });
    await this.deductBalance(updated.employeeId, updated.leaveTypeId, updated.fromDate, updated.toDate);
    this.sms.send(
      updated.employee.phone,
      `Hi ${updated.employee.name.split(' ')[0]}, your ${updated.leaveType.name} leave from ${fmtDate(updated.fromDate)} to ${fmtDate(updated.toDate)} has been APPROVED. — BA HRMS`,
    );
    return updated;
  }

  async rejectRequest(id: string, adminId: string, reason: string) {
    const req = await this.assertRequestExists(id);
    if (req.status !== 'PENDING') {
      throw new BadRequestException(`Leave request is already ${req.status}`);
    }
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedById: adminId,
        approvedAt: new Date(),
        rejectionReason: reason,
      },
      include: {
        employee:  { select: { id: true, name: true, phone: true } },
        leaveType: { select: { id: true, name: true } },
      },
    });
    this.sms.send(
      updated.employee.phone,
      `Hi ${updated.employee.name.split(' ')[0]}, your ${updated.leaveType.name} leave request (${fmtDate(updated.fromDate)} – ${fmtDate(updated.toDate)}) has been REJECTED. Reason: ${reason} — BA HRMS`,
    );
    return updated;
  }

  // ─── Employee self-service ──────────────────────────────────────────────────

  findMyRequests(employeeId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      include: {
        leaveType: { select: { id: true, name: true, paid: true } },
      },
    });
  }

  async submitRequest(dto: CreateEmployeeLeaveRequestDto, employeeId: string) {
    const from = new Date(dto.fromDate);
    const to   = new Date(dto.toDate);
    if (from > to) throw new BadRequestException('fromDate must be before toDate');

    const leaveType = await this.prisma.leaveType.findUnique({ where: { id: dto.leaveTypeId } });
    if (!leaveType || !leaveType.isActive) throw new NotFoundException('Leave type not found or inactive');

    if (leaveType.maxConsecutiveDays) {
      const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
      if (days > leaveType.maxConsecutiveDays) {
        throw new BadRequestException(`Cannot exceed ${leaveType.maxConsecutiveDays} consecutive days for ${leaveType.name}`);
      }
    }

    const status = leaveType.approvalMode === 'AUTO' ? 'APPROVED' : 'PENDING';

    const created = await this.prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        fromDate: from,
        toDate: to,
        reason: dto.reason,
        status,
        ...(status === 'APPROVED' ? { approvedAt: new Date() } : {}),
      },
      include: {
        employee:  { select: { name: true, phone: true } },
        leaveType: { select: { id: true, name: true, paid: true } },
      },
    });

    if (status === 'APPROVED') {
      await this.deductBalance(created.employeeId, created.leaveTypeId, from, to);
    }
    const msg = status === 'APPROVED'
      ? `Hi ${created.employee.name.split(' ')[0]}, your ${created.leaveType.name} leave (${fmtDate(from)} – ${fmtDate(to)}) has been automatically approved. — BA HRMS`
      : `Hi ${created.employee.name.split(' ')[0]}, your ${created.leaveType.name} leave request (${fmtDate(from)} – ${fmtDate(to)}) has been submitted and is pending approval. — BA HRMS`;
    this.sms.send(created.employee.phone, msg);

    return created;
  }

  async cancelRequest(id: string, employeeId: string) {
    const req = await this.prisma.leaveRequest.findUnique({
      where: { id },
      select: { id: true, status: true, employeeId: true, leaveTypeId: true, fromDate: true, toDate: true },
    });
    if (!req) throw new NotFoundException('Leave request not found');
    if (req.employeeId !== employeeId) throw new BadRequestException('Not your leave request');
    if (!['PENDING', 'APPROVED'].includes(req.status)) throw new BadRequestException('Only pending or approved requests can be cancelled');
    if (req.status === 'APPROVED' && req.fromDate <= new Date()) throw new BadRequestException('Cannot cancel a leave that has already started');
    await this.restoreBalance(req.employeeId, req.leaveTypeId, req.fromDate, req.toDate, req.status === 'APPROVED');
    await this.prisma.leaveRequest.delete({ where: { id } });
    return { cancelled: true };
  }

  // ─── Leave Balance ──────────────────────────────────────────────────────────

  private currentYear() { return new Date().getFullYear(); }

  private async upsertBalance(employeeId: string, leaveTypeId: string, year: number, creditDelta: number, usedDelta: number) {
    const existing = await this.prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
    });
    if (existing) {
      return this.prisma.leaveBalance.update({
        where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
        data: { credited: { increment: creditDelta }, used: { increment: usedDelta } },
      });
    }
    return this.prisma.leaveBalance.create({
      data: { employeeId, leaveTypeId, year, credited: Math.max(0, creditDelta), used: Math.max(0, usedDelta) },
    });
  }

  async getBalances(employeeId: string, year?: number) {
    const y = year ?? this.currentYear();
    const balances = await this.prisma.leaveBalance.findMany({
      where: { employeeId, year: y },
      include: { leaveType: { select: { id: true, name: true, paid: true, scope: true } } },
      orderBy: { leaveType: { name: 'asc' } },
    });
    return balances.map(b => ({
      ...b,
      available: Math.max(0, b.credited - b.used),
    }));
  }

  async getAllBalances(year?: number, employeeId?: string) {
    const y = year ?? this.currentYear();
    const where: any = { year: y };
    if (employeeId) where.employeeId = employeeId;
    const balances = await this.prisma.leaveBalance.findMany({
      where,
      include: {
        employee:  { select: { id: true, name: true, phone: true } },
        leaveType: { select: { id: true, name: true, paid: true } },
      },
      orderBy: [{ employee: { name: 'asc' } }, { leaveType: { name: 'asc' } }],
    });
    return balances.map(b => ({ ...b, available: Math.max(0, b.credited - b.used) }));
  }

  async adjustBalance(employeeId: string, leaveTypeId: string, credit: number) {
    const year = this.currentYear();
    const result = await this.upsertBalance(employeeId, leaveTypeId, year, credit, 0);
    return { ...result, available: Math.max(0, result.credited - result.used) };
  }

  // Called by monthly accrual cron — credits daysEntitled/12 for MONTHLY types
  async accrueMonthlyBalances() {
    const types = await this.prisma.leaveType.findMany({
      where: { isActive: true, accrual: 'MONTHLY' },
    });
    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, createdAt: true },
    });
    const year = this.currentYear();

    for (const lt of types) {
      const monthlyCredit = lt.daysEntitled / 12;
      for (const emp of employees) {
        const monthsEmployed = (Date.now() - emp.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
        if (monthsEmployed < lt.eligibilityMinMonths) continue;
        await this.upsertBalance(emp.id, lt.id, year, monthlyCredit, 0);
      }
    }
  }

  // Hook: deduct balance when a leave is approved
  private async deductBalance(employeeId: string, leaveTypeId: string, fromDate: Date, toDate: Date) {
    const days = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
    await this.upsertBalance(employeeId, leaveTypeId, fromDate.getFullYear(), 0, days);
  }

  // Hook: restore balance when a pending leave is cancelled
  private async restoreBalance(employeeId: string, leaveTypeId: string, fromDate: Date, toDate: Date, wasApproved: boolean) {
    if (!wasApproved) return;
    const days = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
    await this.upsertBalance(employeeId, leaveTypeId, fromDate.getFullYear(), 0, -days);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async assertTypeExists(id: string) {
    const t = await this.prisma.leaveType.findUnique({ where: { id }, select: { id: true } });
    if (!t) throw new NotFoundException(`Leave type ${id} not found`);
    return t;
  }

  private async assertRequestExists(id: string) {
    const r = await this.prisma.leaveRequest.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!r) throw new NotFoundException(`Leave request ${id} not found`);
    return r;
  }
}
