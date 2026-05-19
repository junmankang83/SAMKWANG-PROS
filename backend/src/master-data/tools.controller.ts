import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  CreateToolDto,
  ToolListQueryDto,
  ToolsSyncBodyDto,
  ToolsSyncQueryDto,
  UpdateToolDto,
} from './dto/tools.dto';
import { ToolsService } from './tools.service';

@Controller('master-data/tools')
export class ToolsController {
  constructor(private readonly tools: ToolsService) {}

  @Get()
  list(@Query() query: ToolListQueryDto) {
    const activeOnly = query.activeOnly !== false;
    return this.tools.list(query.q, activeOnly);
  }

  @Get('sync/preview')
  syncPreview(@Query() query: ToolsSyncQueryDto) {
    return this.tools.listSyncPreview(query.q);
  }

  @Post('sync')
  syncApply(@Body() body: ToolsSyncBodyDto) {
    return this.tools.syncFromErp(body?.toolSeqs);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.tools.getById(id);
  }

  @Post()
  create(@Body() dto: CreateToolDto, @Req() req: Request) {
    return this.tools.create(dto, req.sessionUser?.username);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateToolDto, @Req() req: Request) {
    return this.tools.update(id, dto, req.sessionUser?.username);
  }

  @Delete()
  removeAll() {
    return this.tools.removeAll();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tools.remove(id);
  }
}
