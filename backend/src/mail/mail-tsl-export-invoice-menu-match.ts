/** 메일발송 메뉴가 ERP 수출 Invoice 품목 조회와 연결되는지 (프론트 `tsl-export-invoice-items-menu.ts`와 동일) */
export function isTslExportInvoiceItemsMailMenu(menu: { code: string; label: string }): boolean {
  const labelNorm = menu.label.trim().replace(/\s+/g, '').toLowerCase();
  const code = menu.code.trim().toLowerCase();
  if (labelNorm.includes('반품')) {
    return false;
  }
  if (labelNorm.includes('외주납품') && labelNorm.includes('품목조회')) {
    return false;
  }
  if (labelNorm.includes('구매납품') && labelNorm.includes('품목조회')) {
    return false;
  }
  if (labelNorm.includes('외주입고') && labelNorm.includes('품목조회')) {
    return false;
  }
  if (
    labelNorm.includes('수입') &&
    (labelNorm.includes('invoice') || labelNorm.includes('인보이스'))
  ) {
    return false;
  }
  if (labelNorm === '수출invoice품목조회') {
    return true;
  }
  if (
    labelNorm.includes('수출') &&
    labelNorm.includes('품목조회') &&
    (labelNorm.includes('invoice') || labelNorm.includes('인보이스'))
  ) {
    return true;
  }
  if (code === 'tsl_export_invoice_items' || code === 'menu_code_007') {
    return true;
  }
  return false;
}
