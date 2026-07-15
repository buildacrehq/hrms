import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Thin wrapper around the Setting table with a warmed in-memory cache.
 * Cache is invalidated whenever a write happens, so reads are always fresh
 * after a settings change without hitting Postgres on every request.
 */
@Injectable()
export class SettingsService implements OnModuleInit {
  private cache = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.warmCache();
  }

  async get(key: string, fallback = ''): Promise<string> {
    if (this.cache.has(key)) return this.cache.get(key)!;
    const row = await this.prisma.setting.findUnique({ where: { key } });
    const value = row?.value ?? fallback;
    if (row) this.cache.set(key, value);
    return value;
  }

  async getNumber(key: string, fallback = 0): Promise<number> {
    const v = await this.get(key, String(fallback));
    return Number(v) || fallback;
  }

  async getBoolean(key: string, fallback = false): Promise<boolean> {
    const v = await this.get(key, String(fallback));
    return v === 'true';
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    this.cache.set(key, value);
  }

  async setMany(pairs: { key: string; value: string }[]): Promise<void> {
    await this.prisma.$transaction(
      pairs.map((p) =>
        this.prisma.setting.upsert({
          where: { key: p.key },
          update: { value: p.value },
          create: p,
        }),
      ),
    );
    pairs.forEach((p) => this.cache.set(p.key, p.value));
  }

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany();
    const result: Record<string, string> = {};
    rows.forEach((r) => {
      this.cache.set(r.key, r.value);
      result[r.key] = r.value;
    });
    return result;
  }

  private async warmCache(): Promise<void> {
    const rows = await this.prisma.setting.findMany();
    rows.forEach((r) => this.cache.set(r.key, r.value));
  }
}
