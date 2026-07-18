import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { EmployeeAuthService } from '../services/employee-auth.service';
import { EmployeeLoginDto } from '../dto/employee-login.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../common/types/jwt.types';

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
  login(@Body() dto: EmployeeLoginDto) {
    return this.service.login(dto.phone, dto.password);
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
