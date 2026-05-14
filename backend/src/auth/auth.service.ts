import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthLoginResponse, AuthMeResponse } from '@samkwang/shared';
import type { JwtSessionPayload } from './jwt-session.payload';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  login(username: string, password: string): AuthLoginResponse {
    const demoUser = process.env.DEMO_AUTH_USERNAME ?? 'demo';
    const demoPass = process.env.DEMO_AUTH_PASSWORD ?? 'demo';
    if (username !== demoUser || password !== demoPass) {
      throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다.');
    }
    return {
      ok: true,
      user: { id: 'demo', username: demoUser },
    };
  }

  createSessionToken(username: string): string {
    const payload: JwtSessionPayload = { sub: 'demo', username };
    return this.jwtService.sign(payload);
  }

  me(session: JwtSessionPayload | undefined): AuthMeResponse {
    if (!session) {
      throw new UnauthorizedException();
    }
    return { user: { id: session.sub, username: session.username } };
  }
}
