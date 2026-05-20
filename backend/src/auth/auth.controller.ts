import { Body, Controller, Get, Patch, Post, Req, Res } from '@nestjs/common';
import type { AuthLogoutResponse } from '@samkwang/shared';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { SESSION_COOKIE_NAME } from './auth.constants';
import { AuthLoginDto } from './dto/auth-login.dto';
import { AuthChangePasswordDto } from './dto/auth-change-password.dto';
import { AuthRegisterDto } from './dto/auth-register.dto';

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function setSessionCookie(res: Response, token: string): void {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_MAX_AGE_MS,
  });
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(
    @Body() body: AuthRegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(
      body.username,
      body.password,
      body.organization,
    );
    const token = this.authService.createSessionToken(
      result.user.id,
      result.user.username,
    );
    setSessionCookie(res, token);
    return result;
  }

  @Public()
  @Post('login')
  async login(
    @Body() body: AuthLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body.username, body.password);
    const token = this.authService.createSessionToken(
      result.user.id,
      result.user.username,
    );
    setSessionCookie(res, token);
    return result;
  }

  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): AuthLogoutResponse {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  async me(@Req() req: Request) {
    return this.authService.me(req.sessionUser);
  }

  @Patch('password')
  changePassword(@Req() req: Request, @Body() body: AuthChangePasswordDto) {
    return this.authService.changePassword(
      req.sessionUser,
      body.currentPassword,
      body.newPassword,
    );
  }
}
