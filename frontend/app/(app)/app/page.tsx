'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@samkwang/ui-kit';
import Link from 'next/link';
import { useMemo } from 'react';
import { SoftLoginStyleBackdrop } from '@/components/SoftLoginStyleBackdrop';
import { useNavVisibility } from '@/components/NavVisibilityContext';
import { APP_DOMAINS } from '@/lib/navigation/app-menu';

export default function AppHomePage() {
  const { visibility } = useNavVisibility();

  const visibleDomains = useMemo(
    () => APP_DOMAINS.filter((d) => visibility[d.id] === true),
    [visibility],
  );

  return (
    <SoftLoginStyleBackdrop className="-m-6 min-h-[calc(100dvh-3.5rem)] p-6 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-semibold text-slate-900">시작 화면</h1>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {visibleDomains.map((d) => {
            const first = d.items.find((i) => !i.disabled);
            const href = first?.href ?? d.basePath;
            return (
              <li key={d.id}>
                <Link href={href} className="block no-underline">
                  <Card className="h-full border-slate-200/90 bg-white/95 shadow-md shadow-slate-900/5 ring-1 ring-slate-200/60 backdrop-blur-sm transition-shadow hover:shadow-lg hover:ring-sky-200/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-slate-900">{d.label}</CardTitle>
                      <CardDescription className="text-slate-600">
                        {d.items.map((i) => i.label).join(' · ')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 text-xs text-slate-500">바로가기 →</CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </SoftLoginStyleBackdrop>
  );
}
