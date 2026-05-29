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
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@samkwang/ui-kit';
import { Icon } from '@iconify/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

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

type ScheduleType = 'DAILY' | 'CRON';

type MailMenuOpt = { id: string; code: string; label: string };

type RuleRow = {
  id: string;
  enabled: boolean;
  name: string;
  scheduleType: ScheduleType;
  cronExpression: string | null;
  dailyTime: string | null;
  dailyDaysMask: number;
  toAddresses: unknown;
  subject: string;
  body: string;
  mailMenuId: string | null;
  mailMenu?: MailMenuOpt | null;
  lastRunSlotUtc: string | null;
};

const WD_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function parseToList(json: unknown): string[] {
  if (!Array.isArray(json)) {
    return [];
  }
  return json.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean);
}

function maskFromBools(days: boolean[]): number {
  let m = 0;
  for (let i = 0; i < 7; i++) {
    if (days[i]) {
      m |= 1 << i;
    }
  }
  return m;
}

function boolsFromMask(mask: number): boolean[] {
  return Array.from({ length: 7 }, (_, i) => (mask & (1 << i)) !== 0);
}

function formatDaysSummary(mask: number): string {
  const b = boolsFromMask(mask);
  return WD_LABELS.filter((_, i) => b[i]).join('/') || '—';
}

function emptyDraft(): {
  id: string | null;
  name: string;
  enabled: boolean;
  scheduleType: ScheduleType;
  cronExpression: string;
  dailyTime: string;
  dailyDays: boolean[];
  toText: string;
  subject: string;
  body: string;
  mailMenuId: string;
} {
  return {
    id: null,
    name: '',
    enabled: true,
    scheduleType: 'DAILY',
    cronExpression: '0 9 * * *',
    dailyTime: '09:00',
    dailyDays: boolsFromMask(127),
    toText: '',
    subject: '',
    body: '',
    mailMenuId: '',
  };
}

