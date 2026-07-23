import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminPunchesService } from '../services/admin-punches.service';
import { RejectPunchDto } from '../dto/reject-punch.dto';
import { ApproveAllNormalDto } from '../dto/approve-all-normal.dto';
import { ListPunchesQueryDto } from '../dto/list-punches-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../common/types/jwt.types';

@ApiTags('Punches (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/punches')
export class AdminPunchesController {
  constructor(private readonly service: AdminPunchesService) {}

  @Get('pending')
  @ApiOperation({ summary: 'Pending approval queue — paginated, oldest first' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  getPending(
    @Query('siteId') siteId?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.service.getPending(siteId, cursor);
  }

  @Get()
  @ApiOperation({ summary: 'All punches with optional filters (date / site / status)' })
  getAll(@Query() query: ListPunchesQueryDto) {
    return this.service.getAll(query);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a single punch' })
  @ApiParam({ name: 'id' })
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.approve(id, user.sub);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a punch with a reason' })
  @ApiParam({ name: 'id' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectPunchDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.reject(id, user.sub, dto.reason);
  }

  @Post('approve-all-normal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk-approve all "normal" punches for a date — clears the queue of flagged items',
  })
  approveAllNormal(@Body() dto: ApproveAllNormalDto, @CurrentUser() user: JwtPayload) {
    return this.service.approveAllNormal(dto.date, user.sub);
  }

  @Post('approve-employee/:employeeId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve all pending punches for a specific employee' })
  @ApiParam({ name: 'employeeId' })
  approveAllForEmployee(
    @Param('employeeId') employeeId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.approveAllForEmployee(employeeId, user.sub);
  }

  @Get(':id/photo-url')
  @ApiOperation({ summary: 'Get a short-lived signed URL to view a punch photo' })
  @ApiParam({ name: 'id' })
  getPhotoUrl(@Param('id') id: string) {
    return this.service.getPhotoUrl(id);
  }
}
