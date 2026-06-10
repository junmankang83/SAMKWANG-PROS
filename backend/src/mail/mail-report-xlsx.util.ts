import ExcelJS from 'exceljs';

const SHEET_NAME_INVALID = /[:\\/?*[\]]/g;

/** Excel 시트명 제한(31자·금지 문자) */
export function safeExcelSheetName(name: string): string {
  let s = (name ?? '').replace(SHEET_NAME_INVALID, '_').trim() || 'Data';
  if (s.length > 31) {
    s = s.slice(0, 31);
  }
  return s;
}

/**
 * 메일 제목과 동일한 첨부 파일명(.xlsx).
 * Windows 금지 문자 제거, 길이 제한.
 */
export function subjectToXlsxFilename(subject: string): string {
  let base = (subject ?? '')
    .trim()
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')
    .trim();
  if (!base) {
    base = 'mail-data';
  }
  if (base.length > 180) {
    base = base.slice(0, 180);
  }
  return /\.xlsx$/i.test(base) ? base : `${base}.xlsx`;
}

export type MailReportGridXlsxInput = {
  sheetName: string;
  headers: string[];
  /** 각 행은 헤더와 동일 개수의 문자열 셀 */
  rows: string[][];
};

export async function buildGridXlsxBuffer(input: MailReportGridXlsxInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(safeExcelSheetName(input.sheetName));
  const headerRow = ws.addRow(input.headers);
  headerRow.font = { bold: true };
  for (const r of input.rows) {
    ws.addRow(r);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
}

/** ERP 비대상 메뉴·조회 실패 시 본문 전체를 한 셀에 넣은 단일 시트 */
export async function buildPlainTextSheetXlsx(sheetName: string, body: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(safeExcelSheetName(sheetName));
  ws.getColumn(1).width = 100;
  const text = (body ?? '').slice(0, 32000);
  const c = ws.getCell('A1');
  c.value = text || ' ';
  c.alignment = { wrapText: true, vertical: 'top' };
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
}
