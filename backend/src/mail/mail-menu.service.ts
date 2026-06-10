import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MailSendLogStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMailMenuDto, MailMenuSendNowDto, UpdateMailMenuDto } from './dto/mail-menu.dto';
import { MailDeliveryService } from './mail-delivery.service';
import { MailSmtpService } from './mail-smtp.service';
import { buildMailOpenPixelUrl, resolveMailTrackingPublicApiBase } from './mail-tracking-url';
import { generateOpenTrackingToken } from './mail-send-token';
import { mailSubjectWithSeoulSendDate } from './mail-schedule.util';
import { createMailMenuSendLogWithColumnFallback } from './mail-send-log-fallback';
import { MailMenuReportService } from './mail-menu-report.service';
import { subjectToXlsxFilename } from './mail-report-xlsx.util';

function normalizeRecipientEmails(emails: string[] | undefined): string[] {
  if (!emails?.length) {
    return [];
  }
  return emails.map((e) => e.trim()).filter(Boolean);
}

/** HH:mm → 정규화된 HH:mm (시간 2자리) */
function normalizeSendTimes(times: string[] | undefined): string[] {
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
export class MailMenuService {
  private readonly logger = new Logger(MailMenuService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smtp: MailSmtpService,
    private readonly delivery: MailDeliveryService,
    private readonly menuReport: MailMenuReportService,
  ) {}

  private async normalizeOptionalMenuSmtpProfileId(raw: string | null | undefined): Promise<string | null> {
    if (raw === undefined || raw === null) {
      return null;
    }
    const t = String(raw).trim();
    if (!t) {
      return null;
    }
    const p = await this.prisma.mailSmtpProfile.findUnique({ where: { id: t } });
    if (!p) {
      throw new BadRequestException('SMTP 프로필 ID가 유효하지 않습니다.');
    }
    return t;
  }

  list() {
    return this.prisma.mailMenu.findMany({
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      include: { mailSmtpProfile: { select: { id: true, name: true } } },
    });
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
    const recipientEmails = normalizeRecipientEmails(dto.recipientEmails);
    const sendTimes = normalizeSendTimes(dto.sendTimes);
    const smtpId = dto.mailSmtpProfileId !== undefined ? await this.normalizeOptionalMenuSmtpProfileId(dto.mailSmtpProfileId) : undefined;
    return this.prisma.mailMenu.create({
      data: {
        code,
        label: dto.label.trim(),
        defaultSubject: (dto.defaultSubject ?? '').trim(),
        defaultBody: dto.defaultBody ?? '',
        sortOrder: dto.sortOrder ?? 0,
        menuQuery: dto.menuQuery ?? '',
        recipientEmails: recipientEmails as unknown as Prisma.InputJsonValue,
        sendDaysMask: dto.sendDaysMask ?? 127,
        sendTimes: sendTimes as unknown as Prisma.InputJsonValue,
        ...(smtpId !== undefined ? { mailSmtpProfileId: smtpId } : {}),
        ...(dto.scheduleAutoSendEnabled !== undefined ? { scheduleAutoSendEnabled: dto.scheduleAutoSendEnabled } : {}),
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
    let sendTimesJson: Prisma.InputJsonValue | undefined;
    if (dto.sendTimes !== undefined) {
      sendTimesJson = normalizeSendTimes(dto.sendTimes) as unknown as Prisma.InputJsonValue;
    }
    let recipientJson: Prisma.InputJsonValue | undefined;
    if (dto.recipientEmails !== undefined) {
      recipientJson = normalizeRecipientEmails(dto.recipientEmails) as unknown as Prisma.InputJsonValue;
    }
    let smtpPatch: string | null | undefined;
    if (dto.mailSmtpProfileId !== undefined) {
      smtpPatch = await this.normalizeOptionalMenuSmtpProfileId(dto.mailSmtpProfileId);
    }
    return this.prisma.mailMenu.update({
      where: { id },
      data: {
        code: dto.code?.trim(),
        label: dto.label?.trim(),
        defaultSubject: dto.defaultSubject === undefined ? undefined : dto.defaultSubject.trim(),
        defaultBody: dto.defaultBody,
        sortOrder: dto.sortOrder,
        menuQuery: dto.menuQuery === undefined ? undefined : dto.menuQuery,
        recipientEmails: recipientJson,
        sendDaysMask: dto.sendDaysMask,
        sendTimes: sendTimesJson,
        ...(smtpPatch !== undefined ? { mailSmtpProfileId: smtpPatch } : {}),
        ...(dto.scheduleAutoSendEnabled !== undefined ? { scheduleAutoSendEnabled: dto.scheduleAutoSendEnabled } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.mailMenu.delete({ where: { id } });
  }

  /**
   * 메뉴의 기본 제목·본문으로 즉시 발송. SMTP는 dto → 메뉴 저장값 → 첫 프로필 순.
   * 성공/실패는 MailMenuSendLog 에만 기록합니다(규칙 로그와 무관).
   */
  async sendNow(menuId: string, dto: MailMenuSendNowDto): Promise<{ ok: true; messageId?: string }> {
    if (dto.sendDaysMask !== undefined && dto.sendDaysMask !== null && dto.sendDaysMask === 0) {
      throw new BadRequestException('발송 요일을 하나 이상 선택하세요.');
    }
    normalizeSendTimes(dto.sendTimes);

    const menu = await this.get(menuId);
    const to = normalizeRecipientEmails(dto.toAddresses);
    if (to.length === 0) {
      throw new BadRequestException('수신 이메일을 하나 이상 입력하세요.');
    }

    const override = dto.mailSmtpProfileId?.trim();
    if (override) {
      await this.normalizeOptionalMenuSmtpProfileId(override);
    }
    const profileId = override || menu.mailSmtpProfileId || null;
    const cfg = await this.smtp.resolveSmtpSecrets(profileId);
    if (!cfg) {
      throw new BadRequestException('SMTP 프로필을 설정해 주세요. 메일설정에서 프로필을 추가하거나 이 메뉴에 프로필을 지정하세요.');
    }

    let subject = (menu.defaultSubject ?? '').trim();
    let body = menu.defaultBody ?? '';
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
        await createMailMenuSendLogWithColumnFallback(this.prisma, this.logger, {
          mailMenuId: menu.id,
          sentAt: new Date(),
          status: MailSendLogStatus.SUCCESS,
          errorMessage: null,
          smtpMessageId: res.messageId ?? null,
          toSnapshotJson: to as unknown as Prisma.InputJsonValue,
          openTrackingToken: openToken,
        });
      } catch (logErr) {
        const detail = logErr instanceof Error ? logErr.message : String(logErr);
        this.logger.error(`SMTP 발송은 성공했으나 MailMenuSendLog 저장 실패(menu=${menu.id}): ${detail}`);
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
      this.delivery.logError(e, `mail menu sendNow ${menu.id}`);
      try {
        await createMailMenuSendLogWithColumnFallback(this.prisma, this.logger, {
          mailMenuId: menu.id,
          sentAt: new Date(),
          status: MailSendLogStatus.FAILURE,
          errorMessage: msg,
          smtpMessageId: null,
          toSnapshotJson: to as unknown as Prisma.InputJsonValue,
          openTrackingToken: null,
        });
      } catch (logErr) {
        this.logger.error(
          `MailMenuSendLog(FAILURE) 저장 실패(menu=${menu.id}): ${logErr instanceof Error ? logErr.message : String(logErr)}`,
        );
      }
      throw new BadRequestException(msg);
    }
  }
}
