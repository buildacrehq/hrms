import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { ListHolidaysQueryDto } from './dto/list-holidays-query.dto';

@Injectable()
export class HolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListHolidaysQueryDto) {
    const where: Prisma.HolidayWhereInput = {};

    if (query.year) {
      const y = parseInt(query.year, 10);
      where.date = { gte: new Date(y, 0, 1), lte: new Date(y, 11, 31, 23, 59, 59) };
    }

    if (query.siteId !== undefined) {
      // explicit siteId: return holidays for that site only
      where.siteId = query.siteId;
    }

    return this.prisma.holiday.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }

  async create(dto: CreateHolidayDto) {
    const date = new Date(dto.date);
    const siteId = dto.siteId ?? null;

    // Guard: prevent duplicate (same date + same site scope)
    const existing = await this.prisma.holiday.findFirst({
      where: {
        date: { gte: new Date(date.setHours(0, 0, 0, 0)), lte: new Date(date.setHours(23, 59, 59, 999)) },
        siteId,
      },
    });
    if (existing) {
      throw new ConflictException(
        `A holiday already exists on ${dto.date}${siteId ? ` for site ${siteId}` : ' (company-wide)'}`,
      );
    }

    return this.prisma.holiday.create({
      data: { date: new Date(dto.date), name: dto.name, siteId },
    });
  }

  async remove(id: string) {
    const holiday = await this.prisma.holiday.findUnique({ where: { id }, select: { id: true } });
    if (!holiday) throw new NotFoundException(`Holiday ${id} not found`);
    await this.prisma.holiday.delete({ where: { id } });
    return { deleted: true };
  }
}
