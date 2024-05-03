import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ChatModule } from './chat/chat.module';
import { SocketModule } from './socket/socket.module';

@Module({
  imports: [AuthModule, UserModule, ChatModule, SocketModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
