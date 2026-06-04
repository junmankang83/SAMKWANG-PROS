import { Injectable, Logger } from '@nestjs/common';
import { ErpPuDelvInItemsService, type PuDelvInItemRow } from '../external/erp/erp-pu-delv-in-items.service';
import { ErpTslInvoiceItemsService, type TslInvoiceItemRow } from '../external/erp/erp-tsl-invoice-items.service';
import { escapeHtml } from './mail-html-body';
import { isPuDelvInItemsMailMenu } from './mail-pu-delv-in-menu-match';
import { isTslInvoiceItemsMailMenu } from './mail-tsl-menu-match';

export type MailMenuReportAppendResult = {
  /** text/plain 본문(기존과 동일: 탭 구분 표 포함) */
  text: string;
  /** HTML 파트: 표 앞 순수 텍스트(이스케이프 후 `<br/>`) */
  mailHtmlStructuredIntro?: string;
  /** HTML 파트: `<table>` 조각(서버 생성·이스케이프 완료) */
  mailHtmlTableFragment?: string;
};

function seoulYmd(sendAt: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(sendAt);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

/** ERP 메일 본문·HTML 표 앞 한 줄(대시·시작일/종료일·Asia/Seoul 문구 없음) */
function erpReportHeadingLine(menuLabel: string): string {
  return `■ [${menuLabel}] 일자별 현황`;
}

function cell(v: string | number | null): string {
  if (v == null) {
    return '';
  }
  return String(v).replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
}

const koNumber = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 });

function formatNumberKo(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) {
    return '';
  }
  return koNumber.format(n);
}

/** 메일 본문·HTML 표: 천 단위 쉼표 (그리드와 동일) */
const TSL_NUMERIC_KEYS = new Set<keyof TslInvoiceItemRow>([
  'rowNo',
  'bizUnit',
  'outboundWhCode',
  'qty',
  'unitPrice',
  'supplyAmount',
  'vatAmount',
  'totalAmount',
  'foreignUnitPrice',
  'foreignAmount',
  'exchangeRate',
  'inboundWhCode',
]);

const PU_NUMERIC_KEYS = new Set<keyof PuDelvInItemRow>([
  'bizUnit',
  'lineSerl',
  'whCode',
  'qty',
  'unitPrice',
  'foreignUnitPrice',
  'supplyAmount',
  'vatAmount',
  'totalAmount',
  'foreignAmount',
  'purOrderSerl',
  'inspectionSerl',
]);

function tslMailCell(row: TslInvoiceItemRow, key: keyof TslInvoiceItemRow): string {
  const v = row[key];
  if (TSL_NUMERIC_KEYS.has(key)) {
    return formatNumberKo(v as number | null | undefined);
  }
  return cell(v as string | number | null);
}

function puMailCell(row: PuDelvInItemRow, key: keyof PuDelvInItemRow): string {
  const v = row[key];
  if (PU_NUMERIC_KEYS.has(key)) {
    return formatNumberKo(v as number | null | undefined);
  }
  return cell(v as string | number | null);
}

const TSL_COLUMNS: { key: keyof TslInvoiceItemRow; header: string }[] = [
  { key: 'rowNo', header: '번호' },
  { key: 'bizUnit', header: '사업단위' },
  { key: 'invoiceNo', header: '거래명세번호' },
  { key: 'invoiceDate', header: '일자' },
  { key: 'customerCode', header: '거래처코드' },
  { key: 'customerName', header: '거래처명' },
  { key: 'outboundWhCode', header: '출고창고코드' },
  { key: 'outboundWhName', header: '출고창고명' },
  { key: 'chargePersonName', header: '담당자' },
  { key: 'chargeDeptName', header: '담당부서' },
  { key: 'itemNo', header: '품번' },
  { key: 'itemName', header: '품명' },
  { key: 'spec', header: '규격' },
  { key: 'unit', header: '단위' },
  { key: 'managementUnit', header: '관리단위' },
  { key: 'qty', header: '수량' },
  { key: 'unitPrice', header: '단가' },
  { key: 'supplyAmount', header: '공급가액' },
  { key: 'vatAmount', header: '부가세' },
  { key: 'totalAmount', header: '합계' },
  { key: 'foreignUnitPrice', header: '외화단가' },
  { key: 'foreignAmount', header: '외화금액' },
  { key: 'exchangeRate', header: '환율' },
  { key: 'currencyName', header: '통화' },
  { key: 'remark', header: '비고' },
  { key: 'projectCode', header: '프로젝트코드' },
  { key: 'projectName', header: '프로젝트명' },
  { key: 'inspectionKind', header: '검사구분' },
  { key: 'inboundWhCode', header: '입고창고코드' },
  { key: 'inboundWhName', header: '입고창고명' },
  { key: 'lotNo', header: 'LOT' },
  { key: 'productionDate', header: '생산일' },
  { key: 'expiryDate', header: '유효기한' },
];

