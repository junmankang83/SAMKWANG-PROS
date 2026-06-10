import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CronExpressionParser } from 'cron-parser';
import { MailScheduleType, MailSendLogStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMailSendRuleDto, ManualSendDto, UpdateMailSendRuleDto } from './dto/mail-rule.dto';
import { MailDeliveryService } from './mail-delivery.service';
import { MailSmtpService } from './mail-smtp.service';
import { buildMailOpenPixelUrl, resolveMailTrackingPublicApiBase } from './mail-tracking-url';
import { generateOpenTrackingToken } from './mail-send-token';
import { normalizeCronToSixFields, mailSubjectWithSeoulSendDate } from './mail-schedule.util';
import { createMailSendLogWithColumnFallback } from './mail-send-log-fallback';
import { MailMenuReportService } from './mail-menu-report.service';
import { subjectToXlsxFilename } from './mail-report-xlsx.util';

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

function normalizeManualSendTimes(times: string[] | undefined): string[] {
  if (!times?.length) {
    return [];
  }
  const out: string[] = [];
  for (const t of times) {
    const s = (t ?? '').trim();
    if (!s) {
      continue;
    }
    if (!/^\d{1,2}:\d{2}$/.test(s)) {
      throw new BadRequestException(`sendTimes 항목은 HH:mm 형식이어야 합니다: ${String(t).slice(0, 20)}`);
    }
    const [hh, mm] = s.split(':');
    const h = parseInt(hh, 10);
    const m = parseInt(mm, 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      throw new BadRequestException(`sendTimes 범위가 올바르지 않습니다: ${s}`);
    }
    out.push(`${String(h).padStart(2, '0')}:${mm}`);
  }
  return out;
}

@Injectable()
export class MailRuleService {
  private readonly logger = new Logger(MailRuleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smtp: MailSmtpService,
    private readonly delivery: MailDeliveryService,
    private readonly menuReport: MailMenuReportService,
  ) {}

