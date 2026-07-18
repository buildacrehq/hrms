import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { AdminAuthService } from '../services/admin-auth.service';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../common/types/jwt.types';

class AdminChangePasswordDto {
  @IsString() @MinLength(1) oldPassword: string;
  @IsString() @MinLength(6) newPassword: string;
}

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

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin change own password' })
  async changePassword(@Body() dto: AdminChangePasswordDto, @CurrentUser() user: JwtPayload) {
    await this.service.changePassword(user.sub, dto.oldPassword, dto.newPassword);
    return { message: 'Password updated successfully' };
  }
}
