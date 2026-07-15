import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApproveAllNormalDto {
  @ApiProperty({
    example: '2026-07-09',
    description: 'Calendar date to bulk-approve (YYYY-MM-DD)',
  })
  @IsDateString()
  date: string;
}
