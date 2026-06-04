'use client';

import { Alert, AlertDescription, AlertTitle, Card, CardContent, CardHeader, CardTitle } from '@samkwang/ui-kit';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { isTslInvoiceItemsMailMenu } from '@/lib/mail/tsl-invoice-items-menu';
import { isPuDelvInItemsMailMenu } from '@/lib/mail/pu-delv-in-items-menu';
import { TslInvoiceItemInquiry } from '@/components/TslInvoiceItemInquiry';
import { PuDelvInItemInquiry } from '@/components/PuDelvInItemInquiry';

type MenuDetail = {
  id: string;
  code: string;
  label: string;
  menuQuery: string;
  sortOrder: number;
};

async function readApiError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => '');
  try {
    const body = raw ? JSON.parse(raw) : null;
    if (body && typeof body === 'object') {
      const m = (body as { message?: unknown }).message;
      if (typeof m === 'string') {
        return m;
      }
      if (Array.isArray(m)) {
        return m.map(String).join(', ');
      }
    }
  } catch {
    /* ignore */
  }
  return raw.trim().slice(0, 400) || `요청 실패 (${res.status})`;
}

/** 메일발송메뉴현황 — 개별 메뉴(거래명세서품목조회는 ERP 연동 UI, 그 외는 메뉴쿼리 플레이스홀더) */
export function MailSendingMenuView() {
  const params = useParams();
  const menuId = typeof params.menuId === 'string' ? params.menuId : '';
  const [row, setRow] = useState<MenuDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!menuId) {
      setRow(null);
      setLoadError('메뉴 ID가 없습니다.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/mail/menus/${menuId}`, { credentials: 'include', cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setRow(null);
        setLoadError(await readApiError(res));
        return;
      }
      const raw = (await res.json()) as Record<string, unknown>;
      setRow({
        id: String(raw.id ?? ''),
        code: String(raw.code ?? ''),
        label: String(raw.label ?? ''),
        menuQuery: typeof raw.menuQuery === 'string' ? raw.menuQuery : '',
        sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : Number(raw.sortOrder) || 0,
      });
    } catch (e) {
      setRow(null);
      setLoadError(e instanceof Error ? e.message : '불러오기 오류');
    } finally {
      setLoading(false);
    }
  }, [menuId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-app-text">메일발송메뉴현황</h1>
        <p className="text-sm text-app-muted">불러오는 중…</p>
      </div>
    );
  }

  if (loadError || !row) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-app-text">메일발송메뉴현황</h1>
        <Alert variant="error">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{loadError ?? '메뉴를 찾을 수 없습니다.'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-app-text">{row.label}</h1>
        <p className="mt-1 text-sm text-app-muted">
          순번 {row.sortOrder} · 코드 <span className="font-mono text-xs">{row.code}</span>
        </p>
      </div>

      {isTslInvoiceItemsMailMenu(row) ? (
        <TslInvoiceItemInquiry embedded />
      ) : isPuDelvInItemsMailMenu(row) ? (
        <PuDelvInItemInquiry embedded />
      ) : (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">조회 데이터</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-app-muted">
            <p>
              메뉴관리에 등록된 <strong className="text-app-text">메뉴쿼리</strong>를 실행해 얻은 결과를 이 영역에 표
              형태로 넣을 예정입니다.
            </p>
            {row.menuQuery.trim() ? (
              <details className="rounded-md border border-app-border bg-app-surface-02 p-3">
                <summary className="cursor-pointer text-xs font-medium text-app-text">등록된 메뉴쿼리 미리보기</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-app-text">
                  {row.menuQuery}
                </pre>
              </details>
            ) : (
              <p className="text-xs">등록된 메뉴쿼리가 없습니다. 메뉴관리에서 쿼리를 입력하세요.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
