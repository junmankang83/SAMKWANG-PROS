/** 메일발송메뉴현황에서 ERP 수출 Invoice 품목 조회 UI를 쓸 메뉴 식별 */
export function isTslExportInvoiceItemsMailMenu(row: { code: string; label: string }): boolean {
  const labelNorm = row.label.trim().replace(/\s+/g, '').toLowerCase();
  const code = row.code.trim().toLowerCase();
  /** 수출반품품목조회 등은 `tsl-export-return-invoice-items-menu` 전용 */
  if (labelNorm.includes('반품')) {
    return false;
  }
  /** `menu_code_007` 등으로 잘못 붙은 경우에도 외주·구매 납품 라벨은 수출 Invoice로 가지 않음 */
  if (labelNorm.includes('외주납품') && labelNorm.includes('품목조회')) {
    return false;
  }
  if (labelNorm.includes('구매납품') && labelNorm.includes('품목조회')) {
    return false;
  }
  /** `menu_code_007`만 붙어 있어도 외주입고·수입 Invoice 라벨은 수출 전용 API로 가지 않음 */
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
