import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetPasswordDto {
  @ApiProperty({ example: 'NewPass@123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}
