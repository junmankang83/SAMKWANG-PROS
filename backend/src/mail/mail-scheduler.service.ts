import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MailSendLogStatus, type MailMenu, type MailSendRule, Prisma } from '@prisma/client';
import { MailMenuReportService } from './mail-menu-report.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailSmtpService } from './mail-smtp.service';
import { MailDeliveryService } from './mail-delivery.service';
import { MailRuleService } from './mail-rule.service';
import { seoulHHmm, seoulWeekdaySun0, shouldFireRule, utcMinuteSlot, mailSubjectWithSeoulSendDate } from './mail-schedule.util';
import { buildMailOpenPixelUrl, resolveMailTrackingPublicApiBase } from './mail-tracking-url';
import { generateOpenTrackingToken } from './mail-send-token';
import { createMailMenuSendLogWithColumnFallback, createMailSendLogWithColumnFallback } from './mail-send-log-fallback';
import { buildPlainTextSheetXlsx, subjectToXlsxFilename } from './mail-report-xlsx.util';

@Injectable()
export class MailSchedulerService {
  private readonly logger = new Logger(MailSchedulerService.name);
  private tickRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly smtp: MailSmtpService,
    private readonly delivery: MailDeliveryService,
    private readonly rules: MailRuleService,
    private readonly menuReport: MailMenuReportService,
  ) {}

  @Cron('0 * * * * *', { name: 'mail-scheduled-send' })
  async handleMinuteTick(): Promise<void> {
    if (this.tickRunning) {
      return;
    }
    this.tickRunning = true;
    try {
      const now = new Date();
      const slot = utcMinuteSlot(now);
      const list = await this.prisma.mailSendRule.findMany({
        where: { enabled: true },
        include: { mailMenu: true },
      });
      for (const rule of list) {
        if (rule.lastRunSlotUtc && rule.lastRunSlotUtc.getTime() === slot.getTime()) {
          continue;
        }
        if (
          !shouldFireRule(
            rule.scheduleType,
            rule.cronExpression,
            rule.dailyTime,
            rule.dailyDaysMask,
            now,
          )
        ) {
          continue;
        }
        const cfg = await this.smtp.resolveSmtpSecrets(rule.mailSmtpProfileId);
        if (!cfg) {
          this.logger.warn(`rule ${rule.id}: SMTP 프로필을 사용할 수 없습니다.`);
          continue;
        }
        await this.dispatchRule(rule, cfg, slot);
      }

      const menus = await this.prisma.mailMenu.findMany();
      for (const menu of menus) {
        if (!this.shouldDispatchMailMenu(menu, now, slot)) {
          continue;
        }
        await this.dispatchMailMenu(menu, slot);
      }
    } catch (e) {
      this.logger.warn(`mail tick: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.tickRunning = false;
    }
  }

  private parseJsonStringArray(json: Prisma.JsonValue): string[] {
    if (!Array.isArray(json)) {
      return [];
    }
    return json.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean);
  }

  /** MailMenu.sendTimes JSON → 정규화된 HH:mm 목록 */
  private normalizedMenuSendTimes(menu: MailMenu): string[] {
    const raw = this.parseJsonStringArray(menu.sendTimes);
    const out: string[] = [];
    for (const s of raw) {
      if (!/^\d{1,2}:\d{2}$/.test(s)) {
        continue;
      }
      const [hh, mm] = s.split(':');
      const h = parseInt(hh, 10);
      const m = parseInt(mm, 10);
      if (h < 0 || h > 23 || m < 0 || m > 59) {
        continue;
      }
      out.push(`${String(h).padStart(2, '0')}:${mm}`);
    }
    return [...new Set(out)];
  }

  private shouldDispatchMailMenu(menu: MailMenu, now: Date, slot: Date): boolean {
    if (!menu.scheduleAutoSendEnabled) {
      return false;
    }
    const to = this.rules.toAddressesFromRow({ toAddresses: menu.recipientEmails });
    if (to.length === 0) {
      return false;
    }
    const times = this.normalizedMenuSendTimes(menu);
    if (times.length === 0) {
      return false;
    }
    if (menu.sendDaysMask === 0) {
      return false;
    }
    const wd = seoulWeekdaySun0(now);
    if (wd < 0) {
      return false;
    }
    if ((menu.sendDaysMask & (1 << wd)) === 0) {
      return false;
    }
    const hhmm = seoulHHmm(now);
    if (!times.includes(hhmm)) {
      return false;
    }
    if (menu.lastMenuSendSlotUtc && menu.lastMenuSendSlotUtc.getTime() === slot.getTime()) {
      return false;
    }
    return true;
  }

  private async dispatchMailMenu(menu: MailMenu, slot: Date): Promise<void> {
    const fallbackRule = await this.prisma.mailSendRule.findFirst({
      where: { mailMenuId: menu.id, enabled: true },
      orderBy: { updatedAt: 'desc' },
      select: { subject: true, body: true, mailSmtpProfileId: true },
    });
    const cfg = await this.smtp.resolveSmtpSecrets(menu.mailSmtpProfileId ?? fallbackRule?.mailSmtpProfileId ?? null);
    if (!cfg) {
      this.logger.warn(`mail menu ${menu.id}: SMTP 프로필을 사용할 수 없습니다.`);
      return;
    }
    const to = this.rules
      .toAddressesFromRow({ toAddresses: menu.recipientEmails })
      .map((x) => x.trim())
      .filter(Boolean);
    if (to.length === 0) {
      await this.finishMenuSlot(menu.id, slot, 'FAILURE', '수신 주소가 없습니다.', null, [], null);
      return;
    }
    let subject = (menu.defaultSubject ?? '').trim();
    let body = menu.defaultBody ?? '';
    if (fallbackRule) {
      if (!subject) {
        subject = (fallbackRule.subject ?? '').trim();
      }
      if (!body.trim()) {
        body = fallbackRule.body ?? '';
      }
    }
    if (!subject) {
      subject = '(제목 없음)';
    }
    const sendAt = slot;
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
      await this.finishMenuSlot(menu.id, slot, 'SUCCESS', null, res.messageId ?? null, to, openToken);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.delivery.logError(e, `mail menu ${menu.id}`);
      await this.finishMenuSlot(menu.id, slot, 'FAILURE', msg, null, to, null);
    }
  }

  private async finishMenuSlot(
    mailMenuId: string,
    slot: Date,
    status: MailSendLogStatus,
    errorMessage: string | null,
    smtpMessageId: string | null,
    toSnapshot: string[],
    openTrackingToken: string | null,
  ): Promise<void> {
    const snap = toSnapshot as unknown as Prisma.InputJsonValue;
    await this.prisma.$transaction(async (tx) => {
      const sentAt = new Date();
      await createMailMenuSendLogWithColumnFallback(tx, this.logger, {
        mailMenuId,
        sentAt,
        status,
        errorMessage,
        smtpMessageId,
        toSnapshotJson: snap,
        openTrackingToken,
      });
      await tx.mailMenu.update({
        where: { id: mailMenuId },
        data: { lastMenuSendSlotUtc: slot },
      });
    });
  }

  private async dispatchRule(
    rule: MailSendRule & { mailMenu: MailMenu | null },
    cfg: NonNullable<Awaited<ReturnType<MailSmtpService['resolveSmtpSecrets']>>>,
    slot: Date,
  ): Promise<void> {
    const to = this.rules.toAddressesFromRow(rule).map((x) => x.trim()).filter(Boolean);
    if (to.length === 0) {
      await this.finishSlot(rule.id, slot, 'FAILURE', '수신 주소가 없습니다.', null, [], null);
      return;
    }
    let subject = rule.subject.trim();
    let body = rule.body;
    if (rule.mailMenu) {
      if (!subject) {
        subject = rule.mailMenu.defaultSubject?.trim() ?? '';
      }
      if (!body.trim()) {
        body = rule.mailMenu.defaultBody ?? '';
      }
    }
    if (!subject) {
      subject = '(제목 없음)';
    }
    const bannerTitle = rule.mailMenu?.label?.trim() || subject.trim() || '(제목 없음)';
    const sendAt = slot;
    subject = mailSubjectWithSeoulSendDate(subject, sendAt);
    let mailHtmlStructuredIntro: string | undefined;
    let mailHtmlTableFragment: string | undefined;
    let excelDataBuffer: Buffer | undefined;
    if (rule.mailMenu) {
      const report = await this.menuReport.appendMenuDataReport(
        body,
        { label: rule.mailMenu.label, code: rule.mailMenu.code },
        sendAt,
      );
      body = report.text;
      mailHtmlStructuredIntro = report.mailHtmlStructuredIntro;
      mailHtmlTableFragment = report.mailHtmlTableFragment;
      excelDataBuffer = report.excelDataBuffer;
    } else {
      excelDataBuffer = await buildPlainTextSheetXlsx(bannerTitle, body);
    }
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
        mailHtmlStructuredIntro,
        mailHtmlTableFragment,
        openPixelUrl,
        mailHtmlBannerTitle: bannerTitle,
        mailHtmlBannerSendAt: sendAt,
        excelAttachment:
          excelDataBuffer && excelDataBuffer.length > 0
            ? { filename: subjectToXlsxFilename(subject), content: excelDataBuffer }
            : undefined,
        smtp: {
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          user: cfg.user,
          password: cfg.password,
        },
      });
      await this.finishSlot(rule.id, slot, 'SUCCESS', null, res.messageId ?? null, to, openToken);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.delivery.logError(e, `rule ${rule.id}`);
      await this.finishSlot(rule.id, slot, 'FAILURE', msg, null, to, null);
    }
  }

  private async finishSlot(
    ruleId: string,
    slot: Date,
    status: MailSendLogStatus,
    errorMessage: string | null,
    smtpMessageId: string | null,
    toSnapshot: string[],
    openTrackingToken: string | null,
  ): Promise<void> {
    const snap = toSnapshot as unknown as Prisma.InputJsonValue;
    await this.prisma.$transaction(async (tx) => {
      const sentAt = new Date();
      await createMailSendLogWithColumnFallback(tx, this.logger, {
        ruleId,
        sentAt,
        status,
        errorMessage,
        smtpMessageId,
        toSnapshotJson: snap,
        openTrackingToken,
      });
      await tx.mailSendRule.update({
        where: { id: ruleId },
        data: { lastRunSlotUtc: slot },
      });
    });
  }
}
