import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.site.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true } } },
    });
  }

  async findOne(id: string) {
    const site = await this.prisma.site.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });
    if (!site) throw new NotFoundException(`Site ${id} not found`);
    return site;
  }

  create(dto: CreateSiteDto) {
    return this.prisma.site.create({ data: dto });
  }

  async update(id: string, dto: UpdateSiteDto) {
    await this.assertExists(id);
    return this.prisma.site.update({ where: { id }, data: dto });
  }

  async deactivate(id: string) {
    await this.assertExists(id);
    return this.prisma.site.update({ where: { id }, data: { status: 'INACTIVE' } });
  }

  private async assertExists(id: string): Promise<void> {
    const s = await this.prisma.site.findUnique({ where: { id }, select: { id: true } });
    if (!s) throw new NotFoundException(`Site ${id} not found`);
  }
}
