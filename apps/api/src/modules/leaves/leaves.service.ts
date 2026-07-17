import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ListLeaveRequestsQueryDto } from './dto/list-leave-requests-query.dto';

@Injectable()
export class LeavesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Leave Types ────────────────────────────────────────────────────────────

  findAllTypes(includeInactive = false) {
    return this.prisma.leaveType.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { requests: true } } },
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
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: adminId, approvedAt: new Date() },
      include: {
        employee:  { select: { id: true, name: true } },
        leaveType: { select: { id: true, name: true } },
      },
    });
  }

  async rejectRequest(id: string, adminId: string, reason: string) {
    const req = await this.assertRequestExists(id);
    if (req.status !== 'PENDING') {
      throw new BadRequestException(`Leave request is already ${req.status}`);
    }
    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedById: adminId,
        approvedAt: new Date(),
        rejectionReason: reason,
      },
      include: {
        employee:  { select: { id: true, name: true } },
        leaveType: { select: { id: true, name: true } },
      },
    });
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
