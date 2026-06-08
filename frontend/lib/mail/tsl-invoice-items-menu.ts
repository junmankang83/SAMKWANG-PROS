import { isTslExportInvoiceItemsMailMenu } from './tsl-export-invoice-items-menu';

/** 메일발송메뉴현황에서 ERP 거래명세 품목 조회 UI를 쓸 메뉴 식별 */
export function isTslInvoiceItemsMailMenu(row: { code: string; label: string }): boolean {
  /** 코드가 내수용으로 잘못돼 있어도 라벨이 수출 Invoice면 수출 전용 API로 가야 함 */
  if (isTslExportInvoiceItemsMailMenu(row)) {
    return false;
  }
  const labelNorm = row.label.trim().replace(/\s+/g, '');
  const code = row.code.trim().toLowerCase();
  if (labelNorm.includes('외주입고') && labelNorm.includes('품목조회')) {
    return false;
  }
  if (labelNorm === '거래명세서품목조회') {
    return true;
  }
  if (code === 'menu_001' || code === 'menu_code_001' || code === 'tsl_invoice_items') {
    return true;
  }
  return false;
}
