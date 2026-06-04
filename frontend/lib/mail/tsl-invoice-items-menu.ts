/** 메일발송메뉴현황에서 ERP 거래명세 품목 조회 UI를 쓸 메뉴 식별 */
export function isTslInvoiceItemsMailMenu(row: { code: string; label: string }): boolean {
  const labelNorm = row.label.trim().replace(/\s+/g, '');
  const code = row.code.trim().toLowerCase();
  if (labelNorm === '거래명세서품목조회') {
    return true;
  }
  if (code === 'menu_001' || code === 'menu_code_001' || code === 'tsl_invoice_items') {
    return true;
  }
  return false;
}
