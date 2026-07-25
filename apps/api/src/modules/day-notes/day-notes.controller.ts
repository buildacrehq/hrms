import { Controller, Get, Put, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DayNotesService } from './day-notes.service';

@ApiTags('Day Notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/employees/:employeeId/day-notes')
export class DayNotesController {
  constructor(private readonly svc: DayNotesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all day notes for an employee in a date range' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate',   required: true })
  getForMonth(
    @Param('employeeId') employeeId: string,
    @Query('startDate') startDate: string,
    @Query('endDate')   endDate: string,
  ) {
    return this.svc.getForMonth(employeeId, startDate, endDate);
  }

  @Put(':date')
  @ApiOperation({ summary: 'Create or update a day note' })
  upsert(
    @Param('employeeId') employeeId: string,
    @Param('date') date: string,
    @Body() body: { note: string },
  ) {
    return this.svc.upsert(employeeId, date, body.note ?? '');
  }
}
