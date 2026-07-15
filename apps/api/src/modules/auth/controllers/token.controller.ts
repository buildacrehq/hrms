import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { TokenService } from '../services/token.service';
import { RefreshTokenDto } from '../dto/refresh-token.dto';

@ApiTags('Auth')
@Controller('auth')
export class TokenController {
  constructor(private readonly tokens: TokenService) {}

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a valid refresh token for a new access token' })
  @ApiOkResponse({ description: '{ accessToken }' })
  refresh(@Body() dto: RefreshTokenDto) {
    const payload = this.tokens.verifyRefreshToken(dto.refreshToken);
    const { accessToken } = this.tokens.generateTokens(payload.sub, payload.role);
    return { accessToken };
  }
}
