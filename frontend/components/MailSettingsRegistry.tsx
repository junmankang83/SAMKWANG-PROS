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

type SmtpSettings = {
  id: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromName: string;
  fromAddress: string;
  hasPassword: boolean;
  updatedAt: string;
};

export function MailSettingsRegistry() {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [secure, setSecure] = useState(false);
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [testTo, setTestTo] = useState('');

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
        return;
      }
      const data = (await res.json()) as SmtpSettings;
      setHost(data.host);
      setPort(String(data.port));
      setSecure(data.secure);
      setUser(data.user);
      setFromName(data.fromName);
      setFromAddress(data.fromAddress);
      setHasPassword(data.hasPassword);
      setPassword('');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setLoadError(null);
    try {
      const body: Record<string, unknown> = {
        host: host.trim(),
        port: Number(port) || 587,
        secure,
        user: user.trim(),
        fromName: fromName.trim(),
        fromAddress: fromAddress.trim(),
      };
      if (password.trim()) {
        body.password = password.trim();
      }
      const res = await fetch('/api/mail/smtp', {
        method: 'PUT',
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
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!testTo.trim()) {
      setLoadError('테스트 수신 이메일을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/mail/smtp/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testTo.trim() }),
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
      setLoadError(null);
      alert(`테스트 메일을 발송했습니다.${data.messageId ? `\nmessageId: ${data.messageId}` : ''}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-app-text">메일설정</h1>
        <p className="mt-1 text-sm text-app-muted">
          SMTP 발신 정보를 저장합니다. 비밀번호는 서버에 암호화되어 저장되며, 저장 후에는 다시 입력할 때만 변경됩니다.
        </p>
      </div>

      {loadError ? (
        <Alert variant="error">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">SMTP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mail-host">호스트</Label>
              <Input id="mail-host" value={host} disabled={busy} onChange={(e) => setHost(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mail-port">포트</Label>
              <Input
                id="mail-port"
                type="number"
                min={1}
                max={65535}
                value={port}
                disabled={busy}
                onChange={(e) => setPort(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-app-text">
            <input type="checkbox" checked={secure} disabled={busy} onChange={(e) => setSecure(e.target.checked)} />
            TLS/SSL (secure)
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="mail-user">사용자명</Label>
            <Input id="mail-user" value={user} disabled={busy} onChange={(e) => setUser(e.target.value)} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mail-pass">비밀번호 {hasPassword ? '(변경 시에만 입력)' : ''}</Label>
            <Input
              id="mail-pass"
              type="password"
              value={password}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder={hasPassword ? '••••••••' : ''}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mail-from-name">발신 표시 이름</Label>
              <Input id="mail-from-name" value={fromName} disabled={busy} onChange={(e) => setFromName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mail-from-addr">발신 이메일</Label>
              <Input
                id="mail-from-addr"
                type="email"
                value={fromAddress}
                disabled={busy}
                onChange={(e) => setFromAddress(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="primary" size="sm" disabled={busy} loading={busy} onClick={() => void save()}>
              <span className="inline-flex items-center gap-1.5">
                <Icon icon="mdi:content-save-outline" className="h-4 w-4 shrink-0" aria-hidden />
                저장
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">연결 테스트</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mail-test-to">테스트 수신 주소</Label>
            <Input
              id="mail-test-to"
              type="email"
              value={testTo}
              disabled={busy}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void sendTest()}>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon="mdi:email-send-outline" className="h-4 w-4 shrink-0" aria-hidden />
              테스트 메일 발송
            </span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
