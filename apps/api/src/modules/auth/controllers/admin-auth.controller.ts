import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { AdminAuthService } from '../services/admin-auth.service';
import { AdminLoginDto } from '../dto/admin-login.dto';

@ApiTags('Auth')
@Controller('auth/admin')
export class AdminAuthController {
  constructor(private readonly service: AdminAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin email + password login' })
  @ApiOkResponse({ description: 'Returns JWT access & refresh tokens plus admin profile' })
  login(@Body() dto: AdminLoginDto) {
    return this.service.login(dto.email, dto.password);
  }
}
