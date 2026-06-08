import { isTslExportInvoiceItemsMailMenu } from './mail-tsl-export-invoice-menu-match';

/** 메일발송 메뉴가 ERP 거래명세 품목 조회와 연결되는지 (프론트 `tsl-invoice-items-menu.ts`와 동일 조건 + menu_code_001) */
export function isTslInvoiceItemsMailMenu(menu: { code: string; label: string }): boolean {
  if (isTslExportInvoiceItemsMailMenu(menu)) {
    return false;
  }
  const labelNorm = menu.label.trim().replace(/\s+/g, '');
  const code = menu.code.trim().toLowerCase();
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