/** 구매입고/반품 품목(엑셀 29열과 동일 순서) */
const PU_COLUMNS: { key: keyof PuDelvInItemRow; header: string }[] = [
  { key: 'bizUnit', header: '사업장' },
  { key: 'receiptDate', header: '입고일' },
  { key: 'receiptNo', header: '입고번호' },
  { key: 'lineSerl', header: '순번' },
  { key: 'customerCode', header: '거래처' },
  { key: 'customerName', header: '거래처명' },
  { key: 'receiptKind', header: '입고구분' },
  { key: 'whCode', header: '창고' },
  { key: 'whName', header: '창고명' },
  { key: 'itemCode', header: '품목코드' },
  { key: 'itemName', header: '품목명' },
  { key: 'spec', header: '규격' },
  { key: 'unit', header: '단위' },
  { key: 'managementUnit', header: '관리단위' },
  { key: 'qty', header: '수량' },
  { key: 'unitPrice', header: '단가' },
  { key: 'foreignUnitPrice', header: '외화단가' },
  { key: 'supplyAmount', header: '공급가액' },
  { key: 'vatAmount', header: '부가세' },
  { key: 'totalAmount', header: '합계금액' },
  { key: 'foreignAmount', header: '외화금액' },
  { key: 'projectCode', header: '프로젝트' },
  { key: 'projectName', header: '프로젝트명' },
  { key: 'purOrderNo', header: '발주번호' },
  { key: 'purOrderSerl', header: '발주순번' },
  { key: 'inspectionNo', header: '검사번호' },
  { key: 'inspectionSerl', header: '검사순번' },
  { key: 'remark', header: '비고' },
  { key: 'assetKind', header: '자산구분' },
];

@Injectable()
export class MailMenuReportService {
  private readonly logger = new Logger(MailMenuReportService.name);
  /** 메일 본문 크기 제한을 위해 행 상한 */
  private static readonly ERP_EMAIL_ROW_LIMIT = 2000;

  constructor(
    private readonly tslItems: ErpTslInvoiceItemsService,
    private readonly puDelvItems: ErpPuDelvInItemsService,
  ) {}

  /**
   * ERP 연동 메뉴(거래명세·구매입고 등)는 서울 기준 `sendAt`의 **당일**을 시작·종료일로 조회해 본문 뒤에 붙입니다.
   * 스케줄 발송·수동 발송 모두 동일합니다.
   */
  async appendMenuDataReport(
    body: string,
    menu: { label: string; code: string },
    sendAt: Date = new Date(),
  ): Promise<MailMenuReportAppendResult> {
    const today = seoulYmd(sendAt);
    if (isTslInvoiceItemsMailMenu(menu)) {
      return this.appendTslInvoiceReport(body, menu, today);
    }
    if (isPuDelvInItemsMailMenu(menu)) {
      return this.appendPuDelvInReport(body, menu, today);
    }
    return { text: body ?? '' };
  }

