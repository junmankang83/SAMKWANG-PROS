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
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function LoginForm() {
  const router = useRouter();
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
      router.push('/app');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl tracking-tight">SAMKWANG-PROS</CardTitle>
        <CardDescription>생산관리시스템 로그인</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
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
          <div className="border-t border-app-border pt-4">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={pending}
              disabled={pending}
            >
              로그인
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
