/** 외주입고/반품 품목조회(_TPDOSPDelvIn) — 구매입고(pu-delv-in)과 분리 */
function looksLikeSalesDailyMenuLabel(labelNorm: string): boolean {
  return (
    labelNorm.includes('일자별판매') ||
    labelNorm.includes('판매실적분석') ||
    labelNorm.includes('판매실적') ||
    labelNorm.includes('매출실적')
  );
}

export function isOspDelvInItemsMailMenu(row: { code: string; label: string }): boolean {
  const labelNorm = row.label.trim().replace(/\s+/g, '');
  const code = row.code.trim().toLowerCase();
  if (labelNorm === '구매입고/반품품목조회') {
    return false;
  }
  if (labelNorm.includes('외주입고') && labelNorm.includes('품목조회')) {
    return true;
  }
  if (
    code === 'osp_delv_in_items' ||
    code === 'menu_code_osp_delv_in' ||
    code === 'menu_code_010'
  ) {
    if (looksLikeSalesDailyMenuLabel(labelNorm)) {
      return false;
    }
    return true;
  }
  return false;
}
