import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthLoginResponse, AuthMeResponse, AuthRegisterResponse } from '@samkwang/shared';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtSessionPayload } from './jwt-session.payload';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async register(
    username: string,
    password: string,
    organization: string,
  ): Promise<AuthRegisterResponse> {
    const normalized = username.trim();
    const org = organization.trim();
    const existing = await this.prisma.user.findUnique({
      where: { username: normalized },
    });
    if (existing) {
      throw new ConflictException('이미 사용 중인 아이디입니다.');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        username: normalized,
        passwordHash,
        organization: org,
      },
    });

    return {
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        organization: user.organization,
      },
    };
  }

  async login(username: string, password: string): Promise<AuthLoginResponse> {
    const normalized = username.trim();
    const dbUser = await this.prisma.user.findUnique({
      where: { username: normalized },
    });
    if (dbUser) {
      const valid = await bcrypt.compare(password, dbUser.passwordHash);
      if (!valid) {
        throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다.');
      }
      return {
        ok: true,
        user: {
          id: dbUser.id,
          username: dbUser.username,
          organization: dbUser.organization,
        },
      };
    }

    const demoUser = process.env.DEMO_AUTH_USERNAME ?? 'demo';
    const demoPass = process.env.DEMO_AUTH_PASSWORD ?? 'demo';
    if (normalized !== demoUser || password !== demoPass) {
      throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다.');
    }
    return {
      ok: true,
      user: { id: 'demo', username: demoUser },
    };
  }

  createSessionToken(userId: string, username: string): string {
    const payload: JwtSessionPayload = { sub: userId, username };
    return this.jwtService.sign(payload);
  }

  async me(session: JwtSessionPayload | undefined): Promise<AuthMeResponse> {
    if (!session) {
      throw new UnauthorizedException();
    }

    if (session.sub !== 'demo') {
      const user = await this.prisma.user.findUnique({
        where: { id: session.sub },
      });
      if (user) {
        return {
          user: {
            id: user.id,
            username: user.username,
            organization: user.organization,
          },
        };
      }
    }

    return { user: { id: session.sub, username: session.username } };
  }
}
