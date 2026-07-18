import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Gender } from '@prisma/client';
import { EmployeesService } from '../employees.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../common/types/jwt.types';

class UpdateMyProfileDto {
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}

@ApiTags('Employees (Employee)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('EMPLOYEE', 'SITE_MANAGER')
@Controller('employees')
export class EmployeeProfileController {
  constructor(private readonly service: EmployeesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get own employee profile' })
  getMe(@CurrentUser() user: JwtPayload) {
    return this.service.findMe(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile (gender)' })
  updateMe(@Body() dto: UpdateMyProfileDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(user.sub, dto);
  }
}
