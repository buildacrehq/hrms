import { IsString, IsNumber, IsEnum, IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveScope, ApprovalMode, AccrualType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateLeaveTypeDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Total days entitled per accrual period' })
  @IsNumber()
  @Min(0.5)
  @Type(() => Number)
  daysEntitled: number;

  @ApiProperty({ enum: LeaveScope })
  @IsEnum(LeaveScope)
  scope: LeaveScope;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  carryForward?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  eligibilityMinMonths?: number;

  @ApiPropertyOptional({ enum: ApprovalMode, default: ApprovalMode.MANUAL })
  @IsOptional()
  @IsEnum(ApprovalMode)
  approvalMode?: ApprovalMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  @Type(() => Number)
  maxConsecutiveDays?: number;

  @ApiPropertyOptional({ enum: AccrualType, default: AccrualType.ANNUAL })
  @IsOptional()
  @IsEnum(AccrualType)
  accrual?: AccrualType;
}
