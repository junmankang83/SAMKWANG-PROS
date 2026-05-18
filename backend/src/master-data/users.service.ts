import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { UserRow } from '@samkwang/shared';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserDto } from './dto/user.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<UserRow[]> {
    const rows = await this.prisma.user.findMany({
      orderBy: [{ username: 'asc' }],
      select: {
        id: true,
        username: true,
        organization: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows.map((u) => ({
      id: u.id,
      username: u.username,
      organization: u.organization,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }));
  }

  async create(dto: CreateUserDto): Promise<UserRow> {
    const normalized = dto.username.trim();
    const existing = await this.prisma.user.findUnique({
      where: { username: normalized },
    });
    if (existing) {
      throw new ConflictException('이미 사용 중인 아이디입니다.');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        username: normalized,
        passwordHash,
        organization: dto.organization.trim(),
      },
      select: {
        id: true,
        username: true,
        organization: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return {
      id: user.id,
      username: user.username,
      organization: user.organization,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async remove(id: string): Promise<{ ok: true }> {
    try {
      await this.prisma.user.delete({ where: { id } });
      return { ok: true };
    } catch {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }
  }
}
