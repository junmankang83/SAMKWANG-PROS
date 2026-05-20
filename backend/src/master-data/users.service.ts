import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ErpUserRow, UserRow } from '@samkwang/shared';
import * as bcrypt from 'bcryptjs';
import { ErpUsersService } from '../external/erp/erp-users.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserDto } from './dto/user.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly erpUsers: ErpUsersService,
  ) {}

  async list(): Promise<UserRow[]> {
    const rows = await this.prisma.user.findMany({
      orderBy: [{ username: 'asc' }],
      select: {
        id: true,
        username: true,
        name: true,
        organization: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      organization: u.organization,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }));
  }

  async listErpUsers(q?: string): Promise<ErpUserRow[]> {
    const [erpRows, existing] = await Promise.all([
      this.erpUsers.listUsers(q),
      this.prisma.user.findMany({ select: { username: true } }),
    ]);
    const taken = new Set(existing.map((u) => u.username.toLowerCase()));
    return erpRows.filter((row) => !taken.has(row.userId.toLowerCase()));
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
        name: dto.name.trim(),
        passwordHash,
        organization: dto.organization.trim(),
      },
      select: {
        id: true,
        username: true,
        name: true,
        organization: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return {
      id: user.id,
      username: user.username,
      name: user.name,
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
