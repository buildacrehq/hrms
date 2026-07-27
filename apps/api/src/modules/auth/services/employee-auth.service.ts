import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { TokenService, TokenPair } from './token.service';
import { Employee } from '@prisma/client';
import { DeviceInfo } from '../../../common/utils/device.util';

export interface EmployeeLoginResult extends TokenPair {
  employee: Omit<Employee, 'passwordHash'>;
}

@Injectable()
export class EmployeeAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async login(phone: string, password: string, device?: DeviceInfo): Promise<EmployeeLoginResult> {
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

    if (device) {
      const browser = device.deviceBrowser ?? '';
      const os = device.deviceOs ?? '';
      await this.prisma.deviceSession.upsert({
        where: { employeeId_deviceBrowser_deviceOs: { employeeId: employee.id, deviceBrowser: browser, deviceOs: os } },
        update: { ipAddress: device.ipAddress, lastSeenAt: new Date() },
        create: { employeeId: employee.id, deviceBrowser: browser, deviceOs: os, ipAddress: device.ipAddress },
      });
    }

    const { passwordHash: _, ...safeEmployee } = employee;

    return {
      ...this.tokens.generateTokens(employee.id, employee.role),
      employee: safeEmployee,
    };
  }

  async changePassword(employeeId: string, oldPassword: string, newPassword: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    if (!employee.passwordHash) throw new BadRequestException('No password set — ask admin to set your initial password');

    const valid = await bcrypt.compare(oldPassword, employee.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    if (newPassword.length < 6) throw new BadRequestException('New password must be at least 6 characters');

    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.employee.update({ where: { id: employeeId }, data: { passwordHash: hash } });
  }
}
