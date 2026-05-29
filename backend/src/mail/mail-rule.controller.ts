import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { MailRuleService } from './mail-rule.service';
import { CreateMailSendRuleDto, UpdateMailSendRuleDto } from './dto/mail-rule.dto';

@Controller('mail/rules')
export class MailRuleController {
  constructor(private readonly rules: MailRuleService) {}

  @Get()
  list() {
    return this.rules.list();
  }

  @Get(':id/logs')
  logs(@Param('id') id: string, @Query('take') take?: string) {
    const n = take != null ? Math.min(200, Math.max(1, Number(take) || 50)) : 50;
    return this.rules.listLogs(id, n);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.rules.get(id);
  }

  @Post()
  create(@Body() dto: CreateMailSendRuleDto) {
    return this.rules.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMailSendRuleDto) {
    return this.rules.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.rules.remove(id);
  }
}
