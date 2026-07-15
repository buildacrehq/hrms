import { IsString, IsEnum, Matches, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, Role } from '@prisma/client';

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: 'Ravi Kumar' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a valid 10-digit Indian mobile number' })
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  defaultSiteId?: string;
}
