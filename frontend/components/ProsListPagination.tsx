'use client';

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const;

export type PageSizeOption = (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number];

export function getTotalPages(totalItems: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalItems / pageSize) || 1);
}

export function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(1, page), totalPages);
}

export function buildVisiblePages(current: number, totalPages: number, maxVisible = 10): number[] {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  let start = Math.max(1, current - Math.floor(maxVisible / 2));
  let end = start + maxVisible - 1;
  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - maxVisible + 1);
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function slicePage<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function rowSequenceNo(page: number, pageSize: number, indexInPage: number): number {
  return (page - 1) * pageSize + indexInPage + 1;
}

type ProsListPaginationProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: readonly number[];
};

export function ProsListPageSizeSelect({
  pageSize,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: Pick<ProsListPaginationProps, 'pageSize' | 'onPageSizeChange' | 'pageSizeOptions'>) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-app-muted">목록 수</span>
      <select
        className="pros-page-size-select sk-form-input"
        value={pageSize}
        aria-label="페이지당 목록 수"
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
      >
        {pageSizeOptions.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ProsListPaginationBar({
  page,
  pageSize,
  totalItems,
  onPageChange,
}: Pick<ProsListPaginationProps, 'page' | 'pageSize' | 'totalItems' | 'onPageChange'>) {
  const totalPages = getTotalPages(totalItems, pageSize);
  const current = clampPage(page, totalPages);
  const pages = buildVisiblePages(current, totalPages);

  if (totalItems === 0) {
    return null;
  }

  return (
    <nav className="pros-pagination" aria-label="페이지 이동">
      <button
        type="button"
        className="pros-pagination-btn"
        disabled={current <= 1}
        aria-label="이전 페이지"
        onClick={() => onPageChange(current - 1)}
      >
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={`pros-pagination-btn${p === current ? ' pros-pagination-btn-active' : ''}`}
          aria-current={p === current ? 'page' : undefined}
          onClick={() => onPageChange(p)}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        className="pros-pagination-btn"
        disabled={current >= totalPages}
        aria-label="다음 페이지"
        onClick={() => onPageChange(current + 1)}
      >
        ›
      </button>
    </nav>
  );
}
