'use client';

import { APP_DOMAINS, domainFromPathname } from '@/lib/navigation/app-menu';
import { useNavVisibility } from '@/components/NavVisibilityContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/** 현재 경로가 숨겨진 상단 도메인이면, 표시 중인 첫 도메인으로 이동 */
export function NavDomainGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { visibility } = useNavVisibility();
  const lastRedirect = useRef<string | null>(null);

  useEffect(() => {
    const domain = domainFromPathname(pathname);
    if (!domain) return;
    if (visibility[domain.id] === true) {
      lastRedirect.current = null;
      return;
    }
    const first = APP_DOMAINS.find((d) => visibility[d.id] === true);
    if (!first) return;
    const target = first.basePath;
    if (lastRedirect.current === target) return;
    lastRedirect.current = target;
    router.replace(target);
  }, [pathname, router, visibility]);

  return null;
}
