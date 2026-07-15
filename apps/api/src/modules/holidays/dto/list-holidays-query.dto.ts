import { IsOptional, IsString, IsNumberString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListHolidaysQueryDto {
  @ApiPropertyOptional({ example: '2026', description: 'Filter by year' })
  @IsNumberString()
  @IsOptional()
  year?: string;

  @ApiPropertyOptional({ description: 'Filter by site (null = company-wide holidays)' })
  @IsString()
  @IsOptional()
  siteId?: string;
}
