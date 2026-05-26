'use client';

import type { SparePartInventoryRow, SparePartLedgerPeriodResponse } from '@samkwang/shared';
import { Button } from '@samkwang/ui-kit';
import { Icon } from '@iconify/react';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';

function formatQtyDisplay(s: string): string {
  const n = Number(s);
  if (!Number.isFinite(n)) {
    return s;
  }
  if (Number.isInteger(n)) {
    return String(n);
  }
  return s;
}

function formatQtyWithUnit(qty: string, unit: string | null, emptyDash = true): string {
  const n = Number(qty);
  if (!Number.isFinite(n) || n === 0) {
    return emptyDash ? '—' : '';
  }
  const u = unit?.trim() || 'EA';
  return `${formatQtyDisplay(qty)}${u}`;
}

function formatReportPeriodLabel(inboundStart: string, inboundEnd: string): string {
  const end = new Date(`${inboundEnd}T12:00:00`);
  const start = new Date(`${inboundStart}T12:00:00`);
  if (
    inboundStart.slice(0, 7) === inboundEnd.slice(0, 7) &&
    !Number.isNaN(end.getTime())
  ) {
    return `${end.getFullYear()}년 ${end.getMonth() + 1}월`;
  }
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 ~ ${end.getFullYear()}년 ${end.getMonth() + 1}월 ${end.getDate()}일`;
  }
  return `${inboundStart} ~ ${inboundEnd}`;
}

function periodMonthFromDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function formatApprovalCell(name: string | null, at: string | null): string {
  if (!name?.trim()) {
    return '';
  }
  if (!at) {
    return name.trim();
  }
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) {
    return name.trim();
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${name.trim()}\n${y}.${m}.${day}`;
}

export type SparePartsLedgerReportProps = {
  rows: SparePartInventoryRow[];
  inboundStart: string;
  inboundEnd: string;
  onClose: () => void;
};

