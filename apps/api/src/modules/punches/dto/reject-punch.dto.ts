import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectPunchDto {
  @ApiProperty({ example: 'Photo is unclear — face not visible' })
  @IsString()
  @MinLength(5)
  reason: string;
}
