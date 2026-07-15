import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

const OTP_EXPIRY_MINUTES = 5;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async send(phone: string): Promise<string | null> {
    await this.prisma.otpRecord.updateMany({
      where: { phone, used: false },
      data: { used: true },
    });

    const otp = this.generateCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.otpRecord.create({ data: { phone, otp, expiresAt } });
    return await this.dispatch(phone, otp);
  }

  async verify(phone: string, otp: string): Promise<void> {
    const record = await this.prisma.otpRecord.findFirst({
      where: {
        phone,
        otp,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) throw new BadRequestException('Invalid or expired OTP');

    await this.prisma.otpRecord.update({
      where: { id: record.id },
      data: { used: true },
    });
  }

  private generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private async dispatch(phone: string, otp: string): Promise<string | null> {
    const provider = this.config.get<string>('OTP_PROVIDER', 'console');

    switch (provider) {
      case 'console':
        this.logger.log(`[OTP DEV] phone=${phone}  otp=${otp}  expires_in=${OTP_EXPIRY_MINUTES}min`);
        return otp; // returned so dev clients can auto-fill

      case 'msg91':
        await this.sendViaMSG91(phone, otp);
        return null;

      case 'fast2sms':
        await this.sendViaFast2SMS(phone, otp);
        return null;

      default:
        throw new Error(`Unknown OTP_PROVIDER: ${provider}`);
    }
  }

  private async sendViaMSG91(phone: string, otp: string): Promise<void> {
    const authKey = this.config.getOrThrow<string>('MSG91_AUTH_KEY');
    const templateId = this.config.getOrThrow<string>('MSG91_TEMPLATE_ID');

    const res = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authkey: authKey },
      body: JSON.stringify({ template_id: templateId, mobile: `91${phone}`, otp }),
    });

    if (!res.ok) {
      throw new Error(`MSG91 send failed: ${await res.text()}`);
    }
  }

  private async sendViaFast2SMS(phone: string, otp: string): Promise<void> {
    const apiKey = this.config.getOrThrow<string>('FAST2SMS_API_KEY');

    const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: { authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: 'otp', variables_values: otp, numbers: phone }),
    });

    if (!res.ok) {
      throw new Error(`Fast2SMS send failed: ${await res.text()}`);
    }
  }
}
