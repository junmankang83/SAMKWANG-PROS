/** 메일발송메뉴현황에서 ERP 수출 반품 품목 조회 UI 연결 (백엔드 `mail-tsl-export-return-invoice-menu-match.ts`와 동일) */
export function isTslExportReturnInvoiceItemsMailMenu(row: { code: string; label: string }): boolean {
  const labelNorm = row.label.trim().replace(/\s+/g, '').toLowerCase();
  const code = row.code.trim().toLowerCase();
  /** `menu_code_008`만 붙어 있어도 외주입고/반품 품목조회는 수출 반품 Invoice로 가면 안 됨 */
  if (labelNorm.includes('외주입고')) {
    return false;
  }
  if (labelNorm === '수출반품품목조회') {
    return true;
  }
  if (code === 'tsl_export_return_invoice_items' || code === 'menu_code_008') {
    return true;
  }
  return false;
}
