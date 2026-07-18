import { IsString, IsNumber, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdjustBalanceDto {
  @ApiProperty() @IsString() @IsNotEmpty() employeeId: string;
  @ApiProperty() @IsString() @IsNotEmpty() leaveTypeId: string;
  @ApiProperty() @IsNumber() @Min(-365) credit: number;
  @ApiProperty({ required: false }) note?: string;
}
