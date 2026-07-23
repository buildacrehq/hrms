import { IsString, IsEnum, Matches, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, Role, EmpType } from '@prisma/client';

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

  @ApiPropertyOptional({ description: 'Monthly salary in INR', example: 15000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  monthlySalary?: number;

  @ApiPropertyOptional({ enum: EmpType })
  @IsEnum(EmpType)
  @IsOptional()
  employmentType?: EmpType;
}
