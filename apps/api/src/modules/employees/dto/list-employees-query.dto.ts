import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EmpStatus } from '@prisma/client';

export class ListEmployeesQueryDto {
  @ApiPropertyOptional({ enum: EmpStatus, default: EmpStatus.ACTIVE })
  @IsEnum(EmpStatus)
  @IsOptional()
  status?: EmpStatus;

  @ApiPropertyOptional({ description: 'Filter by default site' })
  @IsString()
  @IsOptional()
  siteId?: string;

  @ApiPropertyOptional({ description: 'Case-insensitive name search' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cursor?: string;
}
