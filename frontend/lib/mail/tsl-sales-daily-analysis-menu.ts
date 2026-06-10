/** 일자별판매실적분석 — `GET /api/erp/tsl-sales-daily-analysis` (백엔드 `mail-tsl-sales-daily-analysis-menu-match` 와 동기) */

export type MailMenuLike = { label: string; code: string };

export function isTslSalesDailyAnalysisMailMenu(menu: MailMenuLike): boolean {
  const labelNorm = (menu.label ?? '').trim().replace(/\s+/g, '');
  const code = (menu.code ?? '').trim().toLowerCase();
  if (labelNorm.includes('일자별판매실적') || labelNorm.includes('판매실적분석')) {
    return true;
  }
  if (
    code === 'tsl_sales_daily_analysis' ||
    code === 'menu_code_tsl_sales_daily' ||
    code === 'menu_code_012'
  ) {
    return true;
  }
  return false;
}
