import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { Request } from 'express';
import { EmployeeAuthService } from '../services/employee-auth.service';
import { EmployeeLoginDto } from '../dto/employee-login.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../common/types/jwt.types';
import { parseDevice } from '../../../common/utils/device.util';

class ChangePasswordDto {
  @IsString() oldPassword: string;
  @IsString() @MinLength(6) newPassword: string;
}

@ApiTags('Auth')
@Controller('auth/employee')
export class EmployeeAuthController {
  constructor(private readonly service: EmployeeAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Employee login — phone + password → JWT tokens + profile' })
  @ApiOkResponse({ description: '{ accessToken, refreshToken, employee }' })
  login(@Body() dto: EmployeeLoginDto, @Req() req: Request) {
    const ua = (req.headers['user-agent'] ?? '') as string;
    const ip = (req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? '') as string;
    return this.service.login(dto.phone, dto.password, parseDevice(ua, ip));
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYEE', 'SITE_MANAGER')
  @ApiOperation({ summary: 'Change own password' })
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: JwtPayload) {
    return this.service.changePassword(user.sub, dto.oldPassword, dto.newPassword);
  }
}
