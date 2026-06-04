import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { MailSendLogsService } from './mail-send-logs.service';

@Controller('mail/send-logs')
export class MailSendLogsController {
  constructor(private readonly logs: MailSendLogsService) {}

  @Get()
  list(@Query('take') takeRaw?: string) {
    const raw = takeRaw?.trim();
    if (raw != null && raw !== '' && !/^\d+$/.test(raw)) {
      throw new BadRequestException('take는 1~500 사이의 정수여야 합니다.');
    }
    const n = raw ? parseInt(raw, 10) : 100;
    const take = Math.min(500, Math.max(1, Number.isNaN(n) ? 100 : n));
    return this.logs.listUnified(take);
  }
}
