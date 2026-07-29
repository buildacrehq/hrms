import { IsString, IsEnum, Matches, IsOptional, IsNumber, IsInt, Min, Max, IsBoolean } from 'class-validator';
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

  @ApiPropertyOptional({ description: '0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat', minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  weeklyOff?: number;

  @ApiPropertyOptional({ description: 'Bypass 1-punch-per-day limit (for test accounts)' })
  @IsBoolean()
  @IsOptional()
  isTestAccount?: boolean;
}
