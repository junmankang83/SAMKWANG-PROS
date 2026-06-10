'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { mergeNavVisibility, type NavDomainVisibilityMap } from '@/lib/nav-visibility-shared';

type NavVisibilityContextValue = {
  visibility: NavDomainVisibilityMap;
  /** 서버 레이아웃 갱신 후 전달되는 초기값과 동기화 */
  replaceVisibility: (next: NavDomainVisibilityMap) => void;
};

const NavVisibilityContext = createContext<NavVisibilityContextValue | null>(null);

export function NavVisibilityProvider({
  initial,
  children,
}: {
  initial: NavDomainVisibilityMap;
  children: React.ReactNode;
}) {
  const [visibility, setVisibility] = useState<NavDomainVisibilityMap>(() => mergeNavVisibility(initial));
  const initialKey = JSON.stringify(mergeNavVisibility(initial));

  useEffect(() => {
    setVisibility(mergeNavVisibility(JSON.parse(initialKey) as Record<string, unknown>));
  }, [initialKey]);

  const replaceVisibility = useCallback((next: NavDomainVisibilityMap) => {
    setVisibility(mergeNavVisibility(next as unknown as Record<string, unknown>));
  }, []);

  const value = useMemo(
    () => ({
      visibility,
      replaceVisibility,
    }),
    [visibility, replaceVisibility],
  );

  return <NavVisibilityContext.Provider value={value}>{children}</NavVisibilityContext.Provider>;
}

export function useNavVisibility(): NavVisibilityContextValue {
  const ctx = useContext(NavVisibilityContext);
  if (!ctx) {
    throw new Error('useNavVisibility는 NavVisibilityProvider 안에서만 사용하세요.');
  }
  return ctx;
}
