import { Injectable, Logger } from '@nestjs/common';
import { MailSendLogStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function jsonToEmails(v: Prisma.JsonValue | null | undefined): string[] {
  if (!v || !Array.isArray(v)) {
    return [];
  }
  return v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean);
}

function formatSeoul(dt: Date): string {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(dt);
  } catch {
    return dt.toISOString();
  }
}

/** 목록 발송시각: Asia/Seoul 기준 `YYYY-MM-DD HH:mm:ss` (혼동 적음) */
function formatSentAtKstList(dt: Date): string {
  try {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(dt);
  } catch {
    return dt.toISOString();
  }
}

export type MailUnifiedSendLogItem = {
  id: string;
  sentAt: string;
  /** Asia/Seoul 기준 발송시각 문자열(목록 표시용) */
  sentAtDisplay: string;
  sourceType: 'MENU' | 'RULE';
  menuCode: string | null;
  menuLabel: string | null;
  ruleName: string | null;
  smtpProfileName: string | null;
  toAddresses: string[];
  /** snapshot: 발송 시점 저장값. current_*: 스냅샷 없을 때 메뉴·규칙의 현재 설정(참고용) */
  toAddressesSource: 'snapshot' | 'current_menu' | 'current_rule';
  status: string;
  errorMessage: string | null;
  smtpMessageId: string | null;
  readStatusLabel: string;
  readStatusDetail: string;
  /** 성공 발송에 추적 토큰이 있었는지(백엔드가 HTML+픽셀을 넣었는지) */
  hasOpenTracking: boolean;
  firstOpenedAt: string | null;
  openCount: number;
};

/** 목록 API에서 findMany 결과를 통합 행으로 매핑할 때 쓰는 느슨한 행 형태 */
type MenuLogRowLoose = {
  id: string;
  sentAt: Date;
  status: MailSendLogStatus;
  errorMessage: string | null;
  smtpMessageId: string | null;
  toAddressesSnapshot?: Prisma.JsonValue | null;
  openTrackingToken?: string | null;
  firstOpenedAt?: Date | null;
  openCount?: number | null;
  mailMenu: {
    code: string;
    label: string;
    recipientEmails?: Prisma.JsonValue | null;
    mailSmtpProfile?: { name: string } | null;
  } | null;
};

type RuleLogRowLoose = {
  id: string;
  sentAt: Date;
  status: MailSendLogStatus;
  errorMessage: string | null;
  smtpMessageId: string | null;
  toAddressesSnapshot?: Prisma.JsonValue | null;
  openTrackingToken?: string | null;
  firstOpenedAt?: Date | null;
  openCount?: number | null;
  rule: {
    name: string;
    toAddresses: Prisma.JsonValue;
    mailMenu?: { code: string; label: string } | null;
    mailSmtpProfile?: { name: string } | null;
  } | null;
};

