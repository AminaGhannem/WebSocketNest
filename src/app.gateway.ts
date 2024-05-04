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
  private readonly clients: Set<Socket> = new Set();

  constructor(
    private socketService: SocketService,
    private chatService: ChatService,
  ) {}
  afterInit() {
    this.socketService.server = this.server;
  }

  onModuleInit() {
    this.server.emit('confirmation');
  }

  handleConnection(socket: Socket) {
    this.clients.add(socket);
    console.log('connected');
  }

  @SubscribeMessage('test')
  async sendMessage(@MessageBody() data, @ConnectedSocket() socket: Socket) {
    console.log(data);
    socket.emit('chat', "Salut j'ai bien reçu ton message");
  }

  @SubscribeMessage('create message')
  async createMessage(@MessageBody() data, @ConnectedSocket() socket: Socket) {
    socket.emit('message', 'Message created');
  }

  @SubscribeMessage('connection')
  async sendConfirm(@ConnectedSocket() socket: Socket) {
    socket.emit('confirmation');
  }
}