  list() {
    return this.prisma.mailSendRule.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        mailMenu: { select: { id: true, code: true, label: true } },
        mailSmtpProfile: { select: { id: true, name: true } },
      },
    });
  }

  async get(id: string) {
    const row = await this.prisma.mailSendRule.findUnique({
      where: { id },
      include: { mailMenu: true, mailSmtpProfile: true },
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
    const profileId = dto.mailSmtpProfileId.trim();
    const profile = await this.prisma.mailSmtpProfile.findUnique({ where: { id: profileId } });
    if (!profile) {
      throw new BadRequestException('mailSmtpProfileId가 유효하지 않습니다.');
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
        mailSmtpProfileId: profileId,
      },
      include: {
        mailMenu: { select: { id: true, code: true, label: true } },
        mailSmtpProfile: { select: { id: true, name: true } },
      },
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
    if (dto.mailSmtpProfileId !== undefined) {
      const pid = dto.mailSmtpProfileId.trim();
      if (!pid) {
        throw new BadRequestException('mailSmtpProfileId는 비울 수 없습니다.');
      }
      const p = await this.prisma.mailSmtpProfile.findUnique({ where: { id: pid } });
      if (!p) {
        throw new BadRequestException('mailSmtpProfileId가 유효하지 않습니다.');
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
        mailSmtpProfileId: dto.mailSmtpProfileId === undefined ? undefined : dto.mailSmtpProfileId.trim(),
      },
      include: {
        mailMenu: { select: { id: true, code: true, label: true } },
        mailSmtpProfile: { select: { id: true, name: true } },
      },
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

  /**
   * 스케줄과 무관하게 즉시 발송. 수신·제목·본문은 규칙을 따르고,
   * 제목/본문이 비어 있으면 선택한 메뉴(메뉴관리)의 기본 제목·본문을 사용합니다.
   * additionalToAddresses 가 있으면 규칙 수신자에 합칩니다(중복 제거).
   * sendDaysMask / sendTimes 는 형식만 검증합니다(즉시 발송은 버튼 시점에 실행).
   * lastRunSlotUtc 는 갱신하지 않습니다.
   */
  async sendNow(ruleId: string, dto: ManualSendDto): Promise<{ ok: true; messageId?: string }> {
    const mailMenuId = dto.mailMenuId.trim();
    if (dto.sendDaysMask !== undefined && dto.sendDaysMask !== null && dto.sendDaysMask === 0) {
      throw new BadRequestException('발송 요일을 하나 이상 선택하세요.');
    }
    normalizeManualSendTimes(dto.sendTimes);

    const rule = await this.prisma.mailSendRule.findUnique({ where: { id: ruleId } });
    if (!rule) {
      throw new NotFoundException('발송 정보(규칙)를 찾을 수 없습니다.');
    }
    const menu = await this.prisma.mailMenu.findUnique({
      where: { id: mailMenuId },
      select: { id: true, code: true, label: true, defaultSubject: true, defaultBody: true },
    });
    if (!menu) {
      throw new BadRequestException('선택한 메뉴를 찾을 수 없습니다.');
    }
    const overridePid = dto.mailSmtpProfileId?.trim();
    if (overridePid) {
      const p = await this.prisma.mailSmtpProfile.findUnique({ where: { id: overridePid } });
      if (!p) {
        throw new BadRequestException('선택한 SMTP 프로필을 찾을 수 없습니다.');
      }
    }
    const cfg = await this.smtp.resolveSmtpSecrets(overridePid || rule.mailSmtpProfileId);
    if (!cfg) {
      throw new BadRequestException('SMTP 설정이 없습니다. 메일설정을 확인하세요.');
    }
    const baseTo = this.toAddressesFromRow(rule).map((x) => x.trim()).filter(Boolean);
    const extra = (dto.additionalToAddresses ?? []).map((x) => x.trim()).filter(Boolean);
    const to = [...baseTo];
    for (const e of extra) {
      if (!to.includes(e)) {
        to.push(e);
      }
    }
    if (to.length === 0) {
      throw new BadRequestException('수신 이메일이 없습니다. 발송정보 또는 추가 수신자를 입력하세요.');
    }
    let subject = (rule.subject ?? '').trim();
    let body = rule.body ?? '';
    if (!subject) {
      subject = (menu.defaultSubject ?? '').trim();
    }
    if (!body.trim()) {
      body = menu.defaultBody ?? '';
    }
    if (!subject) {
      subject = '(제목 없음)';
    }
    const sendAt = new Date();
    subject = mailSubjectWithSeoulSendDate(subject, sendAt);
    const report = await this.menuReport.appendMenuDataReport(body, { label: menu.label, code: menu.code }, sendAt);
    body = report.text;
    const apiBase = resolveMailTrackingPublicApiBase();
    const openToken = apiBase ? generateOpenTrackingToken() : null;
    const openPixelUrl = apiBase && openToken ? buildMailOpenPixelUrl(apiBase, openToken) : undefined;
    try {
      const res = await this.delivery.send({
        fromName: cfg.fromName || 'SAMKWANG-PROS',
        fromAddress: cfg.fromAddress,
        to,
        subject,
        text: body,
        mailHtmlStructuredIntro: report.mailHtmlStructuredIntro,
        mailHtmlTableFragment: report.mailHtmlTableFragment,
        openPixelUrl,
        mailHtmlBannerTitle: menu.label.trim() || subject,
        mailHtmlBannerSendAt: sendAt,
        excelAttachment:
          report.excelDataBuffer && report.excelDataBuffer.length > 0
            ? { filename: subjectToXlsxFilename(subject), content: report.excelDataBuffer }
            : undefined,
        smtp: {
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          user: cfg.user,
          password: cfg.password,
        },
      });
      try {
        await createMailSendLogWithColumnFallback(this.prisma, this.logger, {
          ruleId: rule.id,
          sentAt: new Date(),
          status: MailSendLogStatus.SUCCESS,
          errorMessage: null,
          smtpMessageId: res.messageId ?? null,
          toSnapshotJson: to as unknown as Prisma.InputJsonValue,
          openTrackingToken: openToken,
        });
      } catch (logErr) {
        const detail = logErr instanceof Error ? logErr.message : String(logErr);
        this.logger.error(`SMTP 발송은 성공했으나 MailSendLog 저장 실패(rule=${rule.id}): ${detail}`);
        throw new HttpException(
          `메일은 발송되었으나 발송 이력을 저장하지 못했습니다. DB 마이그레이션(prisma migrate deploy)과 prisma generate 적용 여부를 확인하세요. (${detail})`,
          HttpStatus.BAD_REQUEST,
        );
      }
      return { ok: true, messageId: res.messageId };
    } catch (e) {
      if (e instanceof HttpException) {
        throw e;
      }
      const msg = e instanceof Error ? e.message : String(e);
      this.delivery.logError(e, `manual send rule ${rule.id}`);
      try {
        await createMailSendLogWithColumnFallback(this.prisma, this.logger, {
          ruleId: rule.id,
          sentAt: new Date(),
          status: MailSendLogStatus.FAILURE,
          errorMessage: msg,
          smtpMessageId: null,
          toSnapshotJson: to as unknown as Prisma.InputJsonValue,
          openTrackingToken: null,
        });
      } catch (logErr) {
        this.logger.error(`MailSendLog(FAILURE) 저장 실패(rule=${rule.id}): ${logErr instanceof Error ? logErr.message : String(logErr)}`);
      }
      throw new BadRequestException(`메일 발송에 실패했습니다: ${msg}`);
    }
  }
}
