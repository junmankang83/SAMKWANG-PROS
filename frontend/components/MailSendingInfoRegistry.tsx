'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@samkwang/ui-kit';
import { Icon } from '@iconify/react';
import { useCallback, useEffect, useState } from 'react';

async function readApiError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => '');
  try {
    const body = raw ? JSON.parse(raw) : null;
    if (body && typeof body === 'object') {
      const m = (body as { message?: unknown }).message;
      if (typeof m === 'string') {
        return m;
      }
      if (Array.isArray(m)) {
        return m.map(String).join(', ');
      }
    }
  } catch {
    /* ignore */
  }
  return raw.trim().slice(0, 400) || `요청 실패 (${res.status})`;
}

type SourceType = 'MENU' | 'RULE';

type ToAddressesSource = 'snapshot' | 'current_menu' | 'current_rule';

type UnifiedLogRow = {
  id: string;
  sentAt: string;
  /** API가 내려주면 서울 기준 목록용 문자열(없으면 sentAt을 클라이언트에서 포맷) */
  sentAtDisplay: string | null;
  sourceType: SourceType;
  menuCode: string | null;
  menuLabel: string | null;
  ruleName: string | null;
  smtpProfileName: string | null;
  toAddresses: string[];
  toAddressesSource: ToAddressesSource;
  status: string;
  errorMessage: string | null;
  smtpMessageId: string | null;
  readStatusLabel: string;
  readStatusDetail: string;
  hasOpenTracking: boolean;
  firstOpenedAt: string | null;
  openCount: number;
};

const SEOUL_TZ = 'Asia/Seoul';

