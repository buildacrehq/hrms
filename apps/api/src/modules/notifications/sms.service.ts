import { Injectable, Logger } from '@nestjs/common';
import { Twilio } from 'twilio';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly client: Twilio | null;
  private readonly from: string;
  private readonly channel: 'sms' | 'whatsapp';

  constructor() {
    const sid    = process.env.TWILIO_ACCOUNT_SID;
    const token  = process.env.TWILIO_AUTH_TOKEN;
    this.from    = process.env.TWILIO_FROM_NUMBER ?? '';
    this.channel = (process.env.TWILIO_CHANNEL as 'sms' | 'whatsapp') ?? 'sms';

    if (sid && token && this.from) {
      this.client = new Twilio(sid, token);
      this.logger.log(`SMS service active (channel=${this.channel})`);
    } else {
      this.client = null;
      this.logger.warn('Twilio env vars not set — SMS notifications are disabled');
    }
  }

  async send(to: string, message: string): Promise<void> {
    const normalized = to.startsWith('+') ? to : `+91${to.replace(/\D/g, '')}`;

    if (!this.client) {
      this.logger.log(`[DRY] SMS to ${normalized}: ${message}`);
      return;
    }

    try {
      const fromAddr = this.channel === 'whatsapp' ? `whatsapp:${this.from}` : this.from;
      const toAddr   = this.channel === 'whatsapp' ? `whatsapp:${normalized}` : normalized;
      await this.client.messages.create({ from: fromAddr, to: toAddr, body: message });
    } catch (err: any) {
      this.logger.error(`Failed to send SMS to ${normalized}: ${err.message}`);
    }
  }
}
