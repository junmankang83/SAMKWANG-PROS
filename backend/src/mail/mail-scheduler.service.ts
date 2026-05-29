import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MailSendLogStatus, type MailSendRule } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailSmtpService } from './mail-smtp.service';
import { MailDeliveryService } from './mail-delivery.service';
import { MailRuleService } from './mail-rule.service';
import { shouldFireRule, utcMinuteSlot } from './mail-schedule.util';

@Injectable()
export class MailSchedulerService {
  private readonly logger = new Logger(MailSchedulerService.name);
  private tickRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly smtp: MailSmtpService,
    private readonly delivery: MailDeliveryService,
    private readonly rules: MailRuleService,
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
      const cfg = await this.smtp.resolveSmtpSecrets();
      if (!cfg) {
        return;
      }
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
        await this.dispatchRule(rule, cfg, slot);
      }
    } catch (e) {
      this.logger.warn(`mail tick: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.tickRunning = false;
    }
  }

  private async dispatchRule(
    rule: MailSendRule & { mailMenu: { defaultSubject: string; defaultBody: string } | null },
    cfg: NonNullable<Awaited<ReturnType<MailSmtpService['resolveSmtpSecrets']>>>,
    slot: Date,
  ): Promise<void> {
    const to = this.rules.toAddressesFromRow(rule).map((x) => x.trim()).filter(Boolean);
    if (to.length === 0) {
      await this.finishSlot(rule.id, slot, 'FAILURE', '수신 주소가 없습니다.', null);
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
    try {
      const res = await this.delivery.send({
        fromName: cfg.fromName || 'SAMKWANG-PROS',
        fromAddress: cfg.fromAddress,
        to,
        subject,
        text: body,
        smtp: {
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          user: cfg.user,
          password: cfg.password,
        },
      });
      await this.finishSlot(rule.id, slot, 'SUCCESS', null, res.messageId ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.delivery.logError(e, `rule ${rule.id}`);
      await this.finishSlot(rule.id, slot, 'FAILURE', msg, null);
    }
  }

  private async finishSlot(
    ruleId: string,
    slot: Date,
    status: MailSendLogStatus,
    errorMessage: string | null,
    smtpMessageId: string | null,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.mailSendLog.create({
        data: {
          ruleId,
          status,
          errorMessage,
          smtpMessageId,
        },
      }),
      this.prisma.mailSendRule.update({
        where: { id: ruleId },
        data: { lastRunSlotUtc: slot },
      }),
    ]);
  }
}
