import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSiteDto {
  @ApiProperty({ example: 'Whitefield Site' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Whitefield, Bangalore, Karnataka' })
  @IsString()
  @IsOptional()
  address?: string;
}
