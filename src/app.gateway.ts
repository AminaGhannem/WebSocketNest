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

  @SubscribeMessage('test')
  async sendMessage(
    @MessageBody() data: CreateMessageDto,
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const userId = await this.getUserIdFromToken(socket);
      const conversations = await this.chatService.getConversations({userId : userId});
      const conversation = conversations.find((conversation) =>
        conversation.users.some((user) => user.id === data.recieverId),
      );

      if (conversation) {
        const message = await this.chatService.sendChat({
          sendChatDto: { content: data.content },
          conversationId: conversation.id,
          senderId: userId,
        });
        this.server.to(conversation.id).emit('new-message', message);
      } else {
        const newConversation = await this.chatService.createConversation({
          createConversationDto: { recipientId: data.recieverId },
          userId: userId,
        });

        const message = await this.chatService.sendChat({
          sendChatDto: { content: data.content },
          conversationId: newConversation.conversationId,
          senderId: userId,
        });

        this.server
          .to(newConversation.conversationId)
          .emit('new-message', message);
      }
    } catch (error) {
      console.error(error);
      socket.emit('connection', 'error');
      socket.disconnect();
    }
  }

  async getUserIdFromToken(socket: Socket) {
    const token = socket.handshake.headers.authorization;
    const decodedToken = await this.authService.validateToken(token);
    const userId = await decodedToken.userId;
    if (!userId) {
      socket.emit('connection', 'error');
      socket.disconnect();
      return;
    }
    return userId;
  }

  @SubscribeMessage('like-message')
  async likeMessage(
    @MessageBody() messageId: string,
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = await this.getUserIdFromToken(socket);
    const likeMessageDTO = {
      messageId,
      userId,
    };
    const newLike = await this.chatService.likeMessage(likeMessageDTO);
    this.server.send('like-message', ` new like from user ${newLike.userId}`);
  }

  @SubscribeMessage('comment-message')
  async commentMessage(
    @MessageBody()
    { messageId, content }: { messageId: string; content: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = await this.getUserIdFromToken(socket);
    const commentMessageDTO = {
      messageId: messageId,
      content: content,
      userId: userId,
    };
    const newComment = await this.chatService.commentMessage(commentMessageDTO);
    this.server.send('comment-message', newComment.content);
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
