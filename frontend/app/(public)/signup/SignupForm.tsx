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
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function SignupForm() {
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
    const organization = (form.elements.namedItem('organization') as HTMLInputElement)
      .value;
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password, organization }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string | string[];
        } | null;
        const msg = body?.message;
        setError(
          Array.isArray(msg) ? msg.join(', ') : (msg ?? '회원가입에 실패했습니다.'),
        );
        return;
      }
      window.location.assign('/app');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Card className="shadow-card">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl tracking-tight">ERP INFO MAILER</CardTitle>
          <CardDescription>회원가입</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <Input
              id="username"
              name="username"
              label="아이디"
              autoComplete="username"
              required
              minLength={3}
              disabled={pending}
            />
            <Input
              id="password"
              name="password"
              type="password"
              label="비밀번호"
              autoComplete="new-password"
              required
              minLength={6}
              disabled={pending}
            />
            <Input
              id="organization"
              name="organization"
              label="조직정보"
              autoComplete="organization"
              required
              disabled={pending}
            />
            {error ? (
              <Alert variant="error">
                <AlertTitle>회원가입 실패</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="border-t border-app-border pt-4">
              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={pending}
                disabled={pending}
              >
                가입하기
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-app-muted">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="font-medium text-app-text underline-offset-4 hover:underline">
          로그인
        </Link>
      </p>
    </>
  );
}
