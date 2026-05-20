import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CreateUserDto, ErpUserListQueryDto } from './dto/user.dto';
import { UsersService } from './users.service';

@Controller('master-data/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Get('erp')
  listErp(@Query() query: ErpUserListQueryDto) {
    return this.users.listErpUsers(query.q);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.users.remove(id);
  }
}
