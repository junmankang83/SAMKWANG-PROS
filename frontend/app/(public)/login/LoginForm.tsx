'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@samkwang/ui-kit';
import { Icon } from '@iconify/react';
import { useState, type FormEvent } from 'react';

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const username = (form.elements.namedItem('username') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? '로그인에 실패했습니다.');
        return;
      }
      window.location.assign('/app');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full border-0 bg-white/[0.97] shadow-2xl shadow-black/25 ring-1 ring-white/60 backdrop-blur-md dark:bg-slate-950/90 dark:ring-white/10">
      <CardHeader className="space-y-1 border-b border-slate-200/80 pb-4 dark:border-slate-700/80">
        <CardTitle className="text-center text-lg font-semibold text-slate-900 dark:text-slate-100">로그인</CardTitle>
        <CardDescription className="text-center text-sm text-slate-500 dark:text-slate-400">
          아이디와 비밀번호를 입력한 뒤 아래 버튼으로 접속합니다.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4 pt-6">
          <Input
            id="username"
            name="username"
            label="아이디"
            autoComplete="username"
            required
            disabled={pending}
          />
          <Input
            id="password"
            name="password"
            type="password"
            label="비밀번호"
            autoComplete="current-password"
            required
            disabled={pending}
          />
          {error ? (
            <Alert variant="error">
              <AlertTitle>로그인 실패</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            fullWidth
            className="mt-2 h-11 text-base font-medium shadow-md shadow-indigo-500/20 transition hover:opacity-[0.98]"
            loading={pending}
            disabled={pending}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Icon icon="mdi:login" className="h-5 w-5 shrink-0" aria-hidden />
              로그인
            </span>
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
