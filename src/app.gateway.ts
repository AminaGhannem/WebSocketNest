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

@Global()
@WebSocketGateway({ cors: '*' })
export class AppGateway implements OnGatewayInit, OnModuleInit {
  @WebSocketServer()
  private readonly server: Server;

  constructor(
    private socketService: SocketService,
    private readonly chatService: ChatService,
  ) {}
  afterInit() {
    this.socketService.server = this.server;
  }

  onModuleInit() {
    this.server.emit('confirmation');
  }

  @SubscribeMessage('test')
  async sendMessage(@MessageBody() data, @ConnectedSocket() socket: Socket) {
    console.log(data);
    socket.emit('chat', "Salut j'ai bien reçu ton message");
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

  @SubscribeMessage('join-chat-room')
  async joinChatRoom(
    @MessageBody() conversationId: string,
    @ConnectedSocket() socket: Socket,
  ) {
    console.log({ conversationId });
    socket.join(conversationId);
  }

  @SubscribeMessage('connection')
  async sendConfirm(@ConnectedSocket() socket: Socket) {
    socket.emit('confirmation');
  }
}
