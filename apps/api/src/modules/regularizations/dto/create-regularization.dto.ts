import { IsString, IsEnum, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RegType } from '@prisma/client';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateRegularizationDto {
  @ApiProperty({ example: '2026-07-15' })
  @IsString() @IsNotEmpty()
  date: string;

  @ApiProperty({ enum: RegType })
  @IsEnum(RegType)
  requestType: RegType;

  @ApiProperty({ example: '09:45', required: false })
  @IsOptional() @Matches(TIME_RE, { message: 'punchInTime must be HH:MM' })
  punchInTime?: string;

  @ApiProperty({ example: '18:30', required: false })
  @IsOptional() @Matches(TIME_RE, { message: 'punchOutTime must be HH:MM' })
  punchOutTime?: string;

  @ApiProperty()
  @IsString() @IsNotEmpty()
  reason: string;
}
