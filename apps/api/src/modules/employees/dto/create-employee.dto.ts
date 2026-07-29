import { IsString, IsEnum, Matches, IsOptional, MinLength, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, Role, EmpType } from '@prisma/client';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Ravi Kumar' })
  @IsString()
  name: string;

  @ApiProperty({ enum: Gender })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({ example: '9876543210', description: '10-digit Indian mobile number' })
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a valid 10-digit Indian mobile number' })
  phone: string;

  @ApiPropertyOptional({ enum: Role, default: Role.EMPLOYEE })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({ description: 'Site ID to assign as default site' })
  @IsString()
  @IsOptional()
  defaultSiteId?: string;

  @ApiPropertyOptional({ enum: EmpType, default: EmpType.MONTHLY_REGULAR })
  @IsEnum(EmpType)
  @IsOptional()
  employmentType?: EmpType;

  @ApiPropertyOptional({ description: 'Weekly off day: 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat', minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  weeklyOff?: number;

  @ApiPropertyOptional({ description: 'Initial password (min 6 chars). Admin can set/reset later.', minLength: 6 })
  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;
}