export function MailSendingInfoRegistry() {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<RuleRow[]>([]);
  const [menus, setMenus] = useState<MailMenuOpt[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());

  const loadMenus = useCallback(async () => {
    const res = await fetch('/api/mail/menus', { credentials: 'include', cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as MailMenuOpt[];
      setMenus(data);
    }
  }, []);

  const loadRules = useCallback(async () => {
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/mail/rules', { credentials: 'include', cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        setRows([]);
        return;
      }
      const data = (await res.json()) as RuleRow[];
      setRows(data);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadMenus();
    void loadRules();
  }, [loadMenus, loadRules]);

  function openCreate() {
    setDraft(emptyDraft());
    setDialogOpen(true);
  }

  function openEdit(r: RuleRow) {
    setDraft({
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      scheduleType: r.scheduleType,
      cronExpression: r.cronExpression ?? '0 9 * * *',
      dailyTime: r.dailyTime ?? '09:00',
      dailyDays: boolsFromMask(r.dailyDaysMask),
      toText: parseToList(r.toAddresses).join('\n'),
      subject: r.subject,
      body: r.body,
      mailMenuId: r.mailMenuId ?? '',
    });
    setDialogOpen(true);
  }

  async function saveDraft() {
    const toAddresses = draft.toText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!draft.name.trim()) {
      setLoadError('규칙 이름을 입력해 주세요.');
      return;
    }
    if (toAddresses.length === 0) {
      setLoadError('수신 이메일을 한 줄 이상 입력해 주세요.');
      return;
    }
    const payload: Record<string, unknown> = {
      name: draft.name.trim(),
      enabled: draft.enabled,
      scheduleType: draft.scheduleType,
      cronExpression: draft.scheduleType === 'CRON' ? draft.cronExpression.trim() : null,
      dailyTime: draft.scheduleType === 'DAILY' ? draft.dailyTime.trim() : null,
      dailyDaysMask: maskFromBools(draft.dailyDays),
      toAddresses,
      subject: draft.subject.trim(),
      body: draft.body,
      mailMenuId: draft.mailMenuId.trim() || null,
    };
    setBusy(true);
    setLoadError(null);
    try {
      const url = draft.id ? `/api/mail/rules/${draft.id}` : '/api/mail/rules';
      const method = draft.id ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        return;
      }
      setDialogOpen(false);
      await loadRules();
    } finally {
      setBusy(false);
    }
  }

  async function removeRule(id: string, name: string) {
    if (!window.confirm(`「${name}」 규칙을 삭제할까요?`)) {
      return;
    }
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/mail/rules/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        return;
      }
      await loadRules();
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(r: RuleRow) {
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/mail/rules/${r.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !r.enabled }),
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        return;
      }
      await loadRules();
    } finally {
      setBusy(false);
    }
  }

  const scheduleHint = useMemo(
    () =>
      'DAILY: Asia/Seoul 기준. CRON: 5필드(분 시 일 월 요일) 또는 6필드; 예 `0 9 * * *` = 매일 9시.',
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-app-text">메일발송정보</h1>
          <p className="mt-1 max-w-3xl text-sm text-app-muted">
            스케줄·수신자·본문을 등록하면 매분 서버가 조건을 확인해 발송합니다. {scheduleHint}
          </p>
        </div>
        <Button type="button" variant="primary" size="sm" disabled={busy} onClick={openCreate}>
          <span className="inline-flex items-center gap-1.5">
            <Icon icon="mdi:plus" className="h-4 w-4 shrink-0" aria-hidden />
            규칙 추가
          </span>
        </Button>
      </div>

      {loadError ? (
        <Alert variant="error">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">발송 규칙</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-0">
          <table className="pros-data-table pros-data-table-head-center w-full min-w-[56rem] text-sm text-app-text">
            <thead>
              <tr className="bg-app-muted/30">
                <th className="px-2 py-2">사용</th>
                <th className="px-2 py-2">이름</th>
                <th className="px-2 py-2">스케줄</th>
                <th className="px-2 py-2 text-left">수신</th>
                <th className="px-2 py-2 text-left">제목</th>
                <th className="px-2 py-2">메뉴</th>
                <th className="px-2 py-2">마지막 슬롯(UTC)</th>
                <th className="px-2 py-2">작업</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="pros-table-empty text-app-muted">
                    등록된 규칙이 없습니다. [규칙 추가]를 눌러 주세요.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const sched =
                    r.scheduleType === 'CRON'
                      ? `CRON: ${r.cronExpression ?? '—'}`
                      : `매일 ${r.dailyTime ?? '—'} (${formatDaysSummary(r.dailyDaysMask)})`;
                  const toPreview = parseToList(r.toAddresses).join(', ');
                  return (
                    <tr key={r.id}>
                      <td className="px-2 py-1.5">
                        <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" disabled={busy} onClick={() => void toggleEnabled(r)}>
                          {r.enabled ? 'ON' : 'OFF'}
                        </Button>
                      </td>
                      <td className="px-2 py-1.5 font-medium">{r.name}</td>
                      <td className="max-w-[14rem] whitespace-pre-wrap px-2 py-1.5 text-left text-xs">{sched}</td>
                      <td className="max-w-[12rem] truncate px-2 py-1.5 text-left" title={toPreview}>
                        {toPreview || '—'}
                      </td>
                      <td className="max-w-[10rem] truncate px-2 py-1.5 text-left">{r.subject || '—'}</td>
                      <td className="px-2 py-1.5 text-xs">{r.mailMenu?.label ?? '—'}</td>
                      <td className="px-2 py-1.5 font-mono text-xs">{r.lastRunSlotUtc ? new Date(r.lastRunSlotUtc).toISOString().slice(0, 16) : '—'}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" disabled={busy} onClick={() => openEdit(r)}>
                            수정
                          </Button>
                          <Button type="button" variant="danger" size="sm" className="h-7 text-xs" disabled={busy} onClick={() => void removeRule(r.id, r.name)}>
                            삭제
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>{draft.id ? '규칙 수정' : '규칙 추가'}</DialogTitle>
          </DialogHeader>
          <DialogBody className="max-h-[min(80vh,42rem)] space-y-4 overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>이름</Label>
                <Input value={draft.name} disabled={busy} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 pt-6 text-sm">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  disabled={busy}
                  onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
                />
                사용
              </label>
            </div>
            <div className="space-y-1.5">
              <Label>스케줄 유형</Label>
              <select
                className="h-9 w-full max-w-xs rounded-md border border-app-border bg-app-surface px-2 text-sm"
                value={draft.scheduleType}
                disabled={busy}
                onChange={(e) => setDraft((d) => ({ ...d, scheduleType: e.target.value as ScheduleType }))}
              >
                <option value="DAILY">요일·시각 (DAILY)</option>
                <option value="CRON">CRON</option>
              </select>
            </div>
            {draft.scheduleType === 'DAILY' ? (
              <>
                <div className="space-y-1.5">
                  <Label>시각 (HH:mm, Seoul)</Label>
                  <Input value={draft.dailyTime} disabled={busy} onChange={(e) => setDraft((d) => ({ ...d, dailyTime: e.target.value }))} placeholder="09:00" />
                </div>
                <div className="space-y-2">
                  <Label>요일</Label>
                  <div className="flex flex-wrap gap-3">
                    {WD_LABELS.map((lab, i) => (
                      <label key={lab} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.dailyDays[i]}
                          disabled={busy}
                          onChange={(e) => {
                            const next = [...draft.dailyDays];
                            next[i] = e.target.checked;
                            setDraft((d) => ({ ...d, dailyDays: next }));
                          }}
                        />
                        {lab}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label>CRON 표현</Label>
                <Input
                  value={draft.cronExpression}
                  disabled={busy}
                  onChange={(e) => setDraft((d) => ({ ...d, cronExpression: e.target.value }))}
                  placeholder="0 9 * * *"
                />
                <p className="text-xs text-app-muted">5필드 또는 6필드. 서버가 5필드면 앞에 초 0을 붙입니다.</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>수신 이메일 (줄바꿈·쉼표·세미콜론 구분)</Label>
              <textarea
                className="min-h-[5rem] w-full rounded-md border border-app-border bg-app-surface p-2 text-sm"
                value={draft.toText}
                disabled={busy}
                onChange={(e) => setDraft((d) => ({ ...d, toText: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>제목 (비우면 메뉴 기본 제목 사용)</Label>
              <Input value={draft.subject} disabled={busy} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>본문 (비우면 메뉴 기본 본문 사용)</Label>
              <textarea
                className="min-h-[8rem] w-full rounded-md border border-app-border bg-app-surface p-2 text-sm"
                value={draft.body}
                disabled={busy}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>메일발송메뉴 (선택)</Label>
              <select
                className="h-9 w-full max-w-md rounded-md border border-app-border bg-app-surface px-2 text-sm"
                value={draft.mailMenuId}
                disabled={busy}
                onChange={(e) => setDraft((d) => ({ ...d, mailMenuId: e.target.value }))}
              >
                <option value="">(없음)</option>
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.code})
                  </option>
                ))}
              </select>
            </div>
          </DialogBody>
          <DialogFooter className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button type="button" variant="primary" size="sm" disabled={busy} loading={busy} onClick={() => void saveDraft()}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
