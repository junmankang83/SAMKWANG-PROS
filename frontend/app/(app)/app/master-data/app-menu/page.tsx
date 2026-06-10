'use client';

import { Alert, AlertDescription, AlertTitle, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@samkwang/ui-kit';
import { Icon } from '@iconify/react';
import { useNavVisibility } from '@/components/NavVisibilityContext';
import { APP_DOMAINS } from '@/lib/navigation/app-menu';
import { mergeNavVisibility, type NavDomainVisibilityMap } from '@/lib/nav-visibility-shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function MasterDataAppMenuPage() {
  const { visibility, replaceVisibility } = useNavVisibility();
  const router = useRouter();
  const [local, setLocal] = useState<NavDomainVisibilityMap>(() => mergeNavVisibility(visibility));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setLocal(mergeNavVisibility(visibility));
  }, [visibility]);

  const visibleCount = APP_DOMAINS.filter((d) => local[d.id] === true).length;

  async function onSave() {
    setError(null);
    setOk(false);
    if (visibleCount < 1) {
      setError('최소 한 개의 상단 메뉴는 표시해야 합니다.');
      return;
    }
    setSaving(true);
    try {
      const domainsPayload = mergeNavVisibility(local as unknown as Record<string, unknown>);
      const res = await fetch('/api/app/nav-domains-visibility', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ domains: domainsPayload }),
      });
      const body = (await res.json().catch(() => null)) as { domains?: Record<string, boolean>; message?: string | string[] } | null;
      if (!res.ok) {
        const raw = body?.message;
        const msg =
          typeof raw === 'string'
            ? raw
            : Array.isArray(raw)
              ? raw.join(', ')
              : '저장에 실패했습니다.';
        setError(msg);
        return;
      }
      if (body?.domains && typeof body.domains === 'object') {
        replaceVisibility(mergeNavVisibility(body.domains as Record<string, unknown>));
      }
      setOk(true);
      router.refresh();
    } catch {
      setError('네트워크 오류로 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-app-text">메뉴관리</h1>
        <p className="mt-1 text-sm text-app-muted">
          상단 주메뉴(기준정보·부품관리·설비관리·메일발송관리) 표시 여부를 설정합니다. 설정은{' '}
          <strong className="text-app-text">전 사용자에게 공통</strong>으로 적용됩니다.
        </p>
      </div>

      {error ? (
        <Alert variant="error">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {ok ? (
        <Alert>
          <AlertTitle>저장됨</AlertTitle>
          <AlertDescription>설정이 반영되었습니다.</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-app-border shadow-card">
        <CardHeader>
          <CardTitle className="text-base">상단 메뉴 표시</CardTitle>
          <CardDescription>체크된 항목만 상단 탭에 표시됩니다. 최소 1개는 켜 두어야 합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {APP_DOMAINS.map((d) => {
            const checked = local[d.id] === true;
            return (
              <label
                key={d.id}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-app-border bg-app-surface-02 px-3 py-2.5 transition hover:bg-app-hover"
              >
                <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-app-text">
                  {d.icon ? <Icon icon={d.icon} className="h-5 w-5 shrink-0 text-app-muted" aria-hidden /> : null}
                  <span className="truncate">{d.label}</span>
                </span>
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-brand"
                  checked={checked}
                  onChange={(e) => {
                    const on = e.target.checked;
                    if (!on && visibleCount <= 1) return;
                    setLocal((prev) => mergeNavVisibility({ ...prev, [d.id]: on }));
                  }}
                  aria-label={`${d.label} 메뉴 표시`}
                />
              </label>
            );
          })}
          <Button type="button" variant="primary" className="mt-2 w-full sm:w-auto" loading={saving} onClick={() => void onSave()}>
            저장
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
