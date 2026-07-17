import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { EmployeesService } from '../employees.service';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { ListEmployeesQueryDto } from '../dto/list-employees-query.dto';
import { SetPasswordDto } from '../dto/set-password.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('Employees (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/employees')
export class AdminEmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Get()
  @ApiOperation({ summary: 'List employees — filterable by status, site, name search' })
  findAll(@Query() query: ListEmployeesQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Get single employee' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new employee (they log in via OTP on first use)' })
  create(@Body() dto: CreateEmployeeDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Update employee name / phone / role / site' })
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Deactivate employee (sets exitedAt, blocks future login)' })
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Re-activate a previously deactivated employee' })
  activate(@Param('id') id: string) {
    return this.service.activate(id);
  }

  @Post(':id/set-password')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Admin sets or resets employee password' })
  setPassword(@Param('id') id: string, @Body() dto: SetPasswordDto) {
    return this.service.setPassword(id, dto.password);
  }
}
