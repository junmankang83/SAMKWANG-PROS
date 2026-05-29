import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMailMenuDto, UpdateMailMenuDto } from './dto/mail-menu.dto';

@Injectable()
export class MailMenuService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.mailMenu.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] });
  }

  async get(id: string) {
    const row = await this.prisma.mailMenu.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('메뉴를 찾을 수 없습니다.');
    }
    return row;
  }

  async create(dto: CreateMailMenuDto) {
    const code = dto.code.trim();
    const clash = await this.prisma.mailMenu.findUnique({ where: { code } });
    if (clash) {
      throw new BadRequestException('이미 사용 중인 code입니다.');
    }
    return this.prisma.mailMenu.create({
      data: {
        code,
        label: dto.label.trim(),
        defaultSubject: (dto.defaultSubject ?? '').trim(),
        defaultBody: dto.defaultBody ?? '',
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateMailMenuDto) {
    await this.get(id);
    if (dto.code != null) {
      const code = dto.code.trim();
      const clash = await this.prisma.mailMenu.findFirst({ where: { code, NOT: { id } } });
      if (clash) {
        throw new BadRequestException('이미 사용 중인 code입니다.');
      }
    }
    return this.prisma.mailMenu.update({
      where: { id },
      data: {
        code: dto.code?.trim(),
        label: dto.label?.trim(),
        defaultSubject: dto.defaultSubject === undefined ? undefined : dto.defaultSubject.trim(),
        defaultBody: dto.defaultBody,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.mailMenu.delete({ where: { id } });
  }
}
