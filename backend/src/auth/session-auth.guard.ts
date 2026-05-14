import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY, SESSION_COOKIE_NAME } from './auth.constants';
import type { JwtSessionPayload } from './jwt-session.payload';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('로그인이 필요합니다.');
    }

    try {
      const payload = this.jwtService.verify<JwtSessionPayload>(token);
      req.sessionUser = payload;
      return true;
    } catch {
      throw new UnauthorizedException('세션이 만료되었거나 유효하지 않습니다.');
    }
  }
}
