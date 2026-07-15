import { IsString, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHolidayDto {
  @ApiProperty({ example: '2026-08-15', description: 'Holiday date (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'Independence Day' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Site ID for a site-specific closure. Omit for company-wide holiday.',
  })
  @IsString()
  @IsOptional()
  siteId?: string;
}
