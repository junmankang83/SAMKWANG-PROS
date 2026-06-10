/** 창고별 재고조회 — `GET /api/erp/wh-stock-list`. 메일발송메뉴현황 매칭. `wh-stock-sum-menu.ts`와 구분 유지. */

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
