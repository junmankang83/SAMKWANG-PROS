/** 메일발송 메뉴가 ERP 일자별판매실적분석(`GET /api/erp/tsl-sales-daily-analysis`)과 연결되는지 */

export function isTslSalesDailyAnalysisMailMenu(menu: { code: string; label: string }): boolean {
  const labelNorm = menu.label.trim().replace(/\s+/g, '');
  const code = menu.code.trim().toLowerCase();
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