@Injectable()
export class MailSendLogsService {
  private readonly logger = new Logger(MailSendLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private static readFields(
    status: string,
    token: string | null | undefined,
    firstOpenedAt: Date | null | undefined,
    openCount: number,
  ): Pick<MailUnifiedSendLogItem, 'readStatusLabel' | 'readStatusDetail' | 'hasOpenTracking'> {
    if (status !== 'SUCCESS') {
      return {
        hasOpenTracking: false,
        readStatusLabel: '—',
        readStatusDetail: '발송 성공 건만 열람(픽셀) 기준으로 확인·미확인을 표시합니다.',
      };
    }
    if (!token) {
      return {
        hasOpenTracking: false,
        readStatusLabel: '미확인',
        readStatusDetail:
          '열람 추적(픽셀)이 없어 자동 확인이 불가합니다. MAIL_TRACKING_PUBLIC_URL 등 공개 API 베이스가 없거나 텍스트만 발송된 경우일 수 있습니다.',
      };
    }
    if (firstOpenedAt) {
      const t = formatSeoul(firstOpenedAt);
      return {
        hasOpenTracking: true,
        readStatusLabel: '확인',
        readStatusDetail: `수신자가 HTML로 본 메일에서 추적 이미지가 최초 로드된 시각(KST): ${t}. 누적 요청 ${openCount}회. 텍스트만 보기·이미지 차단 시 기록되지 않을 수 있습니다.`,
      };
    }
    return {
      hasOpenTracking: true,
      readStatusLabel: '미확인',
      readStatusDetail:
        '메일에는 추적 픽셀이 포함되었으나 아직 요청이 없습니다. 수신자가 HTML 본문을 열고 이미지 표시를 허용하면 확인으로 바뀝니다.',
    };
  }

  /** 다음 단계 조회를 시도할지(인증 오류만 중단). 그 외 오류는 마지막 배치 조회까지 폴백합니다. */
  private static isRetryableListFetchError(e: unknown): boolean {
    const msg = e instanceof Error ? e.message : String(e);
    if (/401|403|Unauthorized|Forbidden/i.test(msg)) {
      return false;
    }
    return true;
  }

  private async fetchMenuSendLogsLoose(take: number): Promise<MenuLogRowLoose[]> {
    const menuFull = {
      code: true,
      label: true,
      recipientEmails: true,
      mailSmtpProfile: { select: { name: true } },
    } as const;
    const menuMinimal = { code: true, label: true } as const;

    const attempts: Array<() => Promise<MenuLogRowLoose[]>> = [
      async () => {
        const rows = await this.prisma.mailMenuSendLog.findMany({
          take,
          orderBy: { sentAt: 'desc' },
          include: { mailMenu: { select: menuFull } },
        });
        return rows as unknown as MenuLogRowLoose[];
      },
      async () => {
        const rows = await this.prisma.mailMenuSendLog.findMany({
          take,
          orderBy: { sentAt: 'desc' },
          select: {
            id: true,
            mailMenuId: true,
            sentAt: true,
            status: true,
            errorMessage: true,
            smtpMessageId: true,
            mailMenu: { select: menuFull },
          },
        });
        return rows as unknown as MenuLogRowLoose[];
      },
      async () => {
        const rows = await this.prisma.mailMenuSendLog.findMany({
          take,
          orderBy: { sentAt: 'desc' },
          select: {
            id: true,
            mailMenuId: true,
            sentAt: true,
            status: true,
            errorMessage: true,
            smtpMessageId: true,
            mailMenu: { select: menuMinimal },
          },
        });
        return rows as unknown as MenuLogRowLoose[];
      },
      async () => {
        const rows = await this.prisma.mailMenuSendLog.findMany({
          take,
          orderBy: { sentAt: 'desc' },
          select: {
            id: true,
            mailMenuId: true,
            sentAt: true,
            status: true,
            errorMessage: true,
            smtpMessageId: true,
          },
        });
        const ids = [...new Set(rows.map((r) => r.mailMenuId))];
        const menus =
          ids.length > 0
            ? await this.prisma.mailMenu.findMany({
                where: { id: { in: ids } },
                select: { id: true, code: true, label: true },
              })
            : [];
        const byId = new Map(menus.map((m) => [m.id, m]));
        return rows.map((log) => {
          const m = byId.get(log.mailMenuId);
          return {
            id: log.id,
            sentAt: log.sentAt,
            status: log.status,
            errorMessage: log.errorMessage,
            smtpMessageId: log.smtpMessageId,
            mailMenu: m ? { code: m.code, label: m.label } : null,
          };
        });
      },
    ];

    let lastErr: unknown;
    for (let i = 0; i < attempts.length; i++) {
      try {
        const out = await attempts[i]!();
        if (i > 0) {
          this.logger.warn(`MailMenuSendLog 목록: ${i + 1}번째 조회 전략으로 성공했습니다.`);
        }
        return out;
      } catch (e) {
        lastErr = e;
        const retryable = MailSendLogsService.isRetryableListFetchError(e);
        const last = i === attempts.length - 1;
        this.logger.warn(
          `MailMenuSendLog 목록 시도 ${i + 1}/${attempts.length}${last ? ' (마지막)' : ''}: ${e instanceof Error ? e.message : String(e)}`,
        );
        if (!retryable || last) {
          throw e;
        }
      }
    }
    throw lastErr;
  }

  private async fetchRuleSendLogsLoose(take: number): Promise<RuleLogRowLoose[]> {
    const ruleFull = {
      name: true,
      toAddresses: true,
      mailMenu: { select: { code: true, label: true } },
      mailSmtpProfile: { select: { name: true } },
    } as const;
    const ruleMid = {
      name: true,
      toAddresses: true,
      mailMenu: { select: { code: true, label: true } },
    } as const;
    const ruleMin = {
      name: true,
      toAddresses: true,
    } as const;

    const attempts: Array<() => Promise<RuleLogRowLoose[]>> = [
      async () => {
        const rows = await this.prisma.mailSendLog.findMany({
          take,
          orderBy: { sentAt: 'desc' },
          include: { rule: { select: ruleFull } },
        });
        return rows as unknown as RuleLogRowLoose[];
      },
      async () => {
        const rows = await this.prisma.mailSendLog.findMany({
          take,
          orderBy: { sentAt: 'desc' },
          select: {
            id: true,
            ruleId: true,
            sentAt: true,
            status: true,
            errorMessage: true,
            smtpMessageId: true,
            rule: { select: ruleFull },
          },
        });
        return rows as unknown as RuleLogRowLoose[];
      },
      async () => {
        const rows = await this.prisma.mailSendLog.findMany({
          take,
          orderBy: { sentAt: 'desc' },
          select: {
            id: true,
            ruleId: true,
            sentAt: true,
            status: true,
            errorMessage: true,
            smtpMessageId: true,
            rule: { select: ruleMid },
          },
        });
        return rows as unknown as RuleLogRowLoose[];
      },
      async () => {
        const rows = await this.prisma.mailSendLog.findMany({
          take,
          orderBy: { sentAt: 'desc' },
          select: {
            id: true,
            ruleId: true,
            sentAt: true,
            status: true,
            errorMessage: true,
            smtpMessageId: true,
            rule: { select: ruleMin },
          },
        });
        return rows as unknown as RuleLogRowLoose[];
      },
      async () => {
        const rows = await this.prisma.mailSendLog.findMany({
          take,
          orderBy: { sentAt: 'desc' },
          select: {
            id: true,
            ruleId: true,
            sentAt: true,
            status: true,
            errorMessage: true,
            smtpMessageId: true,
          },
        });
        const ids = [...new Set(rows.map((r) => r.ruleId))];
        const rules =
          ids.length > 0
            ? await this.prisma.mailSendRule.findMany({
                where: { id: { in: ids } },
                select: { id: true, name: true, toAddresses: true, mailMenuId: true },
              })
            : [];
        const byId = new Map(rules.map((x) => [x.id, x]));
        const menuIds = [...new Set(rules.map((x) => x.mailMenuId).filter((x): x is string => Boolean(x)))];
        const menus =
          menuIds.length > 0
            ? await this.prisma.mailMenu.findMany({
                where: { id: { in: menuIds } },
                select: { id: true, code: true, label: true },
              })
            : [];
        const menuById = new Map(menus.map((m) => [m.id, m]));
        return rows.map((log) => {
          const ru = byId.get(log.ruleId);
          if (!ru) {
            return {
              id: log.id,
              sentAt: log.sentAt,
              status: log.status,
              errorMessage: log.errorMessage,
              smtpMessageId: log.smtpMessageId,
              rule: null,
            };
          }
          const mm = ru.mailMenuId ? menuById.get(ru.mailMenuId) : undefined;
          return {
            id: log.id,
            sentAt: log.sentAt,
            status: log.status,
            errorMessage: log.errorMessage,
            smtpMessageId: log.smtpMessageId,
            rule: {
              name: ru.name,
              toAddresses: ru.toAddresses,
              mailMenu: mm ? { code: mm.code, label: mm.label } : null,
              mailSmtpProfile: null,
            },
          };
        });
      },
    ];

    let lastErr: unknown;
    for (let i = 0; i < attempts.length; i++) {
      try {
        const out = await attempts[i]!();
        if (i > 0) {
          this.logger.warn(`MailSendLog 목록: ${i + 1}번째 조회 전략으로 성공했습니다.`);
        }
        return out;
      } catch (e) {
        lastErr = e;
        const retryable = MailSendLogsService.isRetryableListFetchError(e);
        const last = i === attempts.length - 1;
        this.logger.warn(
          `MailSendLog 목록 시도 ${i + 1}/${attempts.length}${last ? ' (마지막)' : ''}: ${e instanceof Error ? e.message : String(e)}`,
        );
        if (!retryable || last) {
          throw e;
        }
      }
    }
    throw lastErr;
  }

  /** 폴백 조회에서 openTrackingToken 등이 빠진 행에 DB 값을 다시 붙입니다. */
  private async attachMenuSendOpenFields(rows: MenuLogRowLoose[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    try {
      const ids = rows.map((r) => r.id);
      const hits = await this.prisma.mailMenuSendLog.findMany({
        where: { id: { in: ids } },
        select: { id: true, openTrackingToken: true, firstOpenedAt: true, openCount: true },
      });
      const byId = new Map(hits.map((h) => [h.id, h]));
      for (const r of rows) {
        const h = byId.get(r.id);
        if (!h) {
          continue;
        }
        r.openTrackingToken = h.openTrackingToken ?? r.openTrackingToken;
        r.firstOpenedAt = h.firstOpenedAt ?? r.firstOpenedAt;
        r.openCount = h.openCount ?? r.openCount;
      }
    } catch (e) {
      this.logger.warn(`메뉴 발송 로그 열람 필드 보강 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private async attachRuleSendOpenFields(rows: RuleLogRowLoose[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    try {
      const ids = rows.map((r) => r.id);
      const hits = await this.prisma.mailSendLog.findMany({
        where: { id: { in: ids } },
        select: { id: true, openTrackingToken: true, firstOpenedAt: true, openCount: true },
      });
      const byId = new Map(hits.map((h) => [h.id, h]));
      for (const r of rows) {
        const h = byId.get(r.id);
        if (!h) {
          continue;
        }
        r.openTrackingToken = h.openTrackingToken ?? r.openTrackingToken;
        r.firstOpenedAt = h.firstOpenedAt ?? r.firstOpenedAt;
        r.openCount = h.openCount ?? r.openCount;
      }
    } catch (e) {
      this.logger.warn(`규칙 발송 로그 열람 필드 보강 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async listUnified(takeInput: number): Promise<MailUnifiedSendLogItem[]> {
    const take = Math.min(500, Math.max(1, takeInput));

    let menuRows: MenuLogRowLoose[] = [];
    let ruleRows: RuleLogRowLoose[] = [];
    try {
      menuRows = await this.fetchMenuSendLogsLoose(take);
    } catch (e) {
      this.logger.error(`메뉴 발송 로그 통합 목록을 가져오지 못했습니다: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      ruleRows = await this.fetchRuleSendLogsLoose(take);
    } catch (e) {
      this.logger.error(`규칙 발송 로그 통합 목록을 가져오지 못했습니다: ${e instanceof Error ? e.message : String(e)}`);
    }

    await this.attachMenuSendOpenFields(menuRows);
    await this.attachRuleSendOpenFields(ruleRows);

    const fromMenu: MailUnifiedSendLogItem[] = menuRows.map((r) => {
      const snap = jsonToEmails(r.toAddressesSnapshot);
      const fromMenuCfg = jsonToEmails(r.mailMenu?.recipientEmails);
      const useSnap = snap.length > 0;
      const toAddresses = useSnap ? snap : fromMenuCfg;
      const read = MailSendLogsService.readFields(r.status, r.openTrackingToken, r.firstOpenedAt, Number(r.openCount ?? 0));
      return {
        id: r.id,
        sentAt: r.sentAt.toISOString(),
        sentAtDisplay: formatSentAtKstList(r.sentAt),
        sourceType: 'MENU' as const,
        menuCode: r.mailMenu?.code ?? null,
        menuLabel: r.mailMenu?.label ?? null,
        ruleName: null,
        smtpProfileName: r.mailMenu?.mailSmtpProfile?.name ?? null,
        toAddresses,
        toAddressesSource: useSnap ? ('snapshot' as const) : ('current_menu' as const),
        status: r.status,
        errorMessage: r.errorMessage,
        smtpMessageId: r.smtpMessageId,
        ...read,
        firstOpenedAt: r.firstOpenedAt ? r.firstOpenedAt.toISOString() : null,
        openCount: Number(r.openCount ?? 0),
      };
    });

    const fromRule: MailUnifiedSendLogItem[] = ruleRows.map((r) => {
      const rule = r.rule;
      if (!rule) {
        return {
          id: r.id,
          sentAt: r.sentAt.toISOString(),
          sentAtDisplay: formatSentAtKstList(r.sentAt),
          sourceType: 'RULE' as const,
          menuCode: null,
          menuLabel: null,
          ruleName: '—',
          smtpProfileName: null,
          toAddresses: jsonToEmails(r.toAddressesSnapshot),
          toAddressesSource: jsonToEmails(r.toAddressesSnapshot).length > 0 ? ('snapshot' as const) : ('current_rule' as const),
          status: r.status,
          errorMessage: r.errorMessage,
          smtpMessageId: r.smtpMessageId,
          ...MailSendLogsService.readFields(r.status, r.openTrackingToken, r.firstOpenedAt, Number(r.openCount ?? 0)),
          firstOpenedAt: r.firstOpenedAt ? r.firstOpenedAt.toISOString() : null,
          openCount: Number(r.openCount ?? 0),
        };
      }
      const snap = jsonToEmails(r.toAddressesSnapshot);
      const fromRuleCfg = jsonToEmails(rule.toAddresses);
      const useSnap = snap.length > 0;
      const toAddresses = useSnap ? snap : fromRuleCfg;
      const read = MailSendLogsService.readFields(r.status, r.openTrackingToken, r.firstOpenedAt, Number(r.openCount ?? 0));
      return {
        id: r.id,
        sentAt: r.sentAt.toISOString(),
        sentAtDisplay: formatSentAtKstList(r.sentAt),
        sourceType: 'RULE' as const,
        menuCode: rule.mailMenu?.code ?? null,
        menuLabel: rule.mailMenu?.label ?? null,
        ruleName: rule.name,
        smtpProfileName: rule.mailSmtpProfile?.name ?? null,
        toAddresses,
        toAddressesSource: useSnap ? ('snapshot' as const) : ('current_rule' as const),
        status: r.status,
        errorMessage: r.errorMessage,
        smtpMessageId: r.smtpMessageId,
        ...read,
        firstOpenedAt: r.firstOpenedAt ? r.firstOpenedAt.toISOString() : null,
        openCount: Number(r.openCount ?? 0),
      };
    });

    const merged = [...fromMenu, ...fromRule];
    merged.sort((a, b) => (a.sentAt < b.sentAt ? 1 : a.sentAt > b.sentAt ? -1 : 0));
    return merged.slice(0, take);
  }
}
