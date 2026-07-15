import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PunchType } from '@prisma/client';

export class GetUploadUrlDto {
  @ApiProperty({ enum: PunchType, description: 'IN or OUT — determines file path prefix' })
  @IsEnum(PunchType)
  type: PunchType;
}
