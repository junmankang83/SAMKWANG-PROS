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
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@samkwang/ui-kit';
import { suggestNextMenuCode, suggestNextSortOrder } from '@/lib/mail/next-menu-defaults';
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

function truncate(s: string, max: number): string {
  if (s.length <= max) {
    return s;
  }
  return `${s.slice(0, max)}…`;
}

type DefRow = {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  menuQuery: string;
};

function normalizeRow(raw: Record<string, unknown>): DefRow {
  return {
    id: String(raw.id ?? ''),
    code: String(raw.code ?? ''),
    label: String(raw.label ?? ''),
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : Number(raw.sortOrder) || 0,
    menuQuery: typeof raw.menuQuery === 'string' ? raw.menuQuery : '',
  };
}

type DraftState = {
  id: string | null;
  code: string;
  label: string;
  sortOrder: string;
  menuQuery: string;
};

function emptyDraft(): DraftState {
  return {
    id: null,
    code: '',
    label: '',
    sortOrder: '0',
    menuQuery: '',
  };
}

type MailMenuDefinitionRegistryProps = {
  title?: string;
};

export function MailMenuDefinitionRegistry({ title = '메일 메뉴관리' }: MailMenuDefinitionRegistryProps = {}) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<DefRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());

  const load = useCallback(async () => {
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/mail/menus', { credentials: 'include', cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        setRows([]);
        return;
      }
      const raw = (await res.json()) as Record<string, unknown>[];
      setRows(raw.map((r) => normalizeRow(r)));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setLoadError(null);
    const nextCode = suggestNextMenuCode(rows);
    setDraft({
      id: null,
      code: nextCode,
      label: nextCode,
      sortOrder: suggestNextSortOrder(rows),
      menuQuery: '',
    });
    setDialogOpen(true);
  }

  function openEdit(r: DefRow) {
    setLoadError(null);
    setDraft({
      id: r.id,
      code: r.code,
      label: r.code,
      sortOrder: String(r.sortOrder),
      menuQuery: r.menuQuery,
    });
    setDialogOpen(true);
  }

  async function saveDraft() {
    const codeTrim = draft.code.trim();
    if (!codeTrim) {
      setLoadError('메뉴코드는 필수입니다.');
      return;
    }
    const sortOrder = Math.max(0, parseInt(draft.sortOrder, 10) || 0);
    const payload = {
      code: codeTrim,
      label: codeTrim,
      sortOrder,
      menuQuery: draft.menuQuery,
    };
    setBusy(true);
    setLoadError(null);
    try {
      const url = draft.id ? `/api/mail/menus/${draft.id}` : '/api/mail/menus';
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
      await load();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '저장 중 네트워크 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, label: string) {
    if (!window.confirm(`「${label}」 메뉴를 삭제할까요? 연결된 발송 규칙의 메뉴 참조는 해제됩니다.`)) {
      return;
    }
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/mail/menus/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-app-text">{title}</h1>
        </div>
        <Button type="button" variant="primary" size="sm" disabled={busy} onClick={openCreate}>
          <span className="inline-flex items-center gap-1.5">
            <Icon icon="mdi:plus" className="h-4 w-4 shrink-0" aria-hidden />
            추가
          </span>
        </Button>
      </div>

      {loadError && !dialogOpen ? (
        <Alert variant="error">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">메뉴 목록</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-0">
          <table className="pros-data-table pros-data-table-head-center w-full min-w-[48rem] text-sm text-app-text">
            <thead>
              <tr className="bg-app-muted/30">
                <th className="px-2 py-2">순번</th>
                <th className="px-2 py-2">메뉴코드</th>
                <th className="px-2 py-2">메뉴명</th>
                <th className="px-2 py-2">메뉴쿼리</th>
                <th className="px-2 py-2">작업</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="pros-table-empty text-app-muted">
                    등록된 메뉴가 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const queryText = r.menuQuery.trim();
                  return (
                    <tr key={r.id}>
                      <td className="pros-cell-center px-2 py-1.5">{r.sortOrder}</td>
                      <td className="pros-cell-center px-2 py-1.5 font-mono text-xs">{r.code}</td>
                      <td className="pros-cell-center px-2 py-1.5 font-medium">{r.label}</td>
                      <td
                        className="pros-cell-center max-w-[20rem] truncate px-2 py-1.5 font-mono text-xs"
                        title={queryText || undefined}
                      >
                        {queryText ? truncate(queryText, 120) : '-'}
                      </td>
                      <td className="pros-cell-actions px-2 py-1.5">
                        <div className="flex flex-wrap justify-center gap-1">
                          <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" disabled={busy} onClick={() => openEdit(r)}>
                            수정
                          </Button>
                          <Button type="button" variant="danger" size="sm" className="h-7 text-xs" disabled={busy} onClick={() => void remove(r.id, r.label)}>
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
        <DialogContent
          size="lg"
          className="flex h-[80dvh] max-h-[80dvh] w-[60vw] min-w-[min(100%,20rem)] max-w-[60vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[60vw]"
        >
          <DialogHeader className="flex shrink-0 flex-row flex-wrap items-center justify-between gap-3 border-b border-app-border px-4 py-3 sm:px-6">
            <DialogTitle className="text-left">{draft.id ? '메뉴 수정' : '메뉴 추가'}</DialogTitle>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => setDialogOpen(false)}>
                취소
              </Button>
              <Button type="button" variant="primary" size="sm" disabled={busy} loading={busy} onClick={() => void saveDraft()}>
                저장
              </Button>
            </div>
          </DialogHeader>
          <DialogBody className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 py-4 sm:px-6">
            {loadError ? (
              <Alert variant="error" className="shrink-0">
                <AlertTitle>오류</AlertTitle>
                <AlertDescription>{loadError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex shrink-0 flex-col gap-4">
              <div className="space-y-1.5">
                <Label>순번</Label>
                <Input type="number" min={0} value={draft.sortOrder} disabled={busy} onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>메뉴코드 (영문·숫자·하이픈 등)</Label>
                <Input
                  value={draft.code}
                  disabled={busy || Boolean(draft.id)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft((d) => ({ ...d, code: v, label: v }));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>메뉴명 (메뉴코드와 동일·수정 불가)</Label>
                <Input value={draft.code} readOnly disabled={busy} className="cursor-not-allowed bg-app-muted/30" aria-readonly />
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-1.5">
              <Label className="shrink-0">메뉴쿼리</Label>
              <textarea
                className="min-h-[10rem] w-full flex-1 basis-0 resize-none overflow-y-auto rounded-md border border-app-border bg-app-surface p-3 font-mono text-xs leading-relaxed"
                value={draft.menuQuery}
                disabled={busy}
                placeholder="SQL 또는 긴 텍스트를 입력하세요."
                onChange={(e) => setDraft((d) => ({ ...d, menuQuery: e.target.value }))}
              />
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
