import { Global, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocketService } from './socket/socket.service';
import { ChatService } from './chat/chat.service';
import { AuthService } from './auth/auth.service';
import { UserService } from './user/user.service';

@Global()
@WebSocketGateway({ cors: '*' })
export class AppGateway implements OnGatewayInit, OnModuleInit {
  @WebSocketServer()
  private readonly server: Server;
  private readonly clients: Set<{
    userId: string;
    socket: Socket;
  }> = new Set();

  constructor(
    private socketService: SocketService,
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}
  afterInit() {
    this.socketService.server = this.server;
  }

  onModuleInit() {
    this.server.emit('confirmation');
  }

  async handleConnection(socket: Socket) {
    const token = socket.handshake.headers.authorization;
    if (!token) {
      socket.emit('connection', 'error');
      socket.disconnect();
    }
    try {
      const decodedToken = await this.authService.validateToken(token);
      console.log(decodedToken);
      const user = await this.userService.getUser(decodedToken.userId);
      if (user)
        this.clients.add({ userId: decodedToken.userId, socket: socket });
      else socket.disconnect();
    } catch (e) {
      socket.disconnect();
      console.log(e);
    }
  }

  @SubscribeMessage('create-message')
  async sendMessage(
    @MessageBody() data: CreateMessageDto,
    @ConnectedSocket() socket: Socket,
  ) {
    console.log(data);
    const token = socket.handshake.headers.authorization;
    if (!token) {
      socket.emit('connection', 'error');
      socket.disconnect();
    }
    try {
      const decodedToken = await this.authService.validateToken(token);
      console.log(decodedToken);
      const user = decodedToken.userId;
    } catch {
      socket.disconnect();
    }
  }

  @SubscribeMessage('like-message')
  async likeMessage(
    @MessageBody() messageId: string,
    @ConnectedSocket() socket: Socket,
  ) {
    await this.chatService.likeMessage(messageId);
    const interactions =
      await this.chatService.getMessageInteractions(messageId);
    this.server.to(messageId).emit('message-updated', interactions);
  }

  @SubscribeMessage('comment-message')
  async commentMessage(
    @MessageBody()
    { messageId, content }: { messageId: string; content: string },
    @ConnectedSocket() socket: Socket,
  ) {
    await this.chatService.commentMessage(messageId, content);
    const interactions =
      await this.chatService.getMessageInteractions(messageId);
    this.server.to(messageId).emit('message-updated', interactions);
  }

  @SubscribeMessage('connection')
  async sendConfirm(@ConnectedSocket() socket: Socket) {
    socket.emit('confirmation');
  }
}

export type CreateMessageDto = {
  recieverId: string;
  content: string;
};
