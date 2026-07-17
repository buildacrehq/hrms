import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeaveRequestDto {
  @ApiProperty({ description: 'Employee ID to create leave for' })
  @IsString()
  employeeId: string;

  @ApiProperty()
  @IsString()
  leaveTypeId: string;

  @ApiProperty({ description: 'YYYY-MM-DD' })
  @IsString()
  fromDate: string;

  @ApiProperty({ description: 'YYYY-MM-DD' })
  @IsString()
  toDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
