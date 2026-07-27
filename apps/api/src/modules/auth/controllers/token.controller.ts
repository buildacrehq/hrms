import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { TokenService } from '../services/token.service';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { SettingsService } from '../../settings/settings.service';

@ApiTags('Auth')
@Controller('auth')
export class TokenController {
  constructor(
    private readonly tokens: TokenService,
    private readonly settings: SettingsService,
  ) {}

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a valid refresh token for a new access token' })
  @ApiOkResponse({ description: '{ accessToken } or { accessToken, refreshToken } when auto_renew_sessions is on' })
  async refresh(@Body() dto: RefreshTokenDto) {
    const payload = this.tokens.verifyRefreshToken(dto.refreshToken);
    const pair = this.tokens.generateTokens(payload.sub, payload.role);
    const autoRenew = await this.settings.getBoolean('auto_renew_sessions', true);
    return autoRenew ? pair : { accessToken: pair.accessToken };
  }
}
