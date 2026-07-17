import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';

const PAGE_SIZE = 30;

const WITH_SITE = {
  defaultSite: { select: { id: true, name: true } },
} as const;

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListEmployeesQueryDto) {
    const where: Prisma.EmployeeWhereInput = {
      status: query.status ?? 'ACTIVE',
    };
    if (query.siteId) where.defaultSiteId = query.siteId;
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const employees = await this.prisma.employee.findMany({
      where,
      orderBy: { name: 'asc' },
      take: PAGE_SIZE,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      include: WITH_SITE,
    });

    return {
      employees,
      nextCursor: employees.length === PAGE_SIZE ? employees[employees.length - 1].id : null,
    };
  }

  async findOne(id: string) {
    const emp = await this.prisma.employee.findUnique({
      where: { id },
      include: WITH_SITE,
    });
    if (!emp) throw new NotFoundException(`Employee ${id} not found`);
    return emp;
  }

  async findMe(employeeId: string) {
    return this.findOne(employeeId);
  }

  async create(dto: CreateEmployeeDto) {
    await this.assertPhoneAvailable(dto.phone);
    if (dto.defaultSiteId) await this.assertSiteExists(dto.defaultSiteId);

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;

    return this.prisma.employee.create({
      data: {
        name: dto.name,
        gender: dto.gender,
        phone: dto.phone,
        role: dto.role ?? 'EMPLOYEE',
        defaultSiteId: dto.defaultSiteId ?? null,
        ...(passwordHash ? { passwordHash } : {}),
      },
      include: WITH_SITE,
    });
  }

  async setPassword(id: string, password: string) {
    await this.assertExists(id);
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.employee.update({
      where: { id },
      data: { passwordHash },
      select: { id: true, name: true, phone: true },
    });
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.assertExists(id);
    if (dto.phone) await this.assertPhoneAvailable(dto.phone, id);
    if (dto.defaultSiteId) await this.assertSiteExists(dto.defaultSiteId);

    return this.prisma.employee.update({
      where: { id },
      data: dto,
      include: WITH_SITE,
    });
  }

  async deactivate(id: string) {
    await this.assertExists(id);
    return this.prisma.employee.update({
      where: { id },
      data: { status: 'DEACTIVATED', exitedAt: new Date() },
      include: WITH_SITE,
    });
  }

  async activate(id: string) {
    await this.assertExists(id);
    return this.prisma.employee.update({
      where: { id },
      data: { status: 'ACTIVE', exitedAt: null },
      include: WITH_SITE,
    });
  }

  private async assertExists(id: string): Promise<void> {
    const emp = await this.prisma.employee.findUnique({ where: { id }, select: { id: true } });
    if (!emp) throw new NotFoundException(`Employee ${id} not found`);
  }

  private async assertPhoneAvailable(phone: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.employee.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Phone ${phone} is already registered`);
    }
  }

  private async assertSiteExists(siteId: string): Promise<void> {
    const site = await this.prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
    if (!site) throw new NotFoundException(`Site ${siteId} not found`);
  }
}
