import { IsObject, IsNotEmptyObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiProperty({
    description: 'Flat key→value map of settings to update. Unknown keys are ignored.',
    example: {
      shift_start: '09:30',
      grace_minutes: '10',
      punchout_reminder_buffer: '60',
    },
  })
  @IsObject()
  @IsNotEmptyObject()
  settings: Record<string, string>;
}
