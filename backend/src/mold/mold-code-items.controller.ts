import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  CreateMoldCodeItemDto,
  UpdateMoldCodeItemDto,
} from './dto/mold-code.dto';
import { MoldCodesService } from './mold-codes.service';

@Controller('mold/code-groups/:groupId/items')
export class MoldCodeItemsController {
  constructor(private readonly moldCodes: MoldCodesService) {}

  @Get()
  list(@Param('groupId') groupId: string) {
    return this.moldCodes.listItems(groupId);
  }

  @Post()
  create(@Param('groupId') groupId: string, @Body() dto: CreateMoldCodeItemDto) {
    return this.moldCodes.createItem(groupId, dto);
  }

  @Patch(':itemId')
  update(
    @Param('groupId') groupId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMoldCodeItemDto,
  ) {
    return this.moldCodes.updateItem(groupId, itemId, dto);
  }

  @Delete(':itemId')
  remove(@Param('groupId') groupId: string, @Param('itemId') itemId: string) {
    return this.moldCodes.removeItem(groupId, itemId);
  }
}
