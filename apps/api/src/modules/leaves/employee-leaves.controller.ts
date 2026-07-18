import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { LeavesService } from './leaves.service';
import { CreateEmployeeLeaveRequestDto } from './dto/create-employee-leave-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt.types';

@ApiTags('Leaves (Employee)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('EMPLOYEE', 'SITE_MANAGER')
@Controller('leaves')
export class EmployeeLeavesController {
  constructor(private readonly service: LeavesService) {}

  @Get('types')
  @ApiOperation({ summary: 'List active leave types available for application' })
  findTypes() {
    return this.service.findAllTypes(false);
  }

  @Get('my-requests')
  @ApiOperation({ summary: 'Get own leave requests' })
  myRequests(@CurrentUser() user: JwtPayload) {
    return this.service.findMyRequests(user.sub);
  }

  @Post('my-requests')
  @ApiOperation({ summary: 'Submit a new leave request' })
  submitRequest(@Body() dto: CreateEmployeeLeaveRequestDto, @CurrentUser() user: JwtPayload) {
    return this.service.submitRequest(dto, user.sub);
  }

  @Delete('my-requests/:id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Cancel a pending leave request' })
  cancelRequest(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.cancelRequest(id, user.sub);
  }
}