function formatSentAtSeoul(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: SEOUL_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusLabel(s: string): string {
  if (s === 'SUCCESS') {
    return '성공';
  }
  if (s === 'FAILURE') {
    return '실패';
  }
  return s;
}

function sourceLabel(t: SourceType): string {
  return t === 'MENU' ? '메뉴' : '규칙';
}

function describeRow(r: UnifiedLogRow): string {
  if (r.sourceType === 'MENU') {
    const label = r.menuLabel ?? r.menuCode ?? '—';
    return `${label}`;
  }
  const rn = r.ruleName ?? '—';
  const link = r.menuLabel ? ` · ${r.menuLabel}` : '';
  return `${rn}${link}`;
}

function recipientTitle(r: UnifiedLogRow): string {
  const list = r.toAddresses.join(', ');
  if (r.toAddressesSource === 'snapshot') {
    return list || '수신자 없음';
  }
  if (r.toAddressesSource === 'current_menu') {
    return list
      ? `${list}\n※ 발송 시점 스냅샷이 없어, 메뉴에 저장된 현재 수신자를 표시합니다.`
      : '메뉴에 수신자가 없습니다.';
  }
  return list
    ? `${list}\n※ 발송 시점 스냅샷이 없어, 규칙에 저장된 현재 수신자를 표시합니다.`
    : '규칙에 수신자가 없습니다.';
}

function memoDisplay(r: UnifiedLogRow): { text: string; title: string } {
  const err = r.errorMessage?.trim();
  if (err) {
    return { text: err, title: err };
  }
  const mid = r.smtpMessageId?.trim();
  if (r.status === 'SUCCESS') {
    return {
      text: '정상 발송',
      title: mid ? `SMTP 메시지 ID(문의·기술 확인용): ${mid}` : '오류 없음',
    };
  }
  return {
    text: '실패(상세 메시지 없음)',
    title: mid ? `SMTP 메시지 ID: ${mid}` : '오류 메시지가 기록되지 않았습니다.',
  };
}

export function MailSendingInfoRegistry() {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<UnifiedLogRow[]>([]);
  const [take, setTake] = useState(100);

  const load = useCallback(async () => {
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/mail/send-logs?take=${take}`, { credentials: 'include', cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        setRows([]);
        return;
      }
      const raw = (await res.json()) as unknown;
      if (!Array.isArray(raw)) {
        setRows([]);
        return;
      }
      setRows(
        raw.map((x) => {
          const o = x as Record<string, unknown>;
          const to = o.toAddresses;
          const toAddresses = Array.isArray(to) ? to.filter((e): e is string => typeof e === 'string').map((e) => e.trim()).filter(Boolean) : [];
          const src = o.toAddressesSource;
          const toAddressesSource: ToAddressesSource =
            src === 'current_rule' ? 'current_rule' : src === 'current_menu' ? 'current_menu' : 'snapshot';
          return {
            id: String(o.id ?? ''),
            sentAt: String(o.sentAt ?? ''),
            sentAtDisplay: typeof o.sentAtDisplay === 'string' && o.sentAtDisplay.trim() ? o.sentAtDisplay.trim() : null,
            sourceType: o.sourceType === 'RULE' ? 'RULE' : 'MENU',
            menuCode: o.menuCode != null ? String(o.menuCode) : null,
            menuLabel: o.menuLabel != null ? String(o.menuLabel) : null,
            ruleName: o.ruleName != null ? String(o.ruleName) : null,
            smtpProfileName: o.smtpProfileName != null ? String(o.smtpProfileName) : null,
            toAddresses,
            toAddressesSource,
            status: String(o.status ?? ''),
            errorMessage: o.errorMessage != null ? String(o.errorMessage) : null,
            smtpMessageId: o.smtpMessageId != null ? String(o.smtpMessageId) : null,
            readStatusLabel: typeof o.readStatusLabel === 'string' ? o.readStatusLabel : '미확인',
            readStatusDetail:
              typeof o.readStatusDetail === 'string'
                ? o.readStatusDetail
                : '열람 정보를 불러오지 못했습니다.',
            hasOpenTracking: o.hasOpenTracking === true,
            firstOpenedAt: o.firstOpenedAt != null ? String(o.firstOpenedAt) : null,
            openCount: typeof o.openCount === 'number' && Number.isFinite(o.openCount) ? o.openCount : 0,
          };
        }),
      );
    } finally {
      setBusy(false);
    }
  }, [take]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 열람(픽셀) 반영을 위해 주기적으로 목록을 다시 불러옵니다. */
  useEffect(() => {
    const intervalMs = 20_000;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      void load();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-app-text">메일발송정보</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-app-muted">
            <span>건수</span>
            <select
              className="rounded-md border border-app-border bg-app-surface px-2 py-1.5 text-sm text-app-text"
              value={take}
              disabled={busy}
              onChange={(e) => setTake(Number(e.target.value) || 100)}
            >
              {[50, 100, 200, 300].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" variant="secondary" size="sm" disabled={busy} loading={busy} onClick={() => void load()}>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon="mdi:refresh" className="h-4 w-4 shrink-0" aria-hidden />
              새로고침
            </span>
          </Button>
        </div>
      </div>

      {loadError ? (
        <Alert variant="error">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">발송 이력</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-hidden p-0 sm:p-0">
          <table className="pros-data-table pros-data-table-head-center pros-mail-dispatch-table w-full max-w-full text-sm text-app-text">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[7%]" />
              <col className="w-[16%]" />
              <col className="w-[11%]" />
              <col className="w-[22%]" />
              <col className="w-[8%]" />
              <col className="w-[13%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr className="bg-app-muted/30">
                <th>발송시각</th>
                <th>구분</th>
                <th>메뉴·규칙</th>
                <th>SMTP</th>
                <th title="스냅샷이 없는 오래된 이력은 메뉴·규칙의 현재 수신자를 참고로 표시합니다.">
                  수신자
                </th>
                <th>발송결과</th>
                <th>오류·메모</th>
                <th title="HTML 본문의 추적 픽셀 기준. 확인=최초 열람 기록 있음, 미확인=미열람 또는 추적 불가. 실패 건은 —.">
                  열람
                </th>
              </tr>
            </thead>
            <tbody>
              {busy && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="pros-table-empty text-app-muted">
                    불러오는 중…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="pros-table-empty text-app-muted">
                    아직 발송 이력이 없습니다. 메일발송관리에서 스케줄·즉시 발송이 실행되면 여기에 표시됩니다.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={`${r.sourceType}-${r.id}`}>
                    <td
                      className="pros-cell-center pros-cell-truncate whitespace-nowrap font-mono text-sm"
                      title={r.sentAtDisplay ?? (r.sentAt ? formatSentAtSeoul(r.sentAt) : '')}
                    >
                      {((r.sentAtDisplay ?? (r.sentAt ? formatSentAtSeoul(r.sentAt) : '')) || '—')}
                    </td>
                    <td className="pros-cell-center text-sm">{sourceLabel(r.sourceType)}</td>
                    <td className="pros-cell-center pros-cell-truncate text-sm" title={describeRow(r)}>
                      {describeRow(r)}
                    </td>
                    <td className="pros-cell-center pros-cell-truncate text-sm" title={r.smtpProfileName ?? ''}>
                      {r.smtpProfileName ?? '—'}
                    </td>
                    <td className="pros-cell-center pros-cell-truncate text-sm" title={recipientTitle(r)}>
                      {r.toAddresses.length ? r.toAddresses.join(', ') : '—'}
                    </td>
                    <td className="pros-cell-center text-sm">
                      <span className={r.status === 'SUCCESS' ? 'text-emerald-700' : r.status === 'FAILURE' ? 'text-red-700' : ''}>
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="pros-cell-center pros-cell-truncate text-sm" title={memoDisplay(r).title}>
                      {memoDisplay(r).text}
                    </td>
                    <td className="pros-cell-center text-sm text-app-text" title={r.readStatusDetail}>
                      <span
                        className={`leading-snug ${
                          r.status === 'SUCCESS' && r.hasOpenTracking && r.firstOpenedAt
                            ? 'text-emerald-700'
                            : r.status === 'SUCCESS' && r.hasOpenTracking && !r.firstOpenedAt
                              ? 'text-amber-700'
                              : ''
                        }`}
                      >
                        {r.readStatusLabel}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
