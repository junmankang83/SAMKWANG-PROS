'use client';

import { Button } from '@samkwang/ui-kit';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { APP_DOMAINS } from '@/lib/navigation/app-menu';

export function AppTopNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-app-border bg-app-surface-02 px-4 shadow-topbar">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app" className="font-semibold">
            SAMKWANG-PROS
          </Link>
        </Button>
        <nav className="flex flex-wrap gap-1" aria-label="주 메뉴">
          {APP_DOMAINS.map((d) => {
            const active = pathname === d.basePath || pathname.startsWith(`${d.basePath}/`);
            return (
              <Button key={d.id} variant={active ? 'primary' : 'ghost'} size="sm" asChild>
                <Link href={d.basePath}>{d.label}</Link>
              </Button>
            );
          })}
        </nav>
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={() => void logout()}>
        로그아웃
      </Button>
    </header>
  );
}
