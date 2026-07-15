import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const UPLOAD_EXPIRY_SECONDS = 300;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly supabase: SupabaseClient | null;
  private readonly bucket: string;
  private readonly viewExpirySeconds: number;

  constructor(config: ConfigService) {
    const supabaseUrl = config.get<string>('SUPABASE_URL', '');
    const serviceRoleKey = config.get<string>('SUPABASE_SERVICE_ROLE_KEY', '');

    this.bucket = config.get<string>('STORAGE_BUCKET', 'buildacre-punches');
    this.viewExpirySeconds = parseInt(
      config.get<string>('SIGNED_URL_EXPIRY_SECONDS', '300'),
      10,
    );

    if (!supabaseUrl || !serviceRoleKey) {
      this.logger.warn('Supabase storage credentials not set — running in stub mode (dev only)');
      this.supabase = null;
      return;
    }

    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    this.logger.log(`StorageService connected to Supabase bucket: ${this.bucket}`);
  }

  /** Returns a presigned upload URL + token the mobile app uses to PUT a punch photo directly. */
  async getPresignedUploadUrl(key: string): Promise<{ uploadUrl: string; uploadToken: string }> {
    if (!this.supabase) {
      this.logger.warn(`[STUB] Upload URL for: ${key}`);
      return { uploadUrl: `http://localhost:3000/__stub_upload/${encodeURIComponent(key)}`, uploadToken: 'stub' };
    }

    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUploadUrl(key);

    if (error) throw new Error(`Storage upload URL error: ${error.message}`);
    return { uploadUrl: data.signedUrl, uploadToken: data.token };
  }

  /** Returns a short-lived signed GET URL for admin photo viewing. */
  async getSignedViewUrl(key: string): Promise<string> {
    if (!this.supabase) {
      this.logger.warn(`[STUB] View URL for: ${key}`);
      return `http://localhost:3000/__stub_view/${encodeURIComponent(key)}`;
    }

    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(key, this.viewExpirySeconds);

    if (error) throw new Error(`Storage view URL error: ${error.message}`);
    return data.signedUrl;
  }

  /** Called by the photo retention cleanup job. */
  async deleteObject(key: string): Promise<void> {
    if (!this.supabase) {
      this.logger.warn(`[STUB] Would delete: ${key}`);
      return;
    }

    const { error } = await this.supabase.storage.from(this.bucket).remove([key]);
    if (error) throw new Error(`Storage delete error: ${error.message}`);
  }
}
