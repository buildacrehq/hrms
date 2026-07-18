import { Controller, Get, Post, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { RegularizationsService } from './regularizations.service';
import { CreateRegularizationDto } from './dto/create-regularization.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt.types';

@ApiTags('Regularizations (Employee)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('EMPLOYEE', 'SITE_MANAGER')
@Controller('regularizations')
export class EmployeeRegularizationsController {
  constructor(private readonly service: RegularizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a punch correction request' })
  submit(@Body() dto: CreateRegularizationDto, @CurrentUser() user: JwtPayload) {
    return this.service.submit(dto, user.sub);
  }

  @Get('my-requests')
  @ApiOperation({ summary: 'List own regularization requests' })
  myRequests(@CurrentUser() user: JwtPayload) {
    return this.service.findMyRequests(user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Cancel a pending regularization request' })
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.cancel(id, user.sub);
  }
}
