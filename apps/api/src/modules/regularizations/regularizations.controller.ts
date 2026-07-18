import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { RegularizationsService } from './regularizations.service';
import { RejectRegularizationDto } from './dto/reject-regularization.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt.types';

@ApiTags('Regularizations (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/regularizations')
export class RegularizationsController {
  constructor(private readonly service: RegularizationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all regularization requests' })
  @ApiQuery({ name: 'status',     required: false })
  @ApiQuery({ name: 'employeeId', required: false })
  findAll(
    @Query('status')     status?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.findAll(status, employeeId);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Approve — creates the missing punch record(s)' })
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.approve(id, user.sub);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Reject with a reason' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectRegularizationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.reject(id, user.sub, dto.reason);
  }
}
