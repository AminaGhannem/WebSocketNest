import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'bcrypt';
import { PrismaService } from 'src/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register({ registerBody }: { registerBody: CreateUserDto }) {
    try {
      const { email, firstName, password } = registerBody;

      const existingUser = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (existingUser) {
        throw new Error('Un compte existe déjà à cette adresse email.');
      }

      const hashedPassword = await this.hashPassword({ password });

      const createdUser = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
        },
      });

      return this.authenticateUser({
        userId: createdUser.id,
      });
    } catch (error) {
      return {
        error: true,
        message: error.message,
      };
    }
  }

  private async hashPassword({ password }: { password: string }) {
    const hashedPassword = await hash(password, 10);
    return hashedPassword;
  }

  private authenticateUser({ userId }: UserPayload) {
    const payload: UserPayload = { userId };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
