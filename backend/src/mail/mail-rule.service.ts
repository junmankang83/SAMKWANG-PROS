import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CronExpressionParser } from 'cron-parser';
import { MailScheduleType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMailSendRuleDto, UpdateMailSendRuleDto } from './dto/mail-rule.dto';
import { normalizeCronToSixFields } from './mail-schedule.util';

function asStringArray(json: Prisma.JsonValue): string[] {
  if (!Array.isArray(json)) {
    return [];
  }
  return json.filter((x): x is string => typeof x === 'string');
}
function validateSchedule(
  scheduleType: MailScheduleType,
  cronExpression: string | null | undefined,
  dailyTime: string | null | undefined,
): void {
  if (scheduleType === 'DAILY') {
    const t = (dailyTime ?? '').trim();
    if (!/^\d{1,2}:\d{2}$/.test(t)) {
      throw new BadRequestException('DAILY 스케줄은 dailyTime(HH:mm)이 필요합니다.');
    }
  } else if (scheduleType === 'CRON') {
    const c = (cronExpression ?? '').trim();
    if (!c) {
      throw new BadRequestException('CRON 스케줄은 cronExpression이 필요합니다.');
    }
    try {
      CronExpressionParser.parse(normalizeCronToSixFields(c), { tz: 'Asia/Seoul' });
    } catch {
      throw new BadRequestException('cronExpression 형식이 올바르지 않습니다.');
    }
  }
}

@Injectable()
export class MailRuleService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.mailSendRule.findMany({
      orderBy: { createdAt: 'desc' },
      include: { mailMenu: { select: { id: true, code: true, label: true } } },
    });
  }

  async get(id: string) {
    const row = await this.prisma.mailSendRule.findUnique({
      where: { id },
      include: { mailMenu: true },
    });
    if (!row) {
      throw new NotFoundException('규칙을 찾을 수 없습니다.');
    }
    return row;
  }

  async create(dto: CreateMailSendRuleDto) {
    validateSchedule(dto.scheduleType, dto.cronExpression, dto.dailyTime);
    if (dto.mailMenuId) {
      const m = await this.prisma.mailMenu.findUnique({ where: { id: dto.mailMenuId } });
      if (!m) {
        throw new BadRequestException('mailMenuId가 유효하지 않습니다.');
      }
    }
    const mask = dto.dailyDaysMask ?? 127;
    return this.prisma.mailSendRule.create({
      data: {
        name: dto.name.trim(),
        enabled: dto.enabled ?? true,
        scheduleType: dto.scheduleType,
        cronExpression: dto.cronExpression?.trim() || null,
        dailyTime: dto.dailyTime?.trim() || null,
        dailyDaysMask: mask,
        toAddresses: dto.toAddresses as unknown as Prisma.InputJsonValue,
        subject: dto.subject.trim(),
        body: dto.body,
        mailMenuId: dto.mailMenuId?.trim() || null,
      },
      include: { mailMenu: { select: { id: true, code: true, label: true } } },
    });
  }

  async update(id: string, dto: UpdateMailSendRuleDto) {
    const existing = await this.prisma.mailSendRule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('규칙을 찾을 수 없습니다.');
    }
    const scheduleType = dto.scheduleType ?? existing.scheduleType;
    const cron = dto.cronExpression !== undefined ? dto.cronExpression : existing.cronExpression;
    const daily = dto.dailyTime !== undefined ? dto.dailyTime : existing.dailyTime;
    validateSchedule(scheduleType, cron, daily);
    if (dto.mailMenuId !== undefined && dto.mailMenuId) {
      const m = await this.prisma.mailMenu.findUnique({ where: { id: dto.mailMenuId } });
      if (!m) {
        throw new BadRequestException('mailMenuId가 유효하지 않습니다.');
      }
    }
    return this.prisma.mailSendRule.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        enabled: dto.enabled,
        scheduleType: dto.scheduleType,
        cronExpression: dto.cronExpression === undefined ? undefined : dto.cronExpression?.trim() || null,
        dailyTime: dto.dailyTime === undefined ? undefined : dto.dailyTime?.trim() || null,
        dailyDaysMask: dto.dailyDaysMask,
        toAddresses:
          dto.toAddresses === undefined ? undefined : (dto.toAddresses as unknown as Prisma.InputJsonValue),
        subject: dto.subject?.trim(),
        body: dto.body,
        mailMenuId: dto.mailMenuId === undefined ? undefined : dto.mailMenuId?.trim() || null,
      },
      include: { mailMenu: { select: { id: true, code: true, label: true } } },
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.mailSendRule.delete({ where: { id } });
  }

  listLogs(ruleId: string, take = 50) {
    return this.prisma.mailSendLog.findMany({
      where: { ruleId },
      orderBy: { sentAt: 'desc' },
      take,
    });
  }

  toAddressesFromRow(row: { toAddresses: Prisma.JsonValue }): string[] {
    return asStringArray(row.toAddresses);
  }
}
