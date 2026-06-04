import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { MailOpenService } from './mail-open.service';

/** 1×1 투명 GIF (RFC 2397 대체: 최소 바이너리) */
const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

@Controller('mail')
export class MailOpenController {
  constructor(private readonly mailOpen: MailOpenService) {}

  @Public()
  @Get('open')
  async openPixel(@Query('t') token: string | undefined, @Res() res: Response): Promise<void> {
    await this.mailOpen.recordOpenIfValid(token);
    res
      .status(200)
      .type('image/gif')
      .setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
      .setHeader('Pragma', 'no-cache')
      .send(PIXEL_GIF);
  }
}
