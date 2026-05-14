import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { AuthLogoutResponse } from '@samkwang/shared';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { SESSION_COOKIE_NAME } from './auth.constants';
import { AuthLoginDto } from './dto/auth-login.dto';

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(
    @Body() body: AuthLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = this.authService.login(body.username, body.password);
    const token = this.authService.createSessionToken(result.user.username);
    const secure = process.env.NODE_ENV === 'production';
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: SESSION_MAX_AGE_MS,
    });
    return result;
  }

  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): AuthLogoutResponse {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  me(@Req() req: Request) {
    return this.authService.me(req.sessionUser);
  }
}
