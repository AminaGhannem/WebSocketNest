import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { SocketService } from 'src/socket/socket.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendChatDto } from './dto/send-chat.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socketService: SocketService,
  ) {}

  async createConversation({
    createConversationDto: { recipientId },
    userId,
  }: {
    createConversationDto: CreateConversationDto;
    userId: string;
  }) {
    try {
      // Récupère les utilisateurs via deux appels distincts
      const [existingRecipient, existingUser] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: recipientId },
        }),
        this.prisma.user.findUnique({
          where: { id: userId },
        }),
      ]);

      // Vérifie que les deux utilisateurs existent bien
      if (!existingRecipient) {
        throw new Error("Le destinataire n'existe pas.");
      }

      if (!existingUser) {
        throw new Error("L'utilisateur connecté n'existe pas.");
      }

      // Crée une nouvelle conversation en ajoutant les deux utilisateurs
      const createdConversation = await this.prisma.conversation.create({
        data: {
          users: {
            connect: [{ id: existingUser.id }, { id: existingRecipient.id }],
          },
        },
      });

      return {
        error: false,
        conversationId: createdConversation.id,
        message: 'La conversation a bien été créée.',
      };
    } catch (error) {
      console.error(error);
      return {
        error: true,
        message: error.message,
      };
    }
  }

  async sendChat({
    sendChatDto,
    conversationId,
    senderId,
  }: {
    sendChatDto: SendChatDto;
    conversationId: string;
    senderId: string;
  }) {
    // Vérification si `content` est fourni
    if (!sendChatDto.content || sendChatDto.content.trim() === '') {
      return {
        error: true,
        message: 'Le contenu du message ne peut pas être vide.',
      };
    }

    try {
      const [existingConversation, existingUser] = await Promise.all([
        this.prisma.conversation.findUnique({
          where: {
            id: conversationId,
          },
        }),
        this.prisma.user.findUnique({
          where: {
            id: senderId,
          },
        }),
      ]);

      if (!existingConversation) {
        throw new Error("La conversation n'existe pas.");
      }

      if (!existingUser) {
        throw new Error("L'utilisateur n'existe pas.");
      }

      // Mise à jour de la conversation avec un nouveau message
      const updatedConversation = await this.prisma.conversation.update({
        where: {
          id: existingConversation.id,
        },
        data: {
          messages: {
            create: {
              content: sendChatDto.content,
              sender: {
                connect: {
                  id: existingUser.id,
                },
              },
            },
          },
        },
        select: {
          id: true,
          messages: {
            select: {
              content: true,
              id: true,
              sender: {
                select: {
                  id: true,
                  firstName: true,
                },
              },
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

      console.log(updatedConversation);

      return {
        error: false,
        message: 'Votre message a bien été envoyé.',
      };
    } catch (error) {
      console.error(error);
      return {
        error: true,
        message: error.message,
      };
    }
  }

  async getConversations({ userId }: { userId: string }) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        conversations: {
          select: {
            id: true,
            updatedAt: true,
            users: {
              select: {
                id: true,
                firstName: true,
              },
            },
            messages: {
              select: {
                content: true,
                id: true,
                sender: {
                  select: {
                    id: true,
                    firstName: true,
                  },
                },
              },
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
        },
      },
    });
    if (!existingUser) {
      throw new Error("L'utilisateur n'existe pas.");
    }
    const conversation = await Promise.all(
      existingUser.conversations.map(async (conversation) => {
        return {
          ...conversation,
          users: await Promise.all(
            conversation.users.map(async (user) => {
              return user;
            }),
          ),
        };
      }),
    );

    return conversation;
  }

  async likeMessage(likeMessageDto: LikeMessageDTO) {
    const user = await this.prisma.user.findUnique({
      where: { id: likeMessageDto.userId },
    });

    if (!user) {
      throw new NotFoundException("L'utilisateur n'existe pas.");
    }
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: likeMessageDto.messageId },
    });

    if (!message) {
      throw new NotFoundException("Le message n'existe pas.");
    }

    return this.prisma.like.create({
      data: {
        user: { connect: { id: likeMessageDto.userId } },
        message: { connect: { id: likeMessageDto.messageId } },
      },
    });
  }

  async commentMessage(commentMessageDTO: CommentMessageDTO) {
    const user = await this.prisma.user.findUnique({
      where: { id: commentMessageDTO.userId },
    });

    if (!user) {
      throw new NotFoundException("L'utilisateur n'existe pas.");
    }
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: commentMessageDTO.messageId },
    });

    if (!message) {
      throw new NotFoundException("Le message n'existe pas.");
    }

    return this.prisma.comment.create({
      data: {
        content: commentMessageDTO.content,
        user: { connect: { id: commentMessageDTO.userId } },
        message: { connect: { id: commentMessageDTO.messageId } },
      },
    });
  }

  async getMessageInteractions(messageId: string) {
    return this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { likes: true, comments: true },
    });
  }

  async getConversation({
    userId,
    conversationId,
  }: {
    userId: string;
    conversationId: string;
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (!existingUser) {
      throw new Error("L'utilisateur n'existe pas.");
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      select: {
        id: true,
        updatedAt: true,
        users: {
          select: {
            firstName: true,
            id: true,
          },
        },
        messages: {
          select: {
            content: true,
            id: true,
            sender: {
              select: {
                id: true,
                firstName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
    if (!conversation) {
      throw new Error("Cette conversation n'existe pas.");
    }

    return conversation;
  }
}

export type LikeMessageDTO = {
  messageId: string;
  userId: string;
};

export type CommentMessageDTO = {
  messageId: string;
  content: string;
  userId: string;
};
