import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DayNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async getForMonth(employeeId: string, startDate: string, endDate: string) {
    return this.prisma.dayNote.findMany({
      where: { employeeId, date: { gte: startDate, lte: endDate } },
      select: { date: true, note: true, updatedAt: true },
    });
  }

  async upsert(employeeId: string, date: string, note: string) {
    return this.prisma.dayNote.upsert({
      where: { employeeId_date: { employeeId, date } },
      create: { employeeId, date, note },
      update: { note },
      select: { date: true, note: true, updatedAt: true },
    });
  }
}