export function SparePartsLedgerReport({
  rows,
  inboundStart,
  inboundEnd,
  onClose,
}: SparePartsLedgerReportProps) {
  const [period, setPeriod] = useState<SparePartLedgerPeriodResponse | null>(null);

  const periodLabel = useMemo(
    () => formatReportPeriodLabel(inboundStart, inboundEnd),
    [inboundStart, inboundEnd],
  );

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const ma = a.machineName.localeCompare(b.machineName, 'ko');
        if (ma !== 0) {
          return ma;
        }
        return a.productName.localeCompare(b.productName, 'ko');
      }),
    [rows],
  );

  const loadPeriod = useCallback(async () => {
    const month = periodMonthFromDate(inboundEnd);
    const res = await fetch(`/api/spare-parts/ledger-period?month=${encodeURIComponent(month)}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      return;
    }
    setPeriod((await res.json()) as SparePartLedgerPeriodResponse);
  }, [inboundEnd]);

  useEffect(() => {
    void loadPeriod();
  }, [loadPeriod]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="pros-ledger-report-overlay fixed inset-0 z-50 flex flex-col bg-white">
      <div className="pros-ledger-report-toolbar print:hidden flex shrink-0 items-center justify-between gap-3 border-b border-app-border bg-app-surface px-4 py-3">
        <p className="text-sm text-app-muted">사출기 예비 부품 입출고 관리대장 미리보기</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon="mdi:close" className="h-4 w-4 shrink-0" aria-hidden />
              닫기
            </span>
          </Button>
          <Button type="button" onClick={handlePrint}>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon="mdi:printer-outline" className="h-4 w-4 shrink-0" aria-hidden />
              출력
            </span>
          </Button>
        </div>
      </div>

      <div className="pros-ledger-report-scroll min-h-0 flex-1 overflow-auto p-6 print:p-0">
        <article className="pros-ledger-report mx-auto max-w-[1100px] bg-white print:max-w-none">
          <header className="pros-ledger-report-header mb-4 grid grid-cols-[140px_1fr_300px] items-start gap-3 print:mb-3">
            <div className="flex flex-col gap-2">
              <Image
                src="/samkwang-logo.png"
                alt="SAMKWANG"
                width={130}
                height={48}
                className="h-auto w-[130px] object-contain"
                priority
              />
              <p className="text-sm font-medium text-app-text">{periodLabel}</p>
            </div>
            <div className="flex w-full min-w-0 items-start">
              <h1 className="pros-ledger-report-title flex w-full items-center justify-center border-2 border-black px-4 text-center text-lg font-bold leading-snug text-black">
                사출기 예비 부품 입출고 관리대장
              </h1>
            </div>
            <table className="pros-ledger-report-approval pros-ledger-report-approval-block w-full min-w-[300px] table-fixed border-collapse text-xs">
              <colgroup>
                <col style={{ width: '25%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '25%' }} />
              </colgroup>
              <thead>
                <tr>
                  {['작성', '검토', '확인', '팀장'].map((label) => (
                    <th
                      key={label}
                      className="pros-ledger-report-approval-label border border-black bg-[#d9d9d9] px-2 py-1 text-center font-semibold"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="pros-ledger-report-approval-cell whitespace-pre-line border border-black px-2 py-1 text-center align-middle text-[11px]">
                    {formatApprovalCell(period?.preparedBy ?? null, period?.preparedAt ?? null)}
                  </td>
                  <td className="pros-ledger-report-approval-cell whitespace-pre-line border border-black px-2 py-1 text-center align-middle text-[11px]">
                    {formatApprovalCell(period?.reviewedBy ?? null, period?.reviewedAt ?? null)}
                  </td>
                  <td className="pros-ledger-report-approval-cell whitespace-pre-line border border-black px-2 py-1 text-center align-middle text-[11px]">
                    {formatApprovalCell(period?.confirmedBy ?? null, period?.confirmedAt ?? null)}
                  </td>
                  <td className="pros-ledger-report-approval-cell whitespace-pre-line border border-black px-2 py-1 text-center align-middle text-[11px]">
                    {formatApprovalCell(period?.teamLeadBy ?? null, period?.teamLeadAt ?? null)}
                  </td>
                </tr>
              </tbody>
            </table>
          </header>

          <table className="pros-ledger-report-table w-full border-collapse text-xs text-black">
            <colgroup>
              <col style={{ width: '12%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '10%' }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                {[
                  '사출기',
                  '제품명',
                  '규격',
                  '입고일자',
                  '입고수량',
                  '출고일자',
                  '출고수량',
                  '현재재고',
                  '적정재고',
                  '비고',
                ].map((col) => (
                  <th
                    key={col}
                    className="border border-black bg-[#d9d9d9] px-1 py-2 text-center font-semibold"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="border border-black py-8 text-center text-app-muted">
                    표시할 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr key={row.id}>
                    <td className="border border-black px-1 py-2 text-center align-middle">
                      {row.machineName}
                    </td>
                    <td className="border border-black px-1 py-2 text-center align-middle">
                      {row.productName}
                    </td>
                    <td className="border border-black px-1 py-2 text-center align-middle">
                      {row.spec ?? '—'}
                    </td>
                    <td className="border border-black px-1 py-2 text-center align-middle font-mono">
                      {row.lastInboundDateInMonth ?? '—'}
                    </td>
                    <td className="border border-black px-1 py-2 text-center align-middle tabular-nums">
                      {formatQtyWithUnit(row.inboundQtyInMonth, row.unit)}
                    </td>
                    <td className="border border-black px-1 py-2 text-center align-middle font-mono">
                      {row.lastOutboundDateInMonth ?? '—'}
                    </td>
                    <td className="border border-black px-1 py-2 text-center align-middle tabular-nums">
                      {formatQtyWithUnit(row.outboundQtyInMonth, row.unit)}
                    </td>
                    <td className="border border-black px-1 py-2 text-center align-middle tabular-nums">
                      {formatQtyWithUnit(row.currentQty, row.unit, false)}
                    </td>
                    <td className="border border-black px-1 py-2 text-center align-middle tabular-nums">
                      {formatQtyWithUnit(row.optimalQty, row.unit, false)}
                    </td>
                    <td className="border border-black px-1 py-2 text-center align-middle">
                      {row.remarks ?? ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </article>
      </div>
    </div>
  );
}
