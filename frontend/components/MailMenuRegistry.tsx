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

type MenuRow = {
  id: string;
  code: string;
  label: string;
  defaultSubject: string;
  defaultBody: string;
  sortOrder: number;
};

function emptyDraft(): {
  id: string | null;
  code: string;
  label: string;
  defaultSubject: string;
  defaultBody: string;
  sortOrder: string;
} {
  return {
    id: null,
    code: '',
    label: '',
    defaultSubject: '',
    defaultBody: '',
    sortOrder: '0',
  };
}

type MailMenuRegistryProps = {
  /** 페이지 상단 제목 (기본: 메일발송메뉴) */
  title?: string;
  /** 페이지 상단 설명 */
  description?: string;
};

const DEFAULT_DESCRIPTION =
  '발송 종류별 기본 제목·본문을 정의합니다. 메일발송정보에서 메뉴를 선택하면 제목·본문이 비어 있을 때 여기 값이 사용됩니다.';

export function MailMenuRegistry({
  title = '메일발송메뉴',
  description = DEFAULT_DESCRIPTION,
}: MailMenuRegistryProps = {}) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<MenuRow[]>([]);
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
      setRows((await res.json()) as MenuRow[]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setDraft(emptyDraft());
    setDialogOpen(true);
  }

  function openEdit(r: MenuRow) {
    setDraft({
      id: r.id,
      code: r.code,
      label: r.label,
      defaultSubject: r.defaultSubject,
      defaultBody: r.defaultBody,
      sortOrder: String(r.sortOrder),
    });
    setDialogOpen(true);
  }

  async function saveDraft() {
    if (!draft.code.trim() || !draft.label.trim()) {
      setLoadError('코드와 라벨은 필수입니다.');
      return;
    }
    const sortOrder = Math.max(0, parseInt(draft.sortOrder, 10) || 0);
    const payload = {
      code: draft.code.trim(),
      label: draft.label.trim(),
      defaultSubject: draft.defaultSubject.trim(),
      defaultBody: draft.defaultBody,
      sortOrder,
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
          <p className="mt-1 max-w-3xl text-sm text-app-muted">{description}</p>
        </div>
        <Button type="button" variant="primary" size="sm" disabled={busy} onClick={openCreate}>
          <span className="inline-flex items-center gap-1.5">
            <Icon icon="mdi:plus" className="h-4 w-4 shrink-0" aria-hidden />
            메뉴 추가
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
          <CardTitle className="text-base">메뉴 목록</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-0">
          <table className="pros-data-table pros-data-table-head-center w-full min-w-[40rem] text-sm text-app-text">
            <thead>
              <tr className="bg-app-muted/30">
                <th className="px-2 py-2">정렬</th>
                <th className="px-2 py-2">코드</th>
                <th className="px-2 py-2">라벨</th>
                <th className="px-2 py-2 text-left">기본 제목</th>
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
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-1.5">{r.sortOrder}</td>
                    <td className="px-2 py-1.5 font-mono text-xs">{r.code}</td>
                    <td className="px-2 py-1.5 font-medium">{r.label}</td>
                    <td className="max-w-[16rem] truncate px-2 py-1.5 text-left">{r.defaultSubject || '—'}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap gap-1">
                        <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" disabled={busy} onClick={() => openEdit(r)}>
                          수정
                        </Button>
                        <Button type="button" variant="danger" size="sm" className="h-7 text-xs" disabled={busy} onClick={() => void remove(r.id, r.label)}>
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? '메뉴 수정' : '메뉴 추가'}</DialogTitle>
          </DialogHeader>
          <DialogBody className="max-h-[min(75vh,36rem)] space-y-3 overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>코드 (영문·숫자·하이픈 등)</Label>
                <Input value={draft.code} disabled={busy || Boolean(draft.id)} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>정렬 순서</Label>
                <Input type="number" min={0} value={draft.sortOrder} disabled={busy} onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>라벨</Label>
              <Input value={draft.label} disabled={busy} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>기본 제목</Label>
              <Input value={draft.defaultSubject} disabled={busy} onChange={(e) => setDraft((d) => ({ ...d, defaultSubject: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>기본 본문</Label>
              <textarea
                className="min-h-[10rem] w-full rounded-md border border-app-border bg-app-surface p-2 text-sm"
                value={draft.defaultBody}
                disabled={busy}
                onChange={(e) => setDraft((d) => ({ ...d, defaultBody: e.target.value }))}
              />
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
