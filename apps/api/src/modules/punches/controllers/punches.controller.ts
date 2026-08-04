import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { parseDevice } from '../../../common/utils/device.util';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { PunchesService } from '../services/punches.service';
import { StorageService } from '../../storage/storage.service';
import { PrismaService } from '../../../prisma/prisma.service';
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
@Roles('EMPLOYEE', 'TEAM_LEADER')
@Controller('punches')
export class PunchesController {
  constructor(
    private readonly service: PunchesService,
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

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
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePunchDto, @Req() req: Request) {
    const ua  = (req.headers['user-agent'] ?? '') as string;
    const ip  = (req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? '') as string;
    const device = parseDevice(ua, ip);
    return this.service.create(user.sub, dto, device);
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

  @Get('today')
  @ApiOperation({ summary: "Get today's punches for the current employee" })
  async getToday(@CurrentUser() user: JwtPayload) {
    return this.service.getTodayPunches(user.sub);
  }

  @Get(':id/photo-url')
  @ApiOperation({ summary: "Get signed URL to view own punch photo" })
  async getPhotoUrl(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const punch = await this.prisma.punch.findUnique({ where: { id }, select: { employeeId: true, photoKey: true } });
    if (!punch) throw new NotFoundException('Punch not found');
    if (punch.employeeId !== user.sub) throw new ForbiddenException();
    if (!punch.photoKey) return { signedUrl: null };
    const signedUrl = await this.storage.getSignedViewUrl(punch.photoKey);
    return { signedUrl };
  }
}
