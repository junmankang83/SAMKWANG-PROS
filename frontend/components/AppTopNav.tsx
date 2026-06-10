'use client';

import type { AuthUser } from '@samkwang/shared';
import { Button } from '@samkwang/ui-kit';
import { Icon } from '@iconify/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { UserProfileDialog } from '@/components/UserProfileDialog';
import { useNavVisibility } from '@/components/NavVisibilityContext';
import { APP_DOMAINS } from '@/lib/navigation/app-menu';

const navLinkBase =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-base font-medium transition-colors no-underline';
const navLinkIdle = `${navLinkBase} text-app-text hover:bg-app-hover`;
const navLinkActive = `${navLinkBase} bg-brand text-app-text-on-color hover:bg-brand-hover`;

function formatUserDisplayName(user: AuthUser): string {
  return user.name?.trim() || user.username;
}

function UserAvatarIcon() {
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/12 text-brand"
      aria-hidden
    >
      <Icon icon="mdi:account-tie-outline" className="h-5 w-5 shrink-0" aria-hidden />
    </span>
  );
}

type AppTopNavProps = {
  user: AuthUser;
};

export function AppTopNav({ user }: AppTopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const { visibility } = useNavVisibility();

  const visibleDomains = useMemo(
    () => APP_DOMAINS.filter((d) => visibility[d.id] === true),
    [visibility],
  );

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-app-border bg-app-surface-02 px-4 shadow-topbar print:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Link
            href="/app"
            className={`${navLinkIdle} shrink-0 gap-2 font-semibold`}
            aria-label="ERP INFO MAILER 홈"
          >
            <Image
              src="/samkwang-logo.png"
              alt=""
              width={120}
              height={36}
              className="h-7 w-auto max-h-7 shrink-0 object-contain"
              priority
            />
            <span className="whitespace-nowrap text-sm font-semibold tracking-wide text-app-text sm:text-base">
              ERP INFO MAILER
            </span>
          </Link>
          <nav
            className="flex min-w-0 flex-wrap items-center gap-1"
            aria-label="주 메뉴"
          >
            {visibleDomains.map((d) => {
              const active =
                pathname === d.basePath || pathname.startsWith(`${d.basePath}/`);
              return (
                <Link
                  key={d.id}
                  href={d.basePath}
                  className={active ? navLinkActive : navLinkIdle}
                  aria-current={active ? 'page' : undefined}
                >
                  {d.icon ? (
                    <Icon
                      icon={d.icon}
                      className={`h-[18px] w-[18px] shrink-0 ${active ? 'opacity-100' : 'opacity-80'}`}
                      aria-hidden
                    />
                  ) : null}
                  {d.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="max-w-[min(16rem,36vw)] text-[14px] font-medium text-app-text"
            onClick={() => setProfileOpen(true)}
            aria-haspopup="dialog"
            aria-label={`${formatUserDisplayName(user)} 사용자 정보`}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <UserAvatarIcon />
              <span className="truncate">{formatUserDisplayName(user)}</span>
            </span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0 text-[14px]"
            onClick={() => void logout()}
          >
            <span className="inline-flex items-center gap-1.5">
              <Icon icon="mdi:logout" className="h-4 w-4 shrink-0" aria-hidden />
              로그아웃
            </span>
          </Button>
        </div>
      </header>

      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} user={user} />
    </>
  );
}
