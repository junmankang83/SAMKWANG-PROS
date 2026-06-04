import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { MailMenuService } from './mail-menu.service';
import { CreateMailMenuDto, MailMenuSendNowDto, UpdateMailMenuDto } from './dto/mail-menu.dto';

@Controller('mail/menus')
export class MailMenuController {
  constructor(private readonly menus: MailMenuService) {}

  @Get()
  list() {
    return this.menus.list();
  }

  @Post()
  create(@Body() dto: CreateMailMenuDto) {
    return this.menus.create(dto);
  }

  @Post(':id/send-now')
  sendNow(@Param('id') id: string, @Body() dto: MailMenuSendNowDto) {
    return this.menus.sendNow(id, dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.menus.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMailMenuDto) {
    return this.menus.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.menus.remove(id);
  }
}