  private appendTslInvoiceReport(
    body: string,
    menu: { label: string; code: string },
    today: string,
  ): Promise<MailMenuReportAppendResult> {
    const menuLabel = menu.label.trim() || '거래명세서 품목';
    const base = (body ?? '').trimEnd();
    const titleLine = erpReportHeadingLine(menuLabel);

    return (async () => {
      try {
        const { items, truncated } = await this.tslItems.listByInvoiceDateRange(
          today,
          today,
          MailMenuReportService.ERP_EMAIL_ROW_LIMIT,
        );
        const plainReport = this.formatTslPlainText(menuLabel, items, truncated);
        const fullText = base ? `${base}\n${plainReport}` : plainReport.replace(/^\n+/, '');
        const intro = base ? `${base}\n\n${titleLine}` : titleLine;
        const mailHtmlTableFragment = this.buildTslHtmlTable(items, truncated);
        return {
          text: fullText,
          mailHtmlStructuredIntro: intro,
          mailHtmlTableFragment,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`메일 본문용 거래명세 품목 조회 실패: ${msg}`);
        const reportBlock = ['', erpReportHeadingLine(menuLabel), `[ERP 조회 실패] ${msg}`].join('\n');
        const fullText = base ? `${base}\n${reportBlock}` : reportBlock.replace(/^\n+/, '');
        return { text: fullText };
      }
    })();
  }

  private appendPuDelvInReport(
    body: string,
    menu: { label: string; code: string },
    today: string,
  ): Promise<MailMenuReportAppendResult> {
    const menuLabel = menu.label.trim() || '구매입고/반품 품목';
    const base = (body ?? '').trimEnd();
    const titleLine = erpReportHeadingLine(menuLabel);

    return (async () => {
      try {
        const { items, truncated } = await this.puDelvItems.listByDelvInDateRange(
          today,
          today,
          MailMenuReportService.ERP_EMAIL_ROW_LIMIT,
        );
        const plainReport = this.formatPuPlainText(menuLabel, items, truncated);
        const fullText = base ? `${base}\n${plainReport}` : plainReport.replace(/^\n+/, '');
        const intro = base ? `${base}\n\n${titleLine}` : titleLine;
        const mailHtmlTableFragment = this.buildPuHtmlTable(items, truncated);
        return {
          text: fullText,
          mailHtmlStructuredIntro: intro,
          mailHtmlTableFragment,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`메일 본문용 구매입고 품목 조회 실패: ${msg}`);
        const reportBlock = ['', erpReportHeadingLine(menuLabel), `[ERP 조회 실패] ${msg}`].join('\n');
        const fullText = base ? `${base}\n${reportBlock}` : reportBlock.replace(/^\n+/, '');
        return { text: fullText };
      }
    })();
  }

  private formatTslPlainText(menuLabel: string, items: TslInvoiceItemRow[], truncated: boolean): string {
    const lines: string[] = ['', erpReportHeadingLine(menuLabel)];
    if (items.length === 0) {
      lines.push('조회 결과가 없습니다.');
    } else {
      lines.push(TSL_COLUMNS.map((c) => c.header).join('\t'));
      for (const row of items) {
        lines.push(TSL_COLUMNS.map((c) => tslMailCell(row, c.key)).join('\t'));
      }
      if (truncated) {
        lines.push(`(행이 많아 상위 ${items.length}건만 표시했습니다.)`);
      }
    }
    return lines.join('\n');
  }

  private formatPuPlainText(menuLabel: string, items: PuDelvInItemRow[], truncated: boolean): string {
    const lines: string[] = ['', erpReportHeadingLine(menuLabel)];
    if (items.length === 0) {
      lines.push('조회 결과가 없습니다.');
    } else {
      lines.push(PU_COLUMNS.map((c) => c.header).join('\t'));
      for (const row of items) {
        lines.push(PU_COLUMNS.map((c) => puMailCell(row, c.key)).join('\t'));
      }
      if (truncated) {
        lines.push(`(행이 많아 상위 ${items.length}건만 표시했습니다.)`);
      }
    }
    return lines.join('\n');
  }

