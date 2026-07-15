import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { TokenService, TokenPair } from './token.service';
import { Employee } from '@prisma/client';

export interface EmployeeLoginResult extends TokenPair {
  employee: Omit<Employee, 'passwordHash'>;
}

@Injectable()
export class EmployeeAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async login(phone: string, password: string): Promise<EmployeeLoginResult> {
    const employee = await this.prisma.employee.findUnique({ where: { phone } });

    if (!employee || employee.status === 'DEACTIVATED') {
      throw new NotFoundException('Phone number not registered. Contact your Admin.');
    }

    if (!employee.passwordHash) {
      throw new UnauthorizedException('Password not set. Ask your Admin to set your password.');
    }

    const valid = await bcrypt.compare(password, employee.passwordHash);
    if (!valid) throw new UnauthorizedException('Incorrect password.');

    if (!employee.consentAt) {
      await this.prisma.employee.update({
        where: { id: employee.id },
        data: { consentAt: new Date() },
      });
    }

    const { passwordHash: _, ...safeEmployee } = employee;

    return {
      ...this.tokens.generateTokens(employee.id, employee.role),
      employee: safeEmployee,
    };
  }
}
