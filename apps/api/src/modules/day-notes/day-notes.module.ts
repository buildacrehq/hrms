import { Module } from '@nestjs/common';
import { DayNotesController } from './day-notes.controller';
import { DayNotesService } from './day-notes.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DayNotesController],
  providers: [DayNotesService],
})
export class DayNotesModule {}
