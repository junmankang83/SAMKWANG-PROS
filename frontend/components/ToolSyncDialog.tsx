'use client';

import type { ErpToolRow, ToolsSyncResult } from '@samkwang/shared';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
} from '@samkwang/ui-kit';
import { Icon } from '@iconify/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

async function readApiError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const m = body?.message;
  if (Array.isArray(m)) {
    return m.join(', ');
  }
  if (typeof m === 'string') {
    return m;
  }
  return `요청 실패 (${res.status})`;
}

type ToolSyncDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: (result: ToolsSyncResult) => void;
};

const ALL_KIND = '__ALL__';

export function ToolSyncDialog({ open, onOpenChange, onApplied }: ToolSyncDialogProps) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<string>(ALL_KIND);
  const [rows, setRows] = useState<ErpToolRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const kindOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const name = r.umToolKindName?.trim();
      if (name) {
        set.add(name);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (kind === ALL_KIND) {
      return rows;
    }
    return rows.filter((r) => (r.umToolKindName?.trim() ?? '') === kind);
  }, [rows, kind]);

  const counts = useMemo(() => {
    const inserted = filteredRows.filter((r) => r.status === 'new').length;
    const updated = filteredRows.filter((r) => r.status === 'update').length;
    return { inserted, updated, total: filteredRows.length };
  }, [filteredRows]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) {
        params.set('q', search.trim());
      }
      const qs = params.toString();
      const res = await fetch(
        `/api/master-data/tools/sync/preview${qs ? `?${qs}` : ''}`,
        { credentials: 'include' },
      );
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        setRows([]);
        return;
      }
      setRows((await res.json()) as ErpToolRow[]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setKind(ALL_KIND);
      setRows([]);
      setLoadError(null);
      return;
    }
    void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open 시 1회만 ERP 미리보기 로드
  }, [open]);

  async function handleSave() {
    if (filteredRows.length === 0) {
      return;
    }
    setSaving(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/master-data/tools/sync', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolSeqs: filteredRows.map((r) => r.toolSeq) }),
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        return;
      }
      const result = (await res.json()) as ToolsSyncResult;
      onApplied(result);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>설비정보 동기화</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <FormField label="검색">
              <Input
                placeholder="설비명·번호·자산명"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void loadPreview();
                  }
                }}
              />
            </FormField>
            <FormField label="설비종류">
              <select
                className="sk-form-input"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                aria-label="설비종류"
              >
                <option value={ALL_KIND}>전체</option>
                {kindOptions.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </FormField>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              loading={loading}
              onClick={() => void loadPreview()}
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon icon="mdi:refresh" className="h-4 w-4 shrink-0" aria-hidden />
                다시 조회
              </span>
            </Button>
          </div>

          {loadError ? (
            <Alert variant="error">
              <AlertTitle>오류</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : null}

          <p className="text-sm text-app-muted">
            ERP(KN_View_TPDTool) 기준 · 표시 {counts.total}건 (신규 {counts.inserted}건 · 갱신{' '}
            {counts.updated}건)
            {kind !== ALL_KIND ? ` · 전체 ${rows.length}건` : ''}
          </p>

          <SyncPreviewTable rows={filteredRows} loading={loading} />
        </DialogBody>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon="mdi:close" className="h-4 w-4 shrink-0" aria-hidden />
              취소
            </span>
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={saving || loading || filteredRows.length === 0}
            loading={saving}
            onClick={() => void handleSave()}
          >
            <span className="inline-flex items-center gap-1.5">
              <Icon icon="mdi:content-save-outline" className="h-4 w-4 shrink-0" aria-hidden />
              저장
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SyncPreviewTable({ rows, loading }: { rows: ErpToolRow[]; loading: boolean }) {
  return (
    <div className="max-h-[min(60vh,520px)] overflow-auto rounded-md border border-app-border">
      <table className="pros-data-table pros-data-table-head-center text-app-text">
        <thead>
          <tr>
            <th scope="col" className="pros-cell-center" style={{ width: '10%' }}>
              상태
            </th>
            <th scope="col" className="pros-cell-center" style={{ width: '10%' }}>
              설비코드
            </th>
            <th scope="col" className="pros-cell-center" style={{ width: '35%' }}>
              설비명
            </th>
            <th scope="col" className="pros-cell-center" style={{ width: '10%' }}>
              설비번호
            </th>
            <th scope="col" className="pros-cell-center" style={{ width: '25%' }}>
              규격
            </th>
            <th scope="col" className="pros-cell-center" style={{ width: '10%' }}>
              설비종류
            </th>
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="pros-table-empty">
                ERP 데이터를 불러오는 중…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="pros-table-empty">
                조회된 설비정보가 없습니다.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.toolSeq}>
                <td className="pros-cell-center">
                  <span
                    className={
                      row.status === 'new'
                        ? 'inline-block rounded px-2 py-0.5 text-xs font-medium text-primary'
                        : 'inline-block rounded px-2 py-0.5 text-xs font-medium text-app-muted'
                    }
                  >
                    {row.status === 'new' ? '신규' : '갱신'}
                  </span>
                </td>
                <td className="pros-cell-center font-mono text-xs">{row.toolSeq}</td>
                <td className="pros-cell-center font-medium">{row.toolName}</td>
                <td className="pros-cell-center font-mono text-xs">{row.toolNo}</td>
                <td className="pros-cell-center text-app-muted">{row.spec ?? '—'}</td>
                <td className="pros-cell-center text-app-muted">{row.umToolKindName ?? '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
