'use client';

import type { ErpUserRow } from '@samkwang/shared';
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
import { useCallback, useEffect, useState } from 'react';

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

type ErpUserPickDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (row: ErpUserRow) => void;
};

export function ErpUserPickDialog({ open, onOpenChange, onSelect }: ErpUserPickDialogProps) {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ErpUserRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) {
        params.set('q', search.trim());
      }
      const qs = params.toString();
      const res = await fetch(`/api/master-data/users/erp${qs ? `?${qs}` : ''}`, {
        credentials: 'include',
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        setRows([]);
        return;
      }
      setRows((await res.json()) as ErpUserRow[]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setRows([]);
      setLoadError(null);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open 시 1회만 ERP 목록 로드
  }, [open]);

  function handlePick(row: ErpUserRow) {
    onSelect(row);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>ERP 사용자 선택</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <FormField label="검색">
              <Input
                placeholder="아이디·이름·사번·부서"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void load();
                  }
                }}
              />
            </FormField>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              loading={loading}
              onClick={() => void load()}
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon icon="mdi:magnify" className="h-4 w-4 shrink-0" aria-hidden />
                조회
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
            ERP(KN_View_TCAUser + KN_View_TDAEmp) 기준 · {rows.length}건 (이미 등록된 아이디는 제외)
          </p>

          <div className="max-h-[min(50vh,420px)] overflow-auto rounded-md border border-app-border">
            <table className="pros-data-table text-app-text">
              <thead>
                <tr>
                  <th scope="col">아이디</th>
                  <th scope="col">이름</th>
                  <th scope="col">사번</th>
                  <th scope="col">부서</th>
                  <th scope="col" className="pros-cell-actions">
                    선택
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="pros-table-empty">
                      ERP 데이터를 불러오는 중…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="pros-table-empty">
                      표시할 ERP 사용자가 없습니다.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.userSeq}>
                      <td className="font-medium">{row.userId}</td>
                      <td>{row.userName}</td>
                      <td className="font-mono text-xs text-app-muted">{row.empid}</td>
                      <td className="text-app-muted">{row.deptName ?? '—'}</td>
                      <td className="pros-cell-actions">
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0"
                          onClick={() => handlePick(row)}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Icon icon="mdi:check-circle-outline" className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            선택
                          </span>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DialogBody>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon="mdi:close" className="h-4 w-4 shrink-0" aria-hidden />
              닫기
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
