import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { EmployeeAuthService } from '../services/employee-auth.service';
import { EmployeeLoginDto } from '../dto/employee-login.dto';

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
}
