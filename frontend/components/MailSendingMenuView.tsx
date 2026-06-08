'use client';

import { Alert, AlertDescription, AlertTitle, Card, CardContent } from '@samkwang/ui-kit';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { isTslInvoiceItemsMailMenu } from '@/lib/mail/tsl-invoice-items-menu';
import { isTslExportInvoiceItemsMailMenu } from '@/lib/mail/tsl-export-invoice-items-menu';
import { isTslExportReturnInvoiceItemsMailMenu } from '@/lib/mail/tsl-export-return-invoice-items-menu';
import { isTslDvReqItemsMailMenu } from '@/lib/mail/tsl-dv-req-items-menu';
import { isPuDelvInItemsMailMenu } from '@/lib/mail/pu-delv-in-items-menu';
import { isOspDelvInItemsMailMenu } from '@/lib/mail/osp-delv-in-items-menu';
import { isPuDelvItemsMailMenu } from '@/lib/mail/pu-delv-items-menu';
import { isOspDelvItemsMailMenu } from '@/lib/mail/osp-delv-items-menu';
import { isLgInoutMoveItemsMailMenu } from '@/lib/mail/lg-inout-move-items-menu';
import { TslInvoiceItemInquiry } from '@/components/TslInvoiceItemInquiry';
import { TslExportInvoiceItemInquiry } from '@/components/TslExportInvoiceItemInquiry';
import { TslExportReturnInvoiceItemInquiry } from '@/components/TslExportReturnInvoiceItemInquiry';
import { TslDvReqItemInquiry } from '@/components/TslDvReqItemInquiry';
import { PuDelvInItemInquiry } from '@/components/PuDelvInItemInquiry';
import { OspDelvInItemInquiry } from '@/components/OspDelvInItemInquiry';
import { PuDelvItemInquiry } from '@/components/PuDelvItemInquiry';
import { OspDelvItemInquiry } from '@/components/OspDelvItemInquiry';
import { LgInoutMoveItemInquiry } from '@/components/LgInoutMoveItemInquiry';

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

/** 메일발송메뉴현황 — 개별 메뉴(ERP 연동 메뉴는 전용 그리드, 그 외는 메뉴쿼리 플레이스홀더) */
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
      </div>

      {isLgInoutMoveItemsMailMenu(row) ? (
        <LgInoutMoveItemInquiry embedded />
      ) : isOspDelvInItemsMailMenu(row) ? (
        <OspDelvInItemInquiry embedded />
      ) : isTslExportReturnInvoiceItemsMailMenu(row) ? (
        <TslExportReturnInvoiceItemInquiry embedded />
      ) : isTslDvReqItemsMailMenu(row) ? (
        <TslDvReqItemInquiry embedded />
      ) : isOspDelvItemsMailMenu(row) ? (
        <OspDelvItemInquiry embedded />
      ) : isTslExportInvoiceItemsMailMenu(row) ? (
        <TslExportInvoiceItemInquiry embedded />
      ) : isTslInvoiceItemsMailMenu(row) ? (
        <TslInvoiceItemInquiry embedded />
      ) : isPuDelvItemsMailMenu(row) ? (
        <PuDelvItemInquiry embedded />
      ) : isPuDelvInItemsMailMenu(row) ? (
        <PuDelvInItemInquiry embedded />
      ) : (
        <Card className="shadow-card">
          <CardContent className="p-4">
            {row.menuQuery.trim() ? (
              <details className="rounded-md border border-app-border bg-app-surface-02 p-3">
                <summary className="cursor-pointer text-xs font-medium text-app-text">등록된 메뉴쿼리</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-app-text">
                  {row.menuQuery}
                </pre>
              </details>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
