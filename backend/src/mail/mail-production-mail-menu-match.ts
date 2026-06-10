/** 메일발송 메뉴 ↔ 부품관리 ERP 화면 — 프론트 `lib/mail/*-menu.ts`와 동일 조건 유지 */

export type MailMenuLike = { label: string; code: string };

function norm(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

export function isWhStockListMailMenu(menu: MailMenuLike): boolean {
  const labelNorm = norm(menu.label ?? '');
  const code = (menu.code ?? '').trim().toLowerCase();
  if (labelNorm.includes('창고별재고조회')) {
    return true;
  }
  if (labelNorm.includes('창고별') && labelNorm.includes('재고조회') && !labelNorm.includes('수불')) {
    return true;
  }
  if (
    code === 'wh_stock_list' ||
    code === 'wh_stock_list_query' ||
    code === 'menu_code_wh_stock_list' ||
    code === 'swlgwhstocklist' ||
    code === 'skkr_swlgwhstocklistquery' ||
    code === 'skkr_swlgwhstocklistquery_main' ||
    code === 'lg_wh_stock_list'
  ) {
    return true;
  }
  return false;
}

export function isWhStockSumMailMenu(menu: MailMenuLike): boolean {
  const labelNorm = norm(menu.label ?? '');
  const code = (menu.code ?? '').trim().toLowerCase();
  if (labelNorm.includes('창고별수불집계조회')) {
    return true;
  }
  if (labelNorm.includes('창고별') && labelNorm.includes('수불') && labelNorm.includes('집계')) {
    return true;
  }
  if (
    code === 'wh_stock_sum' ||
    code === 'wh_stock_sum_list' ||
    code === 'menu_code_wh_stock_sum' ||
    code === 'swlgwhstocksum' ||
    code === 'skkr_swlgwhstocksumlistquery' ||
    code === 'lg_wh_stock_sum'
  ) {
    return true;
  }
  return false;
}

export function isPdsfcWorkReportMailMenu(menu: MailMenuLike): boolean {
  const labelNorm = norm(menu.label ?? '');
  const code = (menu.code ?? '').trim().toLowerCase();
  if (labelNorm.includes('작업실적조회')) {
    return true;
  }
  if (labelNorm.includes('작업실적') && labelNorm.includes('조회')) {
    return true;
  }
  if (code === 'pdsfc_work_report' || code === 'menu_code_pdsfc_work_report' || code === 'tpdsfc_work_report') {
    return true;
  }
  return false;
}

export function isLgInoutMoveItemsMailMenu(menu: MailMenuLike): boolean {
  const label = norm(menu.label ?? '');
  if (label.includes('작업실적')) {
    return false;
  }
  const code = (menu.code ?? '').trim().toLowerCase();
  if (label.includes('이동품목') && label.includes('조회')) {
    return true;
  }
  if (code === 'lg_inout_move_items' || code === 'menu_code_lg_move' || code === 'menu_code_011') {
    return true;
  }
  return false;
}
