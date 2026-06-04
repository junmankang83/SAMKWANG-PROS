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

type SmtpProfileRow = {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromName: string;
  fromAddress: string;
  hasPassword: boolean;
  sortOrder: number;
  updatedAt: string;
};

type Draft = {
  id: string | null;
  name: string;
  host: string;
  port: string;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromAddress: string;
  sortOrder: string;
};

function emptyDraft(): Draft {
  return {
    id: null,
    name: '',
    host: '',
    port: '587',
    secure: false,
    user: '',
    password: '',
    fromName: '',
    fromAddress: '',
    sortOrder: '0',
  };
}

function parseRecipientLines(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function MailSettingsRegistry() {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<SmtpProfileRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testProfile, setTestProfile] = useState<SmtpProfileRow | null>(null);
  const [testRecipientText, setTestRecipientText] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/mail/smtp', { credentials: 'include', cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        setRows([]);
        return;
      }
      const data = (await res.json()) as SmtpProfileRow[];
      setRows(Array.isArray(data) ? data : []);
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

  function openEdit(r: SmtpProfileRow) {
    setDraft({
      id: r.id,
      name: r.name,
      host: r.host,
      port: String(r.port),
      secure: r.secure,
      user: r.user,
      password: '',
      fromName: r.fromName,
      fromAddress: r.fromAddress,
      sortOrder: String(r.sortOrder ?? 0),
    });
    setDialogOpen(true);
  }

  async function saveDraft() {
    if (!draft.name.trim()) {
      setLoadError('프로필 이름을 입력해 주세요.');
      return;
    }
    const portNum = Math.min(65535, Math.max(1, Number(draft.port) || 587));
    const sortNum = Math.max(0, parseInt(draft.sortOrder, 10) || 0);
    const body: Record<string, unknown> = {
      name: draft.name.trim(),
      host: draft.host.trim(),
      port: portNum,
      secure: draft.secure,
      user: draft.user.trim(),
      fromName: draft.fromName.trim(),
      fromAddress: draft.fromAddress.trim(),
      sortOrder: sortNum,
    };
    if (draft.password.trim()) {
      body.password = draft.password.trim();
    }
    setBusy(true);
    setLoadError(null);
    setInfoMessage(null);
    try {
      const url = draft.id ? `/api/mail/smtp/${draft.id}` : '/api/mail/smtp';
      const method = draft.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
      setInfoMessage('저장했습니다.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeProfile(id: string, name: string) {
    if (!window.confirm(`「${name}」 SMTP 프로필을 삭제할까요?`)) {
      return;
    }
    setBusy(true);
    setLoadError(null);
    setInfoMessage(null);
    try {
      const res = await fetch(`/api/mail/smtp/${id}`, { method: 'DELETE', credentials: 'include' });
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

  function openTestDialog(r: SmtpProfileRow) {
    setTestProfile(r);
    setTestRecipientText('');
    setLoadError(null);
    setTestDialogOpen(true);
  }

  async function sendTestFromDialog() {
    if (!testProfile) {
      return;
    }
    const toAddresses = parseRecipientLines(testRecipientText);
    if (toAddresses.length === 0) {
      setLoadError('테스트 수신 이메일을 한 줄 이상 입력해 주세요.');
      return;
    }
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/mail/smtp/${testProfile.id}/test`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toAddresses }),
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        return;
      }
      const data = (await res.json()) as { messageId?: string };
      setTestDialogOpen(false);
      setTestProfile(null);
      alert(`테스트 메일을 발송했습니다.${data.messageId ? `\nmessageId: ${data.messageId}` : ''}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-app-text">메일설정</h1>
          <p className="mt-1 text-sm text-app-muted">
            SMTP 프로필을 여러 개 등록할 수 있습니다. 목록의 「테스트」로 연결 테스트 팝업을 열고, 수신자를 여러 명 넣을 수 있습니다. <strong className="text-app-text">메일발송정보</strong>의 각 규칙에서 사용할 프로필을 선택합니다. 비밀번호는 서버에 암호화되어 저장되며, 변경할 때만
            입력합니다.
          </p>
        </div>
        <Button type="button" variant="primary" size="sm" disabled={busy} onClick={openCreate}>
          <span className="inline-flex items-center gap-1.5">
            <Icon icon="mdi:plus" className="h-4 w-4 shrink-0" aria-hidden />
            프로필 추가
          </span>
        </Button>
      </div>

      {loadError ? (
        <Alert variant="error">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      {infoMessage ? (
        <Alert variant="success">
          <AlertTitle>알림</AlertTitle>
          <AlertDescription>{infoMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">SMTP 프로필 목록</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-3 py-2 sm:px-4">
          <table className="pros-data-table pros-data-table-head-center w-full table-fixed text-sm text-app-text">
            <thead>
              <tr className="bg-app-muted/30">
                <th className="w-12 px-1.5 py-2">순서</th>
                <th className="w-[18%] px-2 py-2">이름</th>
                <th className="w-[26%] px-2 py-2">호스트</th>
                <th className="w-14 px-1.5 py-2">포트</th>
                <th className="min-w-0 px-2 py-2 text-left">발신</th>
                <th className="w-[9.5rem] whitespace-nowrap px-1.5 py-2">작업</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="pros-table-empty text-app-muted">
                    등록된 프로필이 없습니다. 「프로필 추가」를 눌러 주세요.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-1.5 py-1.5 text-center tabular-nums">{r.sortOrder}</td>
                    <td className="truncate px-2 py-1.5 font-medium" title={r.name}>
                      {r.name}
                    </td>
                    <td className="truncate px-2 py-1.5 font-mono text-xs" title={r.host}>
                      {r.host || '—'}
                    </td>
                    <td className="px-1.5 py-1.5 text-center tabular-nums">{r.port}</td>
                    <td className="truncate px-2 py-1.5 text-left text-xs" title={`${r.fromName} <${r.fromAddress}>`}>
                      {r.fromName || r.fromAddress ? `${r.fromName} <${r.fromAddress}>` : '—'}
                    </td>
                    <td className="px-1.5 py-1.5">
                      <div className="flex flex-nowrap items-center justify-end gap-1">
                        <Button type="button" variant="secondary" size="sm" className="h-7 shrink-0 px-2 text-xs" disabled={busy} onClick={() => openEdit(r)}>
                          수정
                        </Button>
                        <Button type="button" variant="danger" size="sm" className="h-7 shrink-0 px-2 text-xs" disabled={busy} onClick={() => void removeProfile(r.id, r.name)}>
                          삭제
                        </Button>
                        <Button type="button" variant="secondary" size="sm" className="h-7 shrink-0 px-2 text-xs" disabled={busy} onClick={() => openTestDialog(r)}>
                          테스트
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

      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent size="sm" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>연결 테스트 — {testProfile?.name ?? ''}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-xs text-app-muted">
              수신자 이메일을 줄바꿈·쉼표·세미콜론으로 구분해 입력하세요. 한 통의 메일에 여러 수신자가 포함됩니다(최대 50명).
            </p>
            {testProfile ? (
              <p className="text-xs font-mono text-app-muted">
                {testProfile.host}:{testProfile.port} · 발신 {testProfile.fromAddress}
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="smtp-test-recipients">수신자 목록</Label>
              <textarea
                id="smtp-test-recipients"
                className="min-h-[8rem] w-full rounded-md border border-app-border bg-app-surface p-2 text-sm text-app-text"
                value={testRecipientText}
                disabled={busy}
                onChange={(e) => setTestRecipientText(e.target.value)}
                placeholder={'user1@example.com\nuser2@example.com'}
                spellCheck={false}
              />
            </div>
          </DialogBody>
          <DialogFooter className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => setTestDialogOpen(false)}>
              취소
            </Button>
            <Button type="button" variant="primary" size="sm" disabled={busy || !testProfile} loading={busy} onClick={() => void sendTestFromDialog()}>
              <span className="inline-flex items-center gap-1.5">
                <Icon icon="mdi:email-send-outline" className="h-4 w-4 shrink-0" aria-hidden />
                테스트 메일 발송
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="lg" className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{draft.id ? 'SMTP 프로필 수정' : 'SMTP 프로필 추가'}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label>프로필 이름</Label>
              <Input value={draft.name} disabled={busy} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="예: 본사 발신" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>호스트</Label>
                <Input value={draft.host} disabled={busy} onChange={(e) => setDraft((d) => ({ ...d, host: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>포트</Label>
                <Input type="number" min={1} max={65535} value={draft.port} disabled={busy} onChange={(e) => setDraft((d) => ({ ...d, port: e.target.value }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-app-text">
              <input type="checkbox" checked={draft.secure} disabled={busy} onChange={(e) => setDraft((d) => ({ ...d, secure: e.target.checked }))} />
              TLS/SSL (secure)
            </label>
            <div className="space-y-1.5">
              <Label>사용자명</Label>
              <Input value={draft.user} disabled={busy} onChange={(e) => setDraft((d) => ({ ...d, user: e.target.value }))} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label>비밀번호 {draft.id && draft.name ? '(변경 시에만 입력)' : ''}</Label>
              <Input
                type="password"
                value={draft.password}
                disabled={busy}
                onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
                autoComplete="new-password"
                placeholder={draft.id ? '••••••••' : ''}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>발신 표시 이름</Label>
                <Input value={draft.fromName} disabled={busy} onChange={(e) => setDraft((d) => ({ ...d, fromName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>발신 이메일</Label>
                <Input type="email" value={draft.fromAddress} disabled={busy} onChange={(e) => setDraft((d) => ({ ...d, fromAddress: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>정렬 순서 (작을수록 앞)</Label>
              <Input type="number" min={0} value={draft.sortOrder} disabled={busy} onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))} />
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
