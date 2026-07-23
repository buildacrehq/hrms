import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { TokenService, TokenPair } from './token.service';
import { Admin } from '@prisma/client';

type SafeAdmin = Omit<Admin, 'passwordHash'>;

export interface AdminLoginResult extends TokenPair {
  admin: SafeAdmin;
}

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async changePassword(adminId: string, oldPassword: string, newPassword: string): Promise<void> {
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) throw new UnauthorizedException('Admin not found');
    const valid = await bcrypt.compare(oldPassword, admin.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.admin.update({ where: { id: adminId }, data: { passwordHash: hash } });
  }

  async login(email: string, password: string): Promise<AdminLoginResult> {
    const admin = await this.prisma.admin.findUnique({ where: { email } });

    // Constant-time comparison even when admin is not found to prevent timing attacks
    const hash = admin?.passwordHash ?? '$2b$12$invalidhashforstrictcomparison';
    const valid = await bcrypt.compare(password, hash);

    if (!admin || !valid) throw new UnauthorizedException('Invalid credentials');

    const { passwordHash: _, ...adminData } = admin;
    return { ...this.tokens.generateTokens(admin.id, 'ADMIN'), admin: adminData };
  }
}
