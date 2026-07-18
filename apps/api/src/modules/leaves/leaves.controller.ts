import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { LeavesService } from './leaves.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ListLeaveRequestsQueryDto } from './dto/list-leave-requests-query.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt.types';

@ApiTags('Leaves (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/leaves')
export class LeavesController {
  constructor(private readonly service: LeavesService) {}

  // ─── Leave Types ────────────────────────────────────────────────────────────

  @Get('types')
  @ApiOperation({ summary: 'List all leave types' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  findAllTypes(@Query('includeInactive') includeInactive?: string) {
    return this.service.findAllTypes(includeInactive === 'true');
  }

  @Post('types')
  @ApiOperation({ summary: 'Create a new leave type' })
  createType(@Body() dto: CreateLeaveTypeDto) {
    return this.service.createType(dto);
  }

  @Patch('types/:id')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Update a leave type' })
  updateType(@Param('id') id: string, @Body() dto: UpdateLeaveTypeDto) {
    return this.service.updateType(id, dto);
  }

  @Delete('types/:id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Deactivate a leave type' })
  deleteType(@Param('id') id: string) {
    return this.service.deleteType(id);
  }

  // ─── Leave Requests ─────────────────────────────────────────────────────────

  @Get('requests')
  @ApiOperation({ summary: 'List all leave requests with optional filters' })
  findAllRequests(@Query() query: ListLeaveRequestsQueryDto) {
    return this.service.findAllRequests(query);
  }

  @Post('requests')
  @ApiOperation({ summary: 'Admin creates a leave request on behalf of an employee (auto-approved)' })
  createRequest(@Body() dto: CreateLeaveRequestDto, @CurrentUser() user: JwtPayload) {
    return this.service.createRequest(dto, user.sub);
  }

  @Post('requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Approve a pending leave request' })
  approveRequest(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.approveRequest(id, user.sub);
  }

  @Post('requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Reject a pending leave request' })
  rejectRequest(
    @Param('id') id: string,
    @Body() dto: RejectLeaveRequestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.rejectRequest(id, user.sub, dto.reason);
  }

  // ─── Leave Balances ─────���───────────────────────────────────────────────────

  @Get('balances')
  @ApiOperation({ summary: 'List leave balances — optionally filtered by year / employee' })
  @ApiQuery({ name: 'year',       required: false })
  @ApiQuery({ name: 'employeeId', required: false })
  getAllBalances(
    @Query('year') year?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.getAllBalances(year ? parseInt(year, 10) : undefined, employeeId);
  }

  @Post('balances/adjust')
  @ApiOperation({ summary: 'Manually credit or debit an employee\'s leave balance' })
  adjustBalance(@Body() dto: AdjustBalanceDto) {
    return this.service.adjustBalance(dto.employeeId, dto.leaveTypeId, dto.credit);
  }
}
