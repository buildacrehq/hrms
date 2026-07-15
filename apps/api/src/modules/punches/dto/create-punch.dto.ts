import {
  IsEnum,
  IsNumber,
  IsString,
  IsBoolean,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PunchType } from '@prisma/client';

export class CreatePunchDto {
  @ApiProperty({ enum: PunchType })
  @IsEnum(PunchType)
  type: PunchType;

  @ApiProperty({ description: 'ISO 8601 timestamp captured on the device clock' })
  @IsDateString()
  timestampDevice: string;

  @ApiProperty({ example: 12.9716 })
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 77.5946 })
  @IsNumber()
  long: number;

  @ApiProperty({
    example: 18.5,
    description: 'GPS accuracy radius in metres; send 0 if location unavailable',
  })
  @IsNumber()
  @Min(0)
  accuracy: number;

  @ApiPropertyOptional({ description: 'Reverse-geocoded address from device (best-effort)' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    description: 'R2 object key from POST /punches/upload-url — empty string if photo failed',
  })
  @IsString()
  photoKey: string;

  @ApiPropertyOptional({ default: false, description: 'True when captured offline and synced later' })
  @IsBoolean()
  @IsOptional()
  syncedOffline?: boolean;
}
