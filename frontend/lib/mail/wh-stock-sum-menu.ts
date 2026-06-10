/** 창고별수불집계조회 — `GET /api/erp/wh-stock-sum`(기본: 일별수불 테이블 직접 집계). 메일 메뉴 매칭 추가 시 동기 유지. */

export type MailMenuLike = { label: string; code: string };

function norm(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
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
