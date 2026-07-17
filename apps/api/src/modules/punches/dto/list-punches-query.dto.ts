import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalStatus, PunchType } from '@prisma/client';

export class ListPunchesQueryDto {
  @ApiPropertyOptional({ description: 'Filter by single date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: 'Range start date (YYYY-MM-DD) — used for monthly reports' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Range end date (YYYY-MM-DD) — used with startDate' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional({ enum: ApprovalStatus })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;

  @ApiPropertyOptional({ enum: PunchType })
  @IsOptional()
  @IsEnum(PunchType)
  punchType?: PunchType;

  @ApiPropertyOptional({ description: 'Last punch ID from previous page' })
  @IsOptional()
  @IsString()
  cursor?: string;
}
