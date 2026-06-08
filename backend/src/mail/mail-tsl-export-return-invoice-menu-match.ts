/** 메일발송 메뉴가 ERP 수출 반품 품목 조회와 연결되는지 (프론트 `tsl-export-return-invoice-items-menu.ts`와 동일) */
export function isTslExportReturnInvoiceItemsMailMenu(menu: { code: string; label: string }): boolean {
  const labelNorm = menu.label.trim().replace(/\s+/g, '').toLowerCase();
  const code = menu.code.trim().toLowerCase();
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
