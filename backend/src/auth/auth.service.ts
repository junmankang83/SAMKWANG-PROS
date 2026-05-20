import {
  BadRequestException,
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
          name: dbUser.name,
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
            name: user.name,
            organization: user.organization,
          },
        };
      }
    }

    return { user: { id: session.sub, username: session.username } };
  }

  async changePassword(
    session: JwtSessionPayload | undefined,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    if (!session) {
      throw new UnauthorizedException();
    }
    if (session.sub === 'demo') {
      throw new BadRequestException('데모 계정은 비밀번호를 변경할 수 없습니다.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.sub } });
    if (!user) {
      throw new UnauthorizedException();
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new BadRequestException('현재 비밀번호가 올바르지 않습니다.');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return { ok: true };
  }
}
