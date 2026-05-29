import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { MailSmtpService } from './mail-smtp.service';
import { MailSmtpTestDto, UpsertMailSmtpDto } from './dto/mail-smtp.dto';

@Controller('mail/smtp')
export class MailSmtpController {
  constructor(private readonly mailSmtp: MailSmtpService) {}

  @Get()
  get() {
    return this.mailSmtp.getSettings();
  }

  @Put()
  put(@Body() dto: UpsertMailSmtpDto) {
    return this.mailSmtp.upsertSettings(dto);
  }

  @Post('test')
  test(@Body() dto: MailSmtpTestDto) {
    return this.mailSmtp.sendTest(dto.to);
  }
}
