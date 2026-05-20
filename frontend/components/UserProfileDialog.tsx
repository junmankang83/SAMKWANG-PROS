'use client';

import type { AuthUser } from '@samkwang/shared';
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
  FormGrid,
  Input,
} from '@samkwang/ui-kit';
import { useState } from 'react';

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

type UserProfileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AuthUser;
};

export function UserProfileDialog({ open, onOpenChange, user }: UserProfileDialogProps) {
  const isDemo = user.id === 'demo';
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function resetPasswordForm() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setCurrentPasswordError(null);
    setSuccess(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      resetPasswordForm();
    }
    onOpenChange(next);
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCurrentPasswordError(null);
    setSuccess(null);

    if (!currentPassword.trim()) {
      setCurrentPasswordError('현재 비밀번호를 입력하세요.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('새 비밀번호와 확인이 일치하지 않습니다.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.status === 401) {
        const msg = await readApiError(res);
        if (msg.includes('로그인') || msg.includes('세션')) {
          window.location.href = '/login';
          return;
        }
        setCurrentPasswordError(msg);
        return;
      }
      if (!res.ok) {
        const msg = await readApiError(res);
        if (msg.includes('현재 비밀번호')) {
          setCurrentPasswordError(msg);
          return;
        }
        setError(msg);
        return;
      }
      resetPasswordForm();
      setSuccess('비밀번호가 변경되었습니다.');
    } finally {
      setBusy(false);
    }
  }

  const displayName = user.name?.trim() || '—';

  const profileRows = [
    { label: '이름', value: displayName, emphasize: true },
    { label: '아이디', value: user.username },
    { label: '조직', value: user.organization?.trim() || '—' },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>사용자 정보</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-6">
          <div className="flex items-center gap-3 border-b border-app-border pb-4">
            <span
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/12 text-brand"
              aria-hidden
            >
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </span>
            <p className="text-lg font-semibold text-app-text">{displayName}</p>
          </div>

          <dl className="space-y-3 text-sm">
            {profileRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-6">
                <dt className="shrink-0 text-app-muted">{row.label}</dt>
                <dd
                  className={
                    row.emphasize
                      ? 'min-w-0 text-right font-semibold text-app-text'
                      : 'min-w-0 text-right font-medium text-app-text'
                  }
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          {isDemo ? (
            <p className="text-sm text-app-muted">데모 계정은 비밀번호를 변경할 수 없습니다.</p>
          ) : (
            <form className="space-y-4 border-t border-app-border pt-4" onSubmit={submitPassword}>
              <p className="text-sm font-medium text-app-text">비밀번호 변경</p>
              <FormGrid fullWidth>
                <FormField label="현재 비밀번호" required>
                  <Input
                    required
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    aria-invalid={currentPasswordError ? true : undefined}
                    className={currentPasswordError ? 'border-error focus:border-error' : undefined}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      if (currentPasswordError) {
                        setCurrentPasswordError(null);
                      }
                    }}
                  />
                  {currentPasswordError ? (
                    <p className="mt-1 text-sm text-error" role="alert">
                      {currentPasswordError}
                    </p>
                  ) : null}
                </FormField>
                <FormField label="새 비밀번호" required>
                  <Input
                    required
                    type="password"
                    autoComplete="new-password"
                    minLength={4}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </FormField>
                <FormField label="새 비밀번호 확인" required>
                  <Input
                    required
                    type="password"
                    autoComplete="new-password"
                    minLength={4}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </FormField>
              </FormGrid>
              {error ? (
                <Alert variant="error">
                  <AlertTitle>오류</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              {success ? (
                <Alert variant="success">
                  <AlertTitle>완료</AlertTitle>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" variant="primary" disabled={busy} loading={busy}>
                비밀번호 변경
              </Button>
            </form>
          )}
        </DialogBody>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
