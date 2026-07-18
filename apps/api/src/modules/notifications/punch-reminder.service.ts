import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { SmsService } from './sms.service';

@Injectable()
export class PunchReminderService {
  private readonly logger = new Logger(PunchReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly sms: SmsService,
  ) {}

  // Runs every hour — fires when now is within 15 min before shift_start and reminder is enabled
  @Cron('0 * * * *')
  async maybeSendPunchInReminder(): Promise<void> {
    const enabled = await this.settings.get('punchin_reminder_enabled', 'false');
    if (enabled !== 'true') return;

    const shiftStart = await this.settings.get('shift_start', '10:00');
    const [hStr, mStr] = shiftStart.split(':');
    const shiftTotal = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);

    const now = new Date();
    const nowTotal = now.getHours() * 60 + now.getMinutes();

    // Only fire in the window [shiftStart-15, shiftStart)
    if (nowTotal < shiftTotal - 15 || nowTotal >= shiftTotal) return;

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const employees = await this.prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        punches: { none: { timestampServer: { gte: todayStart, lte: todayEnd } } },
      },
      select: { name: true, phone: true },
    });

    this.logger.log(`Punch-in reminder: ${employees.length} employees not yet punched in`);
    for (const emp of employees) {
      await this.sms.send(
        emp.phone,
        `Hi ${emp.name.split(' ')[0]}, your shift starts at ${shiftStart}. Please don't forget to punch in. — BA HRMS`,
      );
    }
  }

  // Runs every hour at :30 — fires when now is at shift_end + bufferMin
  @Cron('30 * * * *')
  async maybeSendPunchOutReminder(): Promise<void> {
    const bufferMin = await this.settings.getNumber('punchout_reminder_buffer', 0);
    if (bufferMin <= 0) return;

    const shiftEnd = await this.settings.get('shift_end', '19:00');
    const [hStr, mStr] = shiftEnd.split(':');
    const endTotal = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);

    const now = new Date();
    const nowAt30 = now.getHours() * 60 + 30;
    const target  = endTotal + bufferMin;

    // Allow ±5 min around the :30 tick
    if (Math.abs(target - nowAt30) > 5) return;

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

    // Employees who punched IN today but not OUT
    const employees = await this.prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        punches: {
          some: { type: 'IN',  timestampServer: { gte: todayStart, lte: todayEnd } },
          none: { type: 'OUT', timestampServer: { gte: todayStart, lte: todayEnd } },
        },
      },
      select: { name: true, phone: true },
    });

    this.logger.log(`Punch-out reminder: ${employees.length} employees haven't punched out`);
    for (const emp of employees) {
      await this.sms.send(
        emp.phone,
        `Hi ${emp.name.split(' ')[0]}, please remember to punch out before leaving. — BA HRMS`,
      );
    }
  }
}
