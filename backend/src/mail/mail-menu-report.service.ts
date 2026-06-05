import { Injectable, Logger } from '@nestjs/common';
import { ErpPuDelvInItemsService, type PuDelvInItemRow } from '../external/erp/erp-pu-delv-in-items.service';
import { ErpPuDelvItemsService, type PuDelvItemRow } from '../external/erp/erp-pu-delv-items.service';
import { ErpTslExportInvoiceItemsService, type TslExportInvoiceItemRow } from '../external/erp/erp-tsl-export-invoice-items.service';
import { ErpTslDvReqItemsService, type TslDvReqItemRow } from '../external/erp/erp-tsl-dv-req-items.service';
import { ErpTslInvoiceItemsService, type TslInvoiceItemRow } from '../external/erp/erp-tsl-invoice-items.service';
import { escapeHtml } from './mail-html-body';
import { isPuDelvInItemsMailMenu } from './mail-pu-delv-in-menu-match';
import { isPuDelvItemsMailMenu } from './mail-pu-delv-menu-match';
import { isTslDvReqItemsMailMenu } from './mail-tsl-dv-req-menu-match';
import { isTslExportInvoiceItemsMailMenu } from './mail-tsl-export-invoice-menu-match';
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
]);

const PU_NUMERIC_KEYS = new Set<keyof PuDelvInItemRow>([
  'rowNo',
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

const PDV_NUMERIC_KEYS = new Set<keyof PuDelvItemRow>([
  'rowNo',
  'bizUnit',
  'unitPrice',
  'qty',
  'vatRate',
  'supplyAmount',
  'vatAmount',
  'totalAmount',
  'exchangeRate',
  'domSupplyAmount',
  'domVatAmount',
  'domTotalAmount',
  'inQty',
  'inAmount',
  'inDomAmount',
  'okQty',
  'ngQty',
  'ngReturnQty',
]);

/** 구매납품 품목 — 엑셀「구매납품품목조회」50열(선택 제외) 순서 */
const PDV_COLUMNS: { key: keyof PuDelvItemRow; header: string }[] = [
  { key: 'rowNo', header: '순번' },
  { key: 'bizUnit', header: '사업단위' },
  { key: 'delvDate', header: '납품일' },
  { key: 'delvNo', header: '납품번호' },
  { key: 'purOrderDate', header: '발주일' },
  { key: 'purOrderNo', header: '발주번호' },
  { key: 'customerName', header: '구매거래처' },
  { key: 'customerCode', header: '구매처번호' },
  { key: 'delvKind', header: '납품구분' },
  { key: 'recvProgressStatus', header: '입고진행상태' },
  { key: 'delvDept', header: '납품부서' },
  { key: 'delvChargePerson', header: '납품담당자' },
  { key: 'inspectionKind', header: '검사구분' },
  { key: 'itemName', header: '품명' },
  { key: 'itemCode', header: '품번' },
  { key: 'spec', header: '규격' },
  { key: 'unit', header: '단위' },
  { key: 'unitPrice', header: '납품단가' },
  { key: 'qty', header: '납품수량' },
  { key: 'vatIncluded', header: '부가세포함여부' },
  { key: 'vatRate', header: '부가세율' },
  { key: 'supplyAmount', header: '금액' },
  { key: 'vatAmount', header: '부가세' },
  { key: 'totalAmount', header: '금액계' },
  { key: 'currency', header: '통화' },
  { key: 'exchangeRate', header: '환율' },
  { key: 'domSupplyAmount', header: '원화금액' },
  { key: 'domVatAmount', header: '원화부가세' },
  { key: 'domTotalAmount', header: '원화금액계' },
  { key: 'inQty', header: '입고수량' },
  { key: 'inAmount', header: '입고금액' },
  { key: 'inDomAmount', header: '입고원화금액' },
  { key: 'localForeignKind', header: '내외자구분' },
  { key: 'whName', header: '창고' },
  { key: 'manufacturer', header: '제조사' },
  { key: 'itemAssetClass', header: '품목자산분류' },
  { key: 'validUntilDate', header: '유효일자' },
  { key: 'okQty', header: '합격수량' },
  { key: 'ngQty', header: '불합격수량' },
  { key: 'ngReturnQty', header: '불합격반품수량' },
  { key: 'specialNote', header: '특이사항' },
  { key: 'remark', header: '비고' },
  { key: 'sourceInquiry', header: '원천조회' },
  { key: 'progressInquiry', header: '진행조회' },
  { key: 'sourceMgmtNo', header: '원천관리번호' },
  { key: 'sourceNo', header: '원천번호' },
  { key: 'custLotNo', header: '고객LotNo' },
  { key: 'lastWorkDatetime', header: '최종작업일시' },
  { key: 'itemClassL', header: '품목대분류' },
  { key: 'itemClassM', header: '품목중분류' },
  { key: 'itemClassS', header: '품목소분류' },
];

const PDV_MAIL_LEFT_KEYS = new Set<keyof PuDelvItemRow>([
  'itemName',
  'customerName',
  'remark',
  'specialNote',
  'purOrderNo',
  'sourceMgmtNo',
  'sourceNo',
  'manufacturer',
]);

const DV_REQ_NUMERIC_KEYS = new Set<keyof TslDvReqItemRow>([
  'rowNo',
  'bizUnit',
  'reqSeq',
  'umOutKind',
  'lineSerl',
  'qty',
  'unitPrice',
  'supplyAmount',
  'vatAmount',
  'totalAmount',
]);

const DV_MAIL_LEFT_KEYS = new Set<keyof TslDvReqItemRow>(['itemName', 'customerName', 'remark', 'deptName', 'empName']);

/** 반품요청 품목 — API `TslDvReqItemRow` 열 순서 */
const DV_REQ_COLUMNS: { key: keyof TslDvReqItemRow; header: string }[] = [
  { key: 'rowNo', header: '순번' },
  { key: 'bizUnit', header: '사업장' },
  { key: 'reqSeq', header: '요청Seq' },
  { key: 'reqNo', header: '요청번호' },
  { key: 'reqDate', header: '요청일' },
  { key: 'umOutKind', header: 'UM출고구분' },
  { key: 'customerCode', header: '거래처코드' },
  { key: 'customerName', header: '거래처명' },
  { key: 'deptName', header: '부서' },
  { key: 'empName', header: '담당자' },
  { key: 'lineSerl', header: '라인순번' },
  { key: 'itemNo', header: '품번' },
  { key: 'itemName', header: '품명' },
  { key: 'spec', header: '규격' },
  { key: 'unit', header: '단위' },
  { key: 'qty', header: '수량' },
  { key: 'unitPrice', header: '단가' },
  { key: 'supplyAmount', header: '공급가액' },
  { key: 'vatAmount', header: '부가세' },
  { key: 'totalAmount', header: '합계' },
  { key: 'remark', header: '비고' },
];

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

function pdvMailCell(row: PuDelvItemRow, key: keyof PuDelvItemRow): string {
  const v = row[key];
  if (PDV_NUMERIC_KEYS.has(key)) {
    return formatNumberKo(v as number | null | undefined);
  }
  return cell(v as string | number | null);
}

function dvMailCell(row: TslDvReqItemRow, key: keyof TslDvReqItemRow): string {
  const v = row[key];
  if (DV_REQ_NUMERIC_KEYS.has(key)) {
    return formatNumberKo(v as number | null | undefined);
  }
  return cell(v as string | number | null);
}

const TSL_EXP_NUMERIC_KEYS = new Set<keyof TslExportInvoiceItemRow>([
  'rowNo',
  'bizUnit',
  'qty',
  'unitPrice',
  'amount',
  'foreignAmount',
  'exchangeRate',
  'netWeight',
  'grossWeight',
  'packQty',
]);

const TSL_EXP_MAIL_LEFT_KEYS = new Set<keyof TslExportInvoiceItemRow>([
  'category',
  'customer',
  'itemName',
  'remark',
  'portOfLoading',
  'destination',
  'incoterms',
  'paymentTerms',
  'hsCode',
  'originCountry',
  'measurement',
  'cartonNo',
  'exportDeclNo',
  'licenseNo',
  'lcNo',
  'blNo',
  'vesselName',
  'voyageNo',
  'transportMeans',
  'packMethod',
  'packUnit',
  'project',
  'exportKind',
  'spec',
  'itemCode',
  'unit',
]);

/** 수출 Invoice 품목 — 화면 그리드 열 순서 */
const TSL_EXP_COLUMNS: { key: keyof TslExportInvoiceItemRow; header: string }[] = [
  { key: 'rowNo', header: '순번' },
  { key: 'category', header: '구분' },
  { key: 'invoiceNo', header: 'Invoice No.' },
  { key: 'invoiceDate', header: 'Invoice일자' },
  { key: 'customer', header: '거래처' },
  { key: 'itemCode', header: '품목코드' },
  { key: 'itemName', header: '품목명' },
  { key: 'spec', header: '규격' },
  { key: 'unit', header: '단위' },
  { key: 'qty', header: '수량' },
  { key: 'unitPrice', header: '단가' },
  { key: 'amount', header: '금액' },
  { key: 'foreignAmount', header: '외화금액' },
  { key: 'remark', header: '비고' },
  { key: 'exportKind', header: '수출구분' },
  { key: 'shipDate', header: '선적일자' },
  { key: 'portOfLoading', header: '선적지' },
  { key: 'destination', header: '도착지' },
  { key: 'incoterms', header: '인코텀즈' },
  { key: 'paymentTerms', header: '결제조건' },
  { key: 'currencyName', header: '통화' },
  { key: 'exchangeRate', header: '환율' },
  { key: 'hsCode', header: 'HS Code' },
  { key: 'originCountry', header: '원산지' },
  { key: 'netWeight', header: 'Net Weight' },
  { key: 'grossWeight', header: 'Gross Weight' },
  { key: 'measurement', header: 'Measurement' },
  { key: 'cartonNo', header: 'Carton No.' },
  { key: 'exportDeclNo', header: '수출신고번호' },
  { key: 'exportDeclDate', header: '수출신고일자' },
  { key: 'licenseNo', header: '면장번호' },
  { key: 'licenseDate', header: '면장일자' },
  { key: 'lcNo', header: 'L/C No.' },
  { key: 'blNo', header: 'B/L No.' },
  { key: 'vesselName', header: '선명' },
  { key: 'voyageNo', header: '항차' },
  { key: 'etd', header: 'ETD' },
  { key: 'eta', header: 'ETA' },
  { key: 'transportMeans', header: '운송수단' },
  { key: 'packMethod', header: '포장방법' },
  { key: 'packQty', header: '포장수량' },
  { key: 'packUnit', header: '포장단위' },
  { key: 'project', header: '프로젝트' },
  { key: 'bizUnit', header: '사업장' },
];

function expMailCell(row: TslExportInvoiceItemRow, key: keyof TslExportInvoiceItemRow): string {
  const v = row[key];
  if (TSL_EXP_NUMERIC_KEYS.has(key)) {
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
];

/** 구매입고/반품 품목(엑셀 29열과 동일 순서) */
const PU_COLUMNS: { key: keyof PuDelvInItemRow; header: string }[] = [
  { key: 'rowNo', header: '순번' },
  { key: 'bizUnit', header: '사업장' },
  { key: 'receiptDate', header: '입고일' },
  { key: 'receiptNo', header: '입고번호' },
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

/** ERP 일자별 메일 본문·HTML에서 조회 행이 없을 때 안내 문구 */
const ERP_MAIL_NO_ROWS_MESSAGE = '당일 등록된 실적이 없습니다.';

/** 발송메뉴현황(프론트 EIS 그리드)과 동일: 연회색 헤더·검은 테두리·흰 본문 */
const MAIL_ERP_TABLE_STYLE =
  'border-collapse:collapse;border:1px solid #000000;table-layout:auto;font-size:11px;font-family:Malgun Gothic,Apple SD Gothic Neo,sans-serif;width:max-content;max-width:100%;';
const MAIL_ERP_TH_STYLE =
  'border:1px solid #000000;background:#E7E6E6;color:#000000;padding:8px 10px;text-align:center;font-weight:700;white-space:nowrap;';
const MAIL_ERP_TD_BASE =
  'border:1px solid #000000;background:#ffffff;padding:6px 10px;vertical-align:middle;color:#000000;';
const MAIL_ERP_TD_CENTER = `${MAIL_ERP_TD_BASE}text-align:center;`;
const MAIL_ERP_TD_LEFT = `${MAIL_ERP_TD_BASE}text-align:left;`;
const MAIL_ERP_TD_NUM = `${MAIL_ERP_TD_BASE}text-align:right;font-variant-numeric:tabular-nums;`;

function buildTslHtmlTableFragment(items: TslInvoiceItemRow[], truncated: boolean): string {
  const tableStyle = MAIL_ERP_TABLE_STYLE;
  const thStyle = MAIL_ERP_TH_STYLE;
  const tdStyleCenter = MAIL_ERP_TD_CENTER;
  const tdStyleName = MAIL_ERP_TD_LEFT;
  const tdNumeric = MAIL_ERP_TD_NUM;

  if (items.length === 0) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="${tableStyle}"><tbody><tr><td style="${tdStyleCenter}" colspan="${TSL_COLUMNS.length}">${escapeHtml(ERP_MAIL_NO_ROWS_MESSAGE)}</td></tr></tbody></table>`;
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

function buildTslExpHtmlTableFragment(items: TslExportInvoiceItemRow[], truncated: boolean): string {
  const tableStyle = MAIL_ERP_TABLE_STYLE;
  const thStyle = MAIL_ERP_TH_STYLE;
  const tdStyleCenter = MAIL_ERP_TD_CENTER;
  const tdStyleName = MAIL_ERP_TD_LEFT;
  const tdNumeric = MAIL_ERP_TD_NUM;

  if (items.length === 0) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="${tableStyle}"><tbody><tr><td style="${tdStyleCenter}" colspan="${TSL_EXP_COLUMNS.length}">${escapeHtml(ERP_MAIL_NO_ROWS_MESSAGE)}</td></tr></tbody></table>`;
  }

  const thead = `<thead><tr>${TSL_EXP_COLUMNS.map((c) => `<th style="${thStyle}">${escapeHtml(c.header)}</th>`).join('')}</tr></thead>`;
  const bodyRows = items
    .map(
      (row) =>
        `<tr>${TSL_EXP_COLUMNS.map((c) => {
          const text = expMailCell(row, c.key);
          const isLeft = TSL_EXP_MAIL_LEFT_KEYS.has(c.key);
          const isNum = TSL_EXP_NUMERIC_KEYS.has(c.key);
          const st = isLeft ? tdStyleName : isNum ? tdNumeric : tdStyleCenter;
          return `<td style="${st}">${escapeHtml(text)}</td>`;
        }).join('')}</tr>`,
    )
    .join('');
  const footRow = truncated
    ? `<tr><td colspan="${TSL_EXP_COLUMNS.length}" style="${tdStyleCenter};font-style:italic;color:#374151;">${escapeHtml(`(행이 많아 상위 ${items.length}건만 표시했습니다.)`)}</td></tr>`
    : '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="${tableStyle}">${thead}<tbody>${bodyRows}${footRow}</tbody></table>`;
}

function buildPuHtmlTableFragment(items: PuDelvInItemRow[], truncated: boolean): string {
  const tableStyle = MAIL_ERP_TABLE_STYLE;
  const thStyle = MAIL_ERP_TH_STYLE;
  const tdStyleCenter = MAIL_ERP_TD_CENTER;
  const tdStyleName = MAIL_ERP_TD_LEFT;
  const tdNumeric = MAIL_ERP_TD_NUM;

  if (items.length === 0) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="${tableStyle}"><tbody><tr><td style="${tdStyleCenter}" colspan="${PU_COLUMNS.length}">${escapeHtml(ERP_MAIL_NO_ROWS_MESSAGE)}</td></tr></tbody></table>`;
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

function buildPdvHtmlTableFragment(items: PuDelvItemRow[], truncated: boolean): string {
  const tableStyle = MAIL_ERP_TABLE_STYLE;
  const thStyle = MAIL_ERP_TH_STYLE;
  const tdStyleCenter = MAIL_ERP_TD_CENTER;
  const tdStyleName = MAIL_ERP_TD_LEFT;
  const tdNumeric = MAIL_ERP_TD_NUM;

  if (items.length === 0) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="${tableStyle}"><tbody><tr><td style="${tdStyleCenter}" colspan="${PDV_COLUMNS.length}">${escapeHtml(ERP_MAIL_NO_ROWS_MESSAGE)}</td></tr></tbody></table>`;
  }

  const thead = `<thead><tr>${PDV_COLUMNS.map((c) => `<th style="${thStyle}">${escapeHtml(c.header)}</th>`).join('')}</tr></thead>`;
  const bodyRows = items
    .map(
      (row) =>
        `<tr>${PDV_COLUMNS.map((c) => {
          const text = pdvMailCell(row, c.key);
          const isLeft = PDV_MAIL_LEFT_KEYS.has(c.key);
          const isNum = PDV_NUMERIC_KEYS.has(c.key);
          const st = isLeft ? tdStyleName : isNum ? tdNumeric : tdStyleCenter;
          return `<td style="${st}">${escapeHtml(text)}</td>`;
        }).join('')}</tr>`,
    )
    .join('');
  const footRow = truncated
    ? `<tr><td colspan="${PDV_COLUMNS.length}" style="${tdStyleCenter};font-style:italic;color:#374151;">${escapeHtml(`(행이 많아 상위 ${items.length}건만 표시했습니다.)`)}</td></tr>`
    : '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="${tableStyle}">${thead}<tbody>${bodyRows}${footRow}</tbody></table>`;
}

function buildDvReqHtmlTableFragment(items: TslDvReqItemRow[], truncated: boolean): string {
  const tableStyle = MAIL_ERP_TABLE_STYLE;
  const thStyle = MAIL_ERP_TH_STYLE;
  const tdStyleCenter = MAIL_ERP_TD_CENTER;
  const tdStyleName = MAIL_ERP_TD_LEFT;
  const tdNumeric = MAIL_ERP_TD_NUM;

  if (items.length === 0) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="${tableStyle}"><tbody><tr><td style="${tdStyleCenter}" colspan="${DV_REQ_COLUMNS.length}">${escapeHtml(ERP_MAIL_NO_ROWS_MESSAGE)}</td></tr></tbody></table>`;
  }

  const thead = `<thead><tr>${DV_REQ_COLUMNS.map((c) => `<th style="${thStyle}">${escapeHtml(c.header)}</th>`).join('')}</tr></thead>`;
  const bodyRows = items
    .map(
      (row) =>
        `<tr>${DV_REQ_COLUMNS.map((c) => {
          const text = dvMailCell(row, c.key);
          const isLeft = DV_MAIL_LEFT_KEYS.has(c.key);
          const isNum = DV_REQ_NUMERIC_KEYS.has(c.key);
          const st = isLeft ? tdStyleName : isNum ? tdNumeric : tdStyleCenter;
          return `<td style="${st}">${escapeHtml(text)}</td>`;
        }).join('')}</tr>`,
    )
    .join('');
  const footRow = truncated
    ? `<tr><td colspan="${DV_REQ_COLUMNS.length}" style="${tdStyleCenter};font-style:italic;color:#374151;">${escapeHtml(`(행이 많아 상위 ${items.length}건만 표시했습니다.)`)}</td></tr>`
    : '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="${tableStyle}">${thead}<tbody>${bodyRows}${footRow}</tbody></table>`;
}

@Injectable()
export class MailMenuReportService {
  private readonly logger = new Logger(MailMenuReportService.name);
  /** 메일 본문 크기 제한을 위해 행 상한 */
  private static readonly ERP_EMAIL_ROW_LIMIT = 2000;

  constructor(
    private readonly tslItems: ErpTslInvoiceItemsService,
    private readonly tslExportInvoiceItems: ErpTslExportInvoiceItemsService,
    private readonly tslDvReqItems: ErpTslDvReqItemsService,
    private readonly puDelvInItems: ErpPuDelvInItemsService,
    private readonly puDelvItems: ErpPuDelvItemsService,
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
    if (isTslExportInvoiceItemsMailMenu(menu)) {
      return this.appendTslExportInvoiceReport(body, menu, today);
    }
    if (isPuDelvItemsMailMenu(menu)) {
      return this.appendPuDelvItemsReport(body, menu, today);
    }
    if (isPuDelvInItemsMailMenu(menu)) {
      return this.appendPuDelvInReport(body, menu, today);
    }
    if (isTslDvReqItemsMailMenu(menu)) {
      return this.appendTslDvReqReport(body, menu, today);
    }
    return { text: body ?? '' };
  }

  private appendTslInvoiceReport(
    body: string,
    _menu: { label: string; code: string },
    today: string,
  ): Promise<MailMenuReportAppendResult> {
    const base = (body ?? '').trimEnd();

    return (async () => {
      try {
        const { items, truncated } = await this.tslItems.listByInvoiceDateRange(
          today,
          today,
          MailMenuReportService.ERP_EMAIL_ROW_LIMIT,
        );
        const plainReport = this.formatTslPlainText(items, truncated);
        const fullText = base ? `${base}\n${plainReport}` : plainReport.replace(/^\n+/, '');
        const intro = base ? `${base}\n\n` : '';
        const mailHtmlTableFragment = buildTslHtmlTableFragment(items, truncated);
        return {
          text: fullText,
          mailHtmlStructuredIntro: intro,
          mailHtmlTableFragment,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`메일 본문용 거래명세 품목 조회 실패: ${msg}`);
        const reportBlock = ['', `[ERP 조회 실패] ${msg}`].join('\n');
        const fullText = base ? `${base}\n${reportBlock}` : reportBlock.replace(/^\n+/, '');
        return { text: fullText };
      }
    })();
  }

  private appendTslExportInvoiceReport(
    body: string,
    _menu: { label: string; code: string },
    today: string,
  ): Promise<MailMenuReportAppendResult> {
    const base = (body ?? '').trimEnd();

    return (async () => {
      try {
        const { items, truncated } = await this.tslExportInvoiceItems.listExportByInvoiceDateRange(
          today,
          today,
          MailMenuReportService.ERP_EMAIL_ROW_LIMIT,
        );
        const plainReport = this.formatTslExportPlainText(items, truncated);
        const fullText = base ? `${base}\n${plainReport}` : plainReport.replace(/^\n+/, '');
        const intro = base ? `${base}\n\n` : '';
        const mailHtmlTableFragment = buildTslExpHtmlTableFragment(items, truncated);
        return {
          text: fullText,
          mailHtmlStructuredIntro: intro,
          mailHtmlTableFragment,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`메일 본문용 수출 Invoice 품목 조회 실패: ${msg}`);
        const reportBlock = ['', `[ERP 조회 실패] ${msg}`].join('\n');
        const fullText = base ? `${base}\n${reportBlock}` : reportBlock.replace(/^\n+/, '');
        return { text: fullText };
      }
    })();
  }

  private appendPuDelvInReport(
    body: string,
    _menu: { label: string; code: string },
    today: string,
  ): Promise<MailMenuReportAppendResult> {
    const base = (body ?? '').trimEnd();

    return (async () => {
      try {
        const { items, truncated } = await this.puDelvInItems.listByDelvInDateRange(
          today,
          today,
          MailMenuReportService.ERP_EMAIL_ROW_LIMIT,
        );
        const plainReport = this.formatPuPlainText(items, truncated);
        const fullText = base ? `${base}\n${plainReport}` : plainReport.replace(/^\n+/, '');
        const intro = base ? `${base}\n\n` : '';
        const mailHtmlTableFragment = buildPuHtmlTableFragment(items, truncated);
        return {
          text: fullText,
          mailHtmlStructuredIntro: intro,
          mailHtmlTableFragment,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`메일 본문용 구매입고 품목 조회 실패: ${msg}`);
        const reportBlock = ['', `[ERP 조회 실패] ${msg}`].join('\n');
        const fullText = base ? `${base}\n${reportBlock}` : reportBlock.replace(/^\n+/, '');
        return { text: fullText };
      }
    })();
  }

  private appendPuDelvItemsReport(
    body: string,
    _menu: { label: string; code: string },
    today: string,
  ): Promise<MailMenuReportAppendResult> {
    const base = (body ?? '').trimEnd();

    return (async () => {
      try {
        const { items, truncated } = await this.puDelvItems.listByDelvDateRange(
          today,
          today,
          MailMenuReportService.ERP_EMAIL_ROW_LIMIT,
        );
        const plainReport = this.formatPdvPlainText(items, truncated);
        const fullText = base ? `${base}\n${plainReport}` : plainReport.replace(/^\n+/, '');
        const intro = base ? `${base}\n\n` : '';
        const mailHtmlTableFragment = buildPdvHtmlTableFragment(items, truncated);
        return {
          text: fullText,
          mailHtmlStructuredIntro: intro,
          mailHtmlTableFragment,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`메일 본문용 구매납품 품목 조회 실패: ${msg}`);
        const reportBlock = ['', `[ERP 조회 실패] ${msg}`].join('\n');
        const fullText = base ? `${base}\n${reportBlock}` : reportBlock.replace(/^\n+/, '');
        return { text: fullText };
      }
    })();
  }

  private appendTslDvReqReport(
    body: string,
    _menu: { label: string; code: string },
    today: string,
  ): Promise<MailMenuReportAppendResult> {
    const base = (body ?? '').trimEnd();

    return (async () => {
      try {
        const { items, truncated } = await this.tslDvReqItems.listByReqDateRange(
          today,
          today,
          MailMenuReportService.ERP_EMAIL_ROW_LIMIT,
        );
        const plainReport = this.formatDvReqPlainText(items, truncated);
        const fullText = base ? `${base}\n${plainReport}` : plainReport.replace(/^\n+/, '');
        const intro = base ? `${base}\n\n` : '';
        const mailHtmlTableFragment = buildDvReqHtmlTableFragment(items, truncated);
        return {
          text: fullText,
          mailHtmlStructuredIntro: intro,
          mailHtmlTableFragment,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`메일 본문용 반품요청 품목 조회 실패: ${msg}`);
        const reportBlock = ['', `[ERP 조회 실패] ${msg}`].join('\n');
        const fullText = base ? `${base}\n${reportBlock}` : reportBlock.replace(/^\n+/, '');
        return { text: fullText };
      }
    })();
  }

  private formatTslExportPlainText(items: TslExportInvoiceItemRow[], truncated: boolean): string {
    const lines: string[] = [];
    if (items.length === 0) {
      lines.push(ERP_MAIL_NO_ROWS_MESSAGE);
    } else {
      lines.push(TSL_EXP_COLUMNS.map((c) => c.header).join('\t'));
      for (const row of items) {
        lines.push(TSL_EXP_COLUMNS.map((c) => expMailCell(row, c.key)).join('\t'));
      }
      if (truncated) {
        lines.push(`(행이 많아 상위 ${items.length}건만 표시했습니다.)`);
      }
    }
    return lines.join('\n');
  }

  private formatTslPlainText(items: TslInvoiceItemRow[], truncated: boolean): string {
    const lines: string[] = [];
    if (items.length === 0) {
      lines.push(ERP_MAIL_NO_ROWS_MESSAGE);
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

  private formatPuPlainText(items: PuDelvInItemRow[], truncated: boolean): string {
    const lines: string[] = [];
    if (items.length === 0) {
      lines.push(ERP_MAIL_NO_ROWS_MESSAGE);
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

  private formatDvReqPlainText(items: TslDvReqItemRow[], truncated: boolean): string {
    const lines: string[] = [];
    if (items.length === 0) {
      lines.push(ERP_MAIL_NO_ROWS_MESSAGE);
    } else {
      lines.push(DV_REQ_COLUMNS.map((c) => c.header).join('\t'));
      for (const row of items) {
        lines.push(DV_REQ_COLUMNS.map((c) => dvMailCell(row, c.key)).join('\t'));
      }
      if (truncated) {
        lines.push(`(행이 많아 상위 ${items.length}건만 표시했습니다.)`);
      }
    }
    return lines.join('\n');
  }

  private formatPdvPlainText(items: PuDelvItemRow[], truncated: boolean): string {
    const lines: string[] = [];
    if (items.length === 0) {
      lines.push(ERP_MAIL_NO_ROWS_MESSAGE);
    } else {
      lines.push(PDV_COLUMNS.map((c) => c.header).join('\t'));
      for (const row of items) {
        lines.push(PDV_COLUMNS.map((c) => pdvMailCell(row, c.key)).join('\t'));
      }
      if (truncated) {
        lines.push(`(행이 많아 상위 ${items.length}건만 표시했습니다.)`);
      }
    }
    return lines.join('\n');
  }
}
