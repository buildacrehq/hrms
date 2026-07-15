import {
  Controller,
  Post,
  Get,
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
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { PunchesService } from '../services/punches.service';
import { GetUploadUrlDto } from '../dto/get-upload-url.dto';
import { CreatePunchDto } from '../dto/create-punch.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../common/types/jwt.types';

@ApiTags('Punches (Employee)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('EMPLOYEE', 'SITE_MANAGER')
@Controller('punches')
export class PunchesController {
  constructor(private readonly service: PunchesService) {}

  @Post('upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get presigned R2 upload URL — upload photo directly from device, then call POST /punches',
  })
  getUploadUrl(@CurrentUser() user: JwtPayload, @Body() dto: GetUploadUrlDto) {
    return this.service.getUploadUrl(user.sub, dto.type);
  }

  @Post()
  @ApiOperation({ summary: 'Record a punch-in or punch-out (status starts PENDING)' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePunchDto) {
    return this.service.create(user.sub, dto);
  }

  @Get('my/last')
  @ApiOperation({ summary: 'Get my most recent punch (used by apps to determine next punch type)' })
  getLastPunch(@CurrentUser() user: JwtPayload) {
    return this.service.getLastPunch(user.sub);
  }

  @Get('me')
  @ApiOperation({ summary: 'List my own punches, optionally filtered by month' })
  @ApiQuery({ name: 'month', required: false, description: 'YYYY-MM' })
  @ApiQuery({ name: 'cursor', required: false })
  getMyPunches(
    @CurrentUser() user: JwtPayload,
    @Query('month') month?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.service.getMyPunches(user.sub, month, cursor);
  }
}
