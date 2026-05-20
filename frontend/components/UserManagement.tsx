'use client';

import type { ErpUserRow, UserRow } from '@samkwang/shared';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  FormGrid,
  Input,
} from '@samkwang/ui-kit';
import { useCallback, useEffect, useState } from 'react';
import { ErpUserPickDialog } from '@/components/ErpUserPickDialog';

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const emptyForm = () => ({
  username: '',
  name: '',
  password: '',
  organization: '',
});

export function UserManagement() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [erpPickOpen, setErpPickOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);

  const reload = useCallback(async () => {
    setLoadError(null);
    const res = await fetch('/api/master-data/users', { credentials: 'include' });
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (!res.ok) {
      setLoadError(await readApiError(res));
      return;
    }
    setRows((await res.json()) as UserRow[]);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/master-data/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: addForm.username.trim(),
          name: addForm.name.trim(),
          password: addForm.password,
          organization: addForm.organization.trim(),
        }),
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        return;
      }
      setAddOpen(false);
      setAddForm(emptyForm());
      await reload();
    } finally {
      setBusy(false);
    }
  }

  function applyErpUser(row: ErpUserRow) {
    const userId = row.userId.trim();
    setAddForm((f) => ({
      ...f,
      username: userId,
      name: row.userName.trim(),
      password: userId,
      organization: row.deptName?.trim() ?? '',
    }));
  }

  async function removeRow(row: UserRow) {
    if (!confirm(`「${row.username}」 사용자를 삭제할까요?\n삭제 후에는 복구할 수 없습니다.`)) {
      return;
    }
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/master-data/users/${row.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-app-text">사용자 관리</h1>
          <p className="mt-1 text-sm text-app-muted">시스템 로그인 계정을 등록·관리합니다.</p>
        </div>
        <Button type="button" variant="primary" onClick={() => setAddOpen(true)}>
          사용자 등록
        </Button>
      </div>

      {loadError ? (
        <Alert variant="error">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="shadow-card">
        <CardContent className="p-0 pt-4">
          <div className="overflow-x-auto">
            <table className="pros-data-table text-app-text">
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '23%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">아이디</th>
                  <th scope="col">이름</th>
                  <th scope="col">조직</th>
                  <th scope="col">등록일시</th>
                  <th scope="col" className="pros-cell-actions">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="pros-table-empty">
                      등록된 사용자가 없습니다.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="font-medium">{row.username}</td>
                      <td>{row.name || '—'}</td>
                      <td className="text-app-muted">{row.organization}</td>
                      <td className="font-mono text-xs text-app-muted">{formatDate(row.createdAt)}</td>
                      <td className="pros-cell-actions">
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-error"
                          onClick={() => void removeRow(row)}
                        >
                          삭제
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent size="default">
          <form onSubmit={submitAdd}>
            <DialogHeader className="flex flex-row flex-wrap items-center gap-2 pr-10">
              <DialogTitle className="flex-1 min-w-0">사용자 등록</DialogTitle>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={() => setErpPickOpen(true)}
              >
                ERP 사용자 선택
              </Button>
            </DialogHeader>
            <DialogBody>
              <FormGrid>
                <FormField label="아이디" required>
                  <Input
                    required
                    autoComplete="username"
                    value={addForm.username}
                    onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
                  />
                </FormField>
                <FormField label="이름" required>
                  <Input
                    required
                    autoComplete="name"
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </FormField>
                <FormField label="비밀번호" required>
                  <Input
                    required
                    type="password"
                    autoComplete="new-password"
                    minLength={4}
                    value={addForm.password}
                    onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </FormField>
                <FormField label="조직" required fullWidth>
                  <Input
                    required
                    value={addForm.organization}
                    onChange={(e) => setAddForm((f) => ({ ...f, organization: e.target.value }))}
                  />
                </FormField>
              </FormGrid>
            </DialogBody>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
                취소
              </Button>
              <Button type="submit" variant="primary" disabled={busy} loading={busy}>
                저장
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ErpUserPickDialog
        open={erpPickOpen}
        onOpenChange={setErpPickOpen}
        onSelect={applyErpUser}
      />
    </div>
  );
}
