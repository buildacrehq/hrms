import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectLeaveRequestDto {
  @ApiProperty()
  @IsString()
  reason: string;
}
