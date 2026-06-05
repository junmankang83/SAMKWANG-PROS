/** 메일발송메뉴현황에서 ERP 수출 Invoice 품목 조회 UI를 쓸 메뉴 식별 */
export function isTslExportInvoiceItemsMailMenu(row: { code: string; label: string }): boolean {
  const labelNorm = row.label.trim().replace(/\s+/g, '').toLowerCase();
  const code = row.code.trim().toLowerCase();
  if (labelNorm === '수출invoice품목조회') {
    return true;
  }
  if (code === 'tsl_export_invoice_items' || code === 'menu_code_007') {
    return true;
  }
  return false;
}
