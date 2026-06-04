import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { MailSmtpService } from './mail-smtp.service';
import { CreateMailSmtpProfileDto, MailSmtpTestDto, UpdateMailSmtpProfileDto } from './dto/mail-smtp.dto';

@Controller('mail/smtp')
export class MailSmtpController {
  constructor(private readonly mailSmtp: MailSmtpService) {}

  @Get()
  list() {
    return this.mailSmtp.list();
  }

  @Post()
  create(@Body() dto: CreateMailSmtpProfileDto) {
    return this.mailSmtp.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.mailSmtp.get(id);
  }

  @Put(':id')
  put(@Param('id') id: string, @Body() dto: UpdateMailSmtpProfileDto) {
    return this.mailSmtp.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mailSmtp.remove(id);
  }

  @Post(':id/test')
  test(@Param('id') id: string, @Body() dto: MailSmtpTestDto) {
    return this.mailSmtp.sendTest(id, dto.toAddresses);
  }
}
