import { Controller, Get, Patch, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

// Public keys exposed to the mobile app (no auth needed — non-sensitive config only)
const MOBILE_PUBLIC_KEYS = [
  'require_face_detection',
  'require_photo',
  'require_gps',
  'company_name',
];

@ApiTags('Settings (Public)')
@Controller('settings')
export class MobileSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('mobile')
  @ApiOperation({ summary: 'Public app config for mobile — no auth required' })
  async getMobile() {
    const all = await this.settings.getAll();
    return Object.fromEntries(
      MOBILE_PUBLIC_KEYS.filter(k => k in all).map(k => [k, all[k]]),
    );
  }
}

@ApiTags('Settings (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all settings as a flat key→value map' })
  getAll() {
    return this.settings.getAll();
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update one or more settings — returns all settings after update' })
  async updateMany(@Body() dto: UpdateSettingsDto) {
    const pairs = Object.entries(dto.settings).map(([key, value]) => ({ key, value }));
    await this.settings.setMany(pairs);
    return this.settings.getAll();
  }
}