  private buildTslHtmlTable(items: TslInvoiceItemRow[], truncated: boolean): string {
    const tableStyle =
      'border-collapse:collapse;border:2px solid #1b4332;table-layout:auto;font-size:12px;font-family:Malgun Gothic,Apple SD Gothic Neo,sans-serif;width:max-content;max-width:100%;';
    const thStyle =
      'border:1px solid #14532d;background:#2d6a4f;color:#ffffff;padding:8px 10px;text-align:center;font-weight:600;white-space:nowrap;';
    const tdBase =
      'border:1px solid #95d5b2;background:#ffffff;padding:6px 10px;vertical-align:middle;color:#111827;';
    const tdStyleCenter = `${tdBase}text-align:center;`;
    const tdStyleName = `${tdBase}text-align:left;`;
    const tdNumeric = `${tdStyleCenter}font-variant-numeric:tabular-nums;`;

    if (items.length === 0) {
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="${tableStyle}"><tbody><tr><td style="${tdStyleCenter}" colspan="${TSL_COLUMNS.length}">${escapeHtml('조회 결과가 없습니다.')}</td></tr></tbody></table>`;
    }

    const thead = `<thead><tr>${TSL_COLUMNS.map((c) => `<th style="${thStyle}">${escapeHtml(c.header)}</th>`).join('')}</tr></thead>`;
    const bodyRows = items
      .map(
        (row) =>
          `<tr>${TSL_COLUMNS.map((c) => {
            const text = tslMailCell(row, c.key);
            const isName = c.key === 'itemName';
            const isNum = TSL_NUMERIC_KEYS.has(c.key);
            const st = isName ? tdStyleName : isNum ? tdNumeric : tdStyleCenter;
            return `<td style="${st}">${escapeHtml(text)}</td>`;
          }).join('')}</tr>`,
      )
      .join('');
    const footRow = truncated
      ? `<tr><td colspan="${TSL_COLUMNS.length}" style="${tdStyleCenter};font-style:italic;color:#374151;">${escapeHtml(`(행이 많아 상위 ${items.length}건만 표시했습니다.)`)}</td></tr>`
      : '';
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="${tableStyle}">${thead}<tbody>${bodyRows}${footRow}</tbody></table>`;
  }

  private buildPuHtmlTable(items: PuDelvInItemRow[], truncated: boolean): string {
    const tableStyle =
      'border-collapse:collapse;border:2px solid #1b4332;table-layout:auto;font-size:12px;font-family:Malgun Gothic,Apple SD Gothic Neo,sans-serif;width:max-content;max-width:100%;';
    const thStyle =
      'border:1px solid #14532d;background:#2d6a4f;color:#ffffff;padding:8px 10px;text-align:center;font-weight:600;white-space:nowrap;';
    const tdBase =
      'border:1px solid #95d5b2;background:#ffffff;padding:6px 10px;vertical-align:middle;color:#111827;';
    const tdStyleCenter = `${tdBase}text-align:center;`;
    const tdStyleName = `${tdBase}text-align:left;`;
    const tdNumeric = `${tdStyleCenter}font-variant-numeric:tabular-nums;`;

    if (items.length === 0) {
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="${tableStyle}"><tbody><tr><td style="${tdStyleCenter}" colspan="${PU_COLUMNS.length}">${escapeHtml('조회 결과가 없습니다.')}</td></tr></tbody></table>`;
    }

    const thead = `<thead><tr>${PU_COLUMNS.map((c) => `<th style="${thStyle}">${escapeHtml(c.header)}</th>`).join('')}</tr></thead>`;
    const bodyRows = items
      .map(
        (row) =>
          `<tr>${PU_COLUMNS.map((c) => {
            const text = puMailCell(row, c.key);
            const isName = c.key === 'itemName';
            const isNum = PU_NUMERIC_KEYS.has(c.key);
            const st = isName ? tdStyleName : isNum ? tdNumeric : tdStyleCenter;
            return `<td style="${st}">${escapeHtml(text)}</td>`;
          }).join('')}</tr>`,
      )
      .join('');
    const footRow = truncated
      ? `<tr><td colspan="${PU_COLUMNS.length}" style="${tdStyleCenter};font-style:italic;color:#374151;">${escapeHtml(`(행이 많아 상위 ${items.length}건만 표시했습니다.)`)}</td></tr>`
      : '';
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="${tableStyle}">${thead}<tbody>${bodyRows}${footRow}</tbody></table>`;
  }
}
