import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectRegularizationDto {
  @ApiProperty()
  @IsString() @IsNotEmpty()
  reason: string;
}
