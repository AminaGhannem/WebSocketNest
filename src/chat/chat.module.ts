import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
@Module({
  providers: [ChatService, PrismaService],
  controllers: [ChatController],
  exports: [ChatService],
})
export class ChatModule {}
