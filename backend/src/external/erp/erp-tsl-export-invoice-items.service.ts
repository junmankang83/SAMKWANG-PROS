import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mssql from 'mssql';

/**
 * 수출 Invoice 품목 — `dbo._TSLInvoice` + `dbo._TSLInvoiceItem`
 * `SMExpKind` = `8009004` 인 품목만. `_TSLInvoice` 또는 `_TSLInvoiceItem` 중 컬럼이 있는 쪽(또는 둘 다)으로 필터합니다.
 * 수출 부가 컬럼은 ERP별 컬럼명 차이를 `INFORMATION_SCHEMA`로 감지합니다.
 */
export type TslExportInvoiceItemRow = {
  rowNo: number;
  category: string | null;
  invoiceNo: string | null;
  invoiceDate: string;
  customer: string | null;
  itemCode: string | null;
  itemName: string | null;
  spec: string | null;
  unit: string | null;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null;
  foreignAmount: number | null;
  remark: string | null;
  exportKind: string | null;
  shipDate: string;
  portOfLoading: string | null;
  destination: string | null;
  incoterms: string | null;
  paymentTerms: string | null;
  currencyName: string | null;
  exchangeRate: number | null;
  hsCode: string | null;
  originCountry: string | null;
  netWeight: number | null;
  grossWeight: number | null;
  measurement: string | null;
  cartonNo: string | null;
  exportDeclNo: string | null;
  exportDeclDate: string;
  licenseNo: string | null;
  licenseDate: string;
  lcNo: string | null;
  blNo: string | null;
  vesselName: string | null;
  voyageNo: string | null;
  etd: string;
  eta: string;
  transportMeans: string | null;
  packMethod: string | null;
  packQty: number | null;
  packUnit: string | null;
  project: string | null;
  bizUnit: number | null;
};

/**
 * 수출 반품 품목 — ERP「수출반품품목조회」
 * `InvoiceDate` 구간·음수 반품 라인·**`_TSLInvoice.SMExpKind` = `8009019`**·**`UMOutKind` ↔ `_TDAUMinorValue`**(8020·2002·ValueText `1`) MinorSeq 매칭.
 */
export type TslExportReturnInvoiceItemRow = {
  rowNo: number;
  status: string | null;
  siteName: string | null;
  salesDeptNo: string | null;
  invoiceNo: string | null;
  invoiceDate: string;
  salesType: string | null;
  customerCode: string | null;
  customerName: string | null;
  shipperName: string | null;
  itemCode: string | null;
  itemName: string | null;
  spec: string | null;
  unit: string | null;
  currencyName: string | null;
  exchangeRate: number | null;
  exportUnitPrice: number | null;
  salesUnitPrice: number | null;
  /** 표시·메일용 단가 (수출단가 우선, 없으면 판매단가) */
  unitPrice: number | null;
  qty: number | null;
  foreignAmount: number | null;
  amount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  managementNo: string | null;
  shipmentNo: string | null;
  warehouseName: string | null;
  chargePersonName: string | null;
  lotNo: string | null;
  exportDeclNo: string | null;
  remark: string | null;
  exportKind: string | null;
};

type SqlRow = {
  CategoryStr: string | null;
  InvoiceNoFmt: string | null;
  InvoiceDateRaw: string | null;
  CustDisplay: string | null;
  ItemNo: string | null;
  ItemName: string | null;
  Spec: string | null;
  UnitName: string | null;
  Qty: number | null;
  LineUnitPrice: number | null;
  DomAmt: number | null;
  CurAmt: number | null;
  LineRemark: string | null;
  LineMemo: string | null;
  SMExpKindText: string | null;
  ShipDateRaw: string | null;
  PortLoading: string | null;
  Destination: string | null;
  Incoterms: string | null;
  PaymentTerms: string | null;
  CurrName: string | null;
  CurrNo: string | null;
  ExRate: number | null;
  HSCode: string | null;
  OriginCountry: string | null;
  NetWeight: number | null;
  GrossWeight: number | null;
  Measurement: string | null;
  CartonNo: string | null;
  ExportDeclNo: string | null;
  ExportDeclDateRaw: string | null;
  LicenseNo: string | null;
  LicenseDateRaw: string | null;
  LCNo: string | null;
  BLNo: string | null;
  VesselName: string | null;
  VoyageNo: string | null;
  ETDRaw: string | null;
  ETARaw: string | null;
  TransportMeans: string | null;
  PackMethod: string | null;
  PackQty: number | null;
  PackUnit: string | null;
  PJTNo: string | null;
  PJTName: string | null;
  BizUnit: number | null;
};

type SqlReturnRow = SqlRow & {
  StatusRaw: string | null;
  CustNo: string | null;
  CustName: string | null;
  BizUnitName: string | null;
  SalesDeptNo: string | null;
  SalesTypeText: string | null;
  ShipperDisplay: string | null;
  ExportUnitPrice: number | null;
  SalesUnitPrice: number | null;
  MgmtNo: string | null;
  ShipmentNo: string | null;
  DomVAT: number | null;
  LineTotal: number | null;
  WHDisplay: string | null;
  EmpName: string | null;
  LotNo: string | null;
};

type ColMeta = { TABLE_NAME: string; COLUMN_NAME: string };

type InvoiceCoreFragments = {
  lineRemarkSelect: string;
  lineMemoSelect: string;
  lineUnitPriceExpr: string;
  currNameSelect: string;
  currNoSelect: string;
  smIncludePredicate: string;
};

type ExportExtraFragments = {
  categoryStr: string;
  shipDateRaw: string;
  portLoading: string;
  destination: string;
  incoterms: string;
  paymentTerms: string;
  hsCode: string;
  originCountry: string;
  netWeight: string;
  grossWeight: string;
  measurement: string;
  cartonNo: string;
  exportDeclNo: string;
  exportDeclDateRaw: string;
  licenseNo: string;
  licenseDateRaw: string;
  lcNo: string;
  blNo: string;
  vesselName: string;
  voyageNo: string;
  etdRaw: string;
  etaRaw: string;
  transportMeans: string;
  packMethod: string;
  packQty: string;
  packUnit: string;
  smExpKindText: string;
};

type TslExportInvoiceQueryParts = InvoiceCoreFragments & ExportExtraFragments;

const DEFAULT_LIMIT = 8000;
const MAX_RANGE_DAYS = 400;

/** `_TSLInvoice.SMExpKind` 가 이 값과 같을 때만 수출 Invoice 품목으로 조회 */
const INCLUDED_SM_EXP_KIND = '8009004';

/** 수출반품: `_TSLInvoice.SMExpKind` = 이 값만 WHERE (수출 Invoice `8009004` 와 별도). */
const EXPORT_RETURN_SM_EXP_KIND = '8009019';

/** 수출반품: `_TSLInvoice.UMOutKind` ∈ `_TDAUMinorValue.MinorSeq` (Major 8020·Serl 2002·ValueText trim `1`) — 기본 WHERE. `ERP_TSL_EXPORT_RETURN_SKIP_UM_OUT_KIND_FILTER=true` 일 때만 생략 */
const EXPORT_RETURN_UM_OUT_MV_MAJOR = 8020;
const EXPORT_RETURN_UM_OUT_MV_SERL = 2002;
const EXPORT_RETURN_UM_OUT_MV_VALUE_TEXT = '1';

function trimOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function yyyymmddToIso(d: string | null): string {
  const t = trimOrNull(d);
  if (!t || t.length < 8) return '';
  const y = t.slice(0, 4);
  const m = t.slice(4, 6);
  const day = t.slice(6, 8);
  return `${y}-${m}-${day}`;
}

/** 날짜/시각 혼재 컬럼: 앞 8자리가 YYYYMMDD 이면 ISO일자, 아니면 원문 trim */
function rawToDisplayDate(v: string | null): string {
  const t = trimOrNull(v);
  if (!t) return '';
  const digits = t.replace(/\D/g, '');
  if (digits.length >= 8) {
    return yyyymmddToIso(digits.slice(0, 8));
  }
  return t;
}

function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapRow(r: SqlRow): Omit<TslExportInvoiceItemRow, 'rowNo'> {
  const pjtNo = trimOrNull(r.PJTNo);
  const pjtName = trimOrNull(r.PJTName);
  let project: string | null = null;
  if (pjtNo && pjtName) {
    project = `${pjtNo} ${pjtName}`;
  } else {
    project = pjtNo ?? pjtName;
  }
  const curr = trimOrNull(r.CurrName) ?? trimOrNull(r.CurrNo);
  return {
    category: trimOrNull(r.CategoryStr),
    invoiceNo: trimOrNull(r.InvoiceNoFmt),
    invoiceDate: yyyymmddToIso(r.InvoiceDateRaw),
    customer: trimOrNull(r.CustDisplay),
    itemCode: trimOrNull(r.ItemNo),
    itemName: trimOrNull(r.ItemName),
    spec: trimOrNull(r.Spec),
    unit: trimOrNull(r.UnitName),
    qty: toNumber(r.Qty),
    unitPrice: toNumber(r.LineUnitPrice),
    amount: toNumber(r.DomAmt),
    foreignAmount: toNumber(r.CurAmt),
    remark: trimOrNull(r.LineRemark) ?? trimOrNull(r.LineMemo),
    exportKind: trimOrNull(r.SMExpKindText),
    shipDate: rawToDisplayDate(r.ShipDateRaw),
    portOfLoading: trimOrNull(r.PortLoading),
    destination: trimOrNull(r.Destination),
    incoterms: trimOrNull(r.Incoterms),
    paymentTerms: trimOrNull(r.PaymentTerms),
    currencyName: curr,
    exchangeRate: toNumber(r.ExRate),
    hsCode: trimOrNull(r.HSCode),
    originCountry: trimOrNull(r.OriginCountry),
    netWeight: toNumber(r.NetWeight),
    grossWeight: toNumber(r.GrossWeight),
    measurement: trimOrNull(r.Measurement),
    cartonNo: trimOrNull(r.CartonNo),
    exportDeclNo: trimOrNull(r.ExportDeclNo),
    exportDeclDate: rawToDisplayDate(r.ExportDeclDateRaw),
    licenseNo: trimOrNull(r.LicenseNo),
    licenseDate: rawToDisplayDate(r.LicenseDateRaw),
    lcNo: trimOrNull(r.LCNo),
    blNo: trimOrNull(r.BLNo),
    vesselName: trimOrNull(r.VesselName),
    voyageNo: trimOrNull(r.VoyageNo),
    etd: rawToDisplayDate(r.ETDRaw),
    eta: rawToDisplayDate(r.ETARaw),
    transportMeans: trimOrNull(r.TransportMeans),
    packMethod: trimOrNull(r.PackMethod),
    packQty: toNumber(r.PackQty),
    packUnit: trimOrNull(r.PackUnit),
    project,
    bizUnit: r.BizUnit == null ? null : Number(r.BizUnit),
  };
}

function mapReturnRow(r: SqlReturnRow): Omit<TslExportReturnInvoiceItemRow, 'rowNo'> {
  const curr = trimOrNull(r.CurrName) ?? trimOrNull(r.CurrNo);
  const remark = trimOrNull(r.LineRemark) ?? trimOrNull(r.LineMemo);
  const salesType = trimOrNull(r.SalesTypeText) ?? trimOrNull(r.SMExpKindText);
  return {
    status: trimOrNull(r.StatusRaw),
    siteName: trimOrNull(r.BizUnitName),
    salesDeptNo: trimOrNull(r.SalesDeptNo),
    invoiceNo: trimOrNull(r.InvoiceNoFmt),
    invoiceDate: yyyymmddToIso(r.InvoiceDateRaw),
    salesType,
    customerCode: trimOrNull(r.CustNo),
    customerName: trimOrNull(r.CustName),
    shipperName: trimOrNull(r.ShipperDisplay),
    itemCode: trimOrNull(r.ItemNo),
    itemName: trimOrNull(r.ItemName),
    spec: trimOrNull(r.Spec),
    unit: trimOrNull(r.UnitName),
    currencyName: curr,
    exchangeRate: toNumber(r.ExRate),
    exportUnitPrice: toNumber(r.ExportUnitPrice),
    salesUnitPrice: toNumber(r.SalesUnitPrice),
    unitPrice: toNumber(r.ExportUnitPrice) ?? toNumber(r.SalesUnitPrice),
    qty: toNumber(r.Qty),
    foreignAmount: toNumber(r.CurAmt),
    amount: toNumber(r.DomAmt),
    vatAmount: toNumber(r.DomVAT),
    totalAmount: toNumber(r.LineTotal),
    managementNo: trimOrNull(r.MgmtNo),
    shipmentNo: trimOrNull(r.ShipmentNo),
    warehouseName: trimOrNull(r.WHDisplay),
    chargePersonName: trimOrNull(r.EmpName),
    lotNo: trimOrNull(r.LotNo),
    exportDeclNo: trimOrNull(r.ExportDeclNo),
    remark,
    exportKind: trimOrNull(r.SMExpKindText),
  };
}

/** `_TSLInvoice.SMExpKind` = `_TDAUMinorValue.MinorSeq` 일 때 판매유형 문구 */
function buildExportReturnSmOuterApply(set: Set<string>): string {
  const hasMv =
    hasCol(set, '_TDAUMinorValue', 'MinorSeq') &&
    hasCol(set, '_TDAUMinorValue', 'ValueText') &&
    hasCol(set, '_TSLInvoice', 'SMExpKind');
  if (!hasMv) {
    return '';
  }
  const mvComp = hasCol(set, '_TDAUMinorValue', 'CompanySeq') ? 'AND mv.CompanySeq = h.CompanySeq' : '';
  return `OUTER APPLY (
    SELECT TOP (1)
      LTRIM(RTRIM(CAST(mv.ValueText AS NVARCHAR(200)))) AS SalesTypeText
    FROM dbo.[_TDAUMinorValue] mv
    WHERE TRY_CAST(NULLIF(LTRIM(RTRIM(CAST(h.SMExpKind AS NVARCHAR(50)))), N'') AS int) = mv.MinorSeq
      ${mvComp}
  ) smv`;
}

type ExportReturnSqlParts = {
  statusSelect: string;
  domVatSelect: string;
  lineTotalSelect: string;
  bizJoin: string;
  bizNameSelect: string;
  deptJoin: string;
  salesDeptNoSelect: string;
  shipSelect: string;
  exportPriceSelect: string;
  salesPriceSelect: string;
  mgmtNoSelect: string;
  shipmentNoSelect: string;
  whRetJoin: string;
  whOutJoin: string;
  whNameExpr: string;
  empJoin: string;
  empSelect: string;
  lotSelect: string;
};

function buildExportReturnSqlParts(cols: ColMeta[], set: Set<string>): ExportReturnSqlParts {
  const statusSelect = nvarcharH(
    cols,
    set,
    [
      'SlipStat',
      'Status',
      'DocStatus',
      'InvStatus',
      'ProgressStat',
      'ConfirmStat',
      'SlipStatus',
      'Stat',
      'UMStatus',
    ],
    'StatusRaw',
    50,
  );

  const domVatSelect = hasCol(set, '_TSLInvoiceItem', 'DomVAT')
    ? 'TRY_CAST(i.DomVAT AS decimal(18, 4)) AS DomVAT'
    : 'CAST(NULL AS decimal(18, 4)) AS DomVAT';

  const lineTotalSelect = hasCol(set, '_TSLInvoiceItem', 'DomVAT')
    ? 'CAST(ISNULL(i.DomAmt, 0) + ISNULL(i.DomVAT, 0) AS decimal(18, 4)) AS LineTotal'
    : 'CAST(ISNULL(i.DomAmt, 0) AS decimal(18, 4)) AS LineTotal';

  const hasBizTbl = cols.some((c) => c.TABLE_NAME.toUpperCase() === '_TDABIZUNIT');
  let bizJoin = '';
  let bizNameSelect = 'CAST(NULL AS nvarchar(220)) AS BizUnitName';
  const hasBizUnitCol = hasCol(set, '_TSLInvoice', 'BizUnit');
  const bizNumExpr = hasBizUnitCol ? `LTRIM(RTRIM(CAST(h.BizUnit AS NVARCHAR(20))))` : `N''`;
  if (hasBizTbl && hasBizUnitCol) {
    const buKey = pickCol(cols, '_TDABizUnit', ['BizUnit', 'BizUnitSeq', 'SiteSeq', 'WorkPlaceSeq']);
    const nameCol = pickCol(cols, '_TDABizUnit', [
      'BizUnitName',
      'BizName',
      'SiteName',
      'WorkPlaceName',
      'Name',
      'BizUnitEngName',
    ]);
    if (buKey && hasCol(set, '_TDABizUnit', buKey)) {
      bizJoin = `LEFT JOIN dbo.[_TDABizUnit] bu ON h.CompanySeq = bu.CompanySeq AND h.BizUnit = bu.[${buKey}]`;
      if (nameCol && hasCol(set, '_TDABizUnit', nameCol)) {
        bizNameSelect = `RTRIM(CONCAT(${bizNumExpr}, N' ', LTRIM(RTRIM(CAST(bu.[${nameCol}] AS NVARCHAR(200)))))) AS BizUnitName`;
      } else {
        bizNameSelect = `${bizNumExpr} AS BizUnitName`;
      }
    } else {
      bizNameSelect = `${bizNumExpr} AS BizUnitName`;
    }
  } else if (hasBizUnitCol) {
    bizNameSelect = `${bizNumExpr} AS BizUnitName`;
  }

  let deptJoin = '';
  let salesDeptNoSelect = 'CAST(NULL AS nvarchar(50)) AS SalesDeptNo';
  if (hasCol(set, '_TSLInvoice', 'DeptSeq') && cols.some((c) => c.TABLE_NAME.toUpperCase() === '_TDADEPT')) {
    deptJoin = `LEFT JOIN dbo.[_TDADept] dpRet ON h.CompanySeq = dpRet.CompanySeq AND h.DeptSeq = dpRet.DeptSeq`;
    const dno = pickCol(cols, '_TDADept', ['DeptNo', 'DeptCode', 'DeptCD', 'DeptNumber']);
    if (dno && hasCol(set, '_TDADept', dno)) {
      salesDeptNoSelect = `LTRIM(RTRIM(CAST(dpRet.[${dno}] AS NVARCHAR(50)))) AS SalesDeptNo`;
    }
  }

  const shipSelect = nvarcharH(
    cols,
    set,
    [
      'ShipperName',
      'Shipper',
      'Consignor',
      'ConsignorName',
      'ShipperEngName',
      'ExporterName',
      'ShipCompany',
      '화주',
    ],
    'ShipperDisplay',
    400,
  );

  const priceBitsExp: string[] = [];
  if (hasCol(set, '_TSLInvoiceItem', 'CustPrice')) {
    priceBitsExp.push('TRY_CAST(i.CustPrice AS decimal(18, 6))');
  }
  if (hasCol(set, '_TSLInvoiceItem', 'ItemPrice')) {
    priceBitsExp.push('TRY_CAST(i.ItemPrice AS decimal(18, 6))');
  }
  if (hasCol(set, '_TSLInvoiceItem', 'Price')) {
    priceBitsExp.push('TRY_CAST(i.Price AS decimal(18, 6))');
  }
  const linePriceFallback =
    priceBitsExp.length === 0
      ? 'CAST(NULL AS decimal(18, 6))'
      : priceBitsExp.length === 1
        ? priceBitsExp[0]
        : `COALESCE(${priceBitsExp.join(', ')})`;
  const exportPriceSelect = hasCol(set, '_TSLInvoiceItem', 'CustPrice')
    ? 'TRY_CAST(i.CustPrice AS decimal(18, 6)) AS ExportUnitPrice'
    : hasCol(set, '_TSLInvoiceItem', 'Price')
      ? 'TRY_CAST(i.Price AS decimal(18, 6)) AS ExportUnitPrice'
      : `${linePriceFallback} AS ExportUnitPrice`;
  const salesPriceSelect = hasCol(set, '_TSLInvoiceItem', 'ItemPrice')
    ? 'TRY_CAST(i.ItemPrice AS decimal(18, 6)) AS SalesUnitPrice'
    : `${linePriceFallback} AS SalesUnitPrice`;

  const mgmtNoSelect = nvarcharHi(
    cols,
    set,
    ['MgmtNo', 'ManageNo', 'ControlNo', 'TrackingNo', 'RefNo', '관리번호'],
    ['MgmtNo', 'ManageNo', 'LineMgmtNo', 'ItemMgmtNo'],
    'MgmtNo',
    120,
  );
  const shipmentNoSelect = nvarcharHi(
    cols,
    set,
    ['ShipmentNo', 'ShpNo', 'ShipNo', 'ExportShpNo', '선적번호', 'BLNo', 'HBLNo'],
    ['ShipmentNo', 'ShpNo', 'ShipNo', 'LineShpNo'],
    'ShipmentNo',
    120,
  );

  let whRetJoin = '';
  let whOutJoin = '';
  let whNameExpr = 'CAST(NULL AS nvarchar(200)) AS WHDisplay';
  const hasDV = hasCol(set, '_TSLInvoiceItem', 'DVPlaceSeq');
  const hasWH = hasCol(set, '_TSLInvoiceItem', 'WHSeq');
  if (hasDV) {
    whRetJoin = `LEFT JOIN dbo.[_TDAWH] whRet ON h.CompanySeq = whRet.CompanySeq AND i.DVPlaceSeq = whRet.WHSeq`;
  }
  if (hasWH) {
    whOutJoin = `LEFT JOIN dbo.[_TDAWH] whOut ON h.CompanySeq = whOut.CompanySeq AND i.WHSeq = whOut.WHSeq`;
  }
  if (hasDV && hasWH) {
    whNameExpr = `NULLIF(LTRIM(RTRIM(COALESCE(CAST(whRet.WHName AS NVARCHAR(200)), CAST(whOut.WHName AS NVARCHAR(200)), N''))), N'') AS WHDisplay`;
  } else if (hasDV) {
    whNameExpr = `NULLIF(LTRIM(RTRIM(CAST(whRet.WHName AS NVARCHAR(200)))), N'') AS WHDisplay`;
  } else if (hasWH) {
    whNameExpr = `NULLIF(LTRIM(RTRIM(CAST(whOut.WHName AS NVARCHAR(200)))), N'') AS WHDisplay`;
  }

  let empJoin = '';
  let empSelect = 'CAST(NULL AS nvarchar(100)) AS EmpName';
  if (hasCol(set, '_TSLInvoice', 'EmpSeq')) {
    empJoin = `LEFT JOIN dbo.[_TDAEmp] invEmp ON h.CompanySeq = invEmp.CompanySeq AND h.EmpSeq = invEmp.EmpSeq`;
    empSelect = 'invEmp.EmpName AS EmpName';
  }

  const lotSelect = hasCol(set, '_TSLInvoiceItem', 'LotNo')
    ? 'LTRIM(RTRIM(CAST(i.LotNo AS NVARCHAR(80)))) AS LotNo'
    : 'CAST(NULL AS nvarchar(80)) AS LotNo';

  return {
    statusSelect,
    domVatSelect,
    lineTotalSelect,
    bizJoin,
    bizNameSelect,
    deptJoin,
    salesDeptNoSelect,
    shipSelect,
    exportPriceSelect,
    salesPriceSelect,
    mgmtNoSelect,
    shipmentNoSelect,
    whRetJoin,
    whOutJoin,
    whNameExpr,
    empJoin,
    empSelect,
    lotSelect,
  };
}

function hasCol(set: Set<string>, table: string, col: string): boolean {
  return set.has(`${table.toUpperCase()}|${col.toUpperCase()}`);
}

function pickCol(cols: ColMeta[], table: string, candidates: string[]): string | null {
  const t = table.toUpperCase();
  for (const cand of candidates) {
    const hit = cols.find(
      (c) => c.TABLE_NAME.toUpperCase() === t && c.COLUMN_NAME.toUpperCase() === cand.toUpperCase(),
    );
    if (hit) {
      return hit.COLUMN_NAME;
    }
  }
  return null;
}

/**
 * 수출반품: `_TSLInvoice.UMOutKind` 이 `_TDAUMinorValue` 의 **MinorSeq** 와 일치하고,
 * `MajorSeq = 8020`, `Serl = 2002`, `ValueText` trim = `'1'` 인 행만(엑셀·ERP「수출반품」구분).
 * `CAST(h.UMOutKind AS NVARCHAR(50)) IN (SELECT CAST(m.MinorSeq AS NVARCHAR(50)) FROM …)`.
 */
function buildExportReturnUmOutKindSql(cols: ColMeta[], set: Set<string>): string {
  const umOutKindCol = pickCol(cols, '_TSLInvoice', ['UMOutKind', 'UMOUTKIND']);
  if (!umOutKindCol || !hasCol(set, '_TSLInvoice', umOutKindCol)) {
    throw new BadRequestException(
      '_TSLInvoice 테이블에 UMOutKind 컬럼을 찾지 못했습니다. 수출반품 UMOutKind 필터를 적용할 수 없습니다.',
    );
  }
  const mvMajor = pickCol(cols, '_TDAUMinorValue', ['MajorSeq', 'MAJORSEQ']);
  const mvSerl = pickCol(cols, '_TDAUMinorValue', ['Serl', 'SERL']);
  const mvMinor = pickCol(cols, '_TDAUMinorValue', ['MinorSeq', 'MINORSEQ']);
  const mvVt = pickCol(cols, '_TDAUMinorValue', ['ValueText', 'VALUETEXT']);
  if (!mvMajor || !mvSerl || !mvMinor || !mvVt) {
    throw new BadRequestException(
      '_TDAUMinorValue 에서 MajorSeq·Serl·MinorSeq·ValueText 컬럼을 찾지 못했습니다. 수출반품 UMOutKind 필터를 적용할 수 없습니다.',
    );
  }
  const mvComp = hasCol(set, '_TDAUMinorValue', 'CompanySeq') ? 'AND (m.CompanySeq = h.CompanySeq OR m.CompanySeq IS NULL)' : '';
  const vtEsc = EXPORT_RETURN_UM_OUT_MV_VALUE_TEXT.replace(/'/g, "''");
  return `CAST(h.[${umOutKindCol}] AS NVARCHAR(50)) IN (
    SELECT CAST(m.[${mvMinor}] AS NVARCHAR(50))
    FROM dbo.[_TDAUMinorValue] m
    WHERE m.[${mvMajor}] = ${EXPORT_RETURN_UM_OUT_MV_MAJOR}
      AND m.[${mvSerl}] = ${EXPORT_RETURN_UM_OUT_MV_SERL}
      AND LTRIM(RTRIM(CAST(m.[${mvVt}] AS NVARCHAR(200)))) = N'${vtEsc}'
      ${mvComp}
  )`;
}

/** 수출반품 WHERE: UMOutKind Minor 매칭을 쓰지 않을 때만 `(1=1)` (디버그용 `ERP_TSL_EXPORT_RETURN_SKIP_UM_OUT_KIND_FILTER`). */
function buildExportReturnUmOutKindWhereSql(cols: ColMeta[], set: Set<string>, skip: boolean): string {
  if (skip) {
    return '(1=1)';
  }
  return buildExportReturnUmOutKindSql(cols, set);
}

/**
 * 수출반품: **`_TSLInvoice` 헤더** `SMExpKind` = `@exportReturnSmExpKind` (`8009019`, 문자·BIGINT 비교).
 * `_TSLInvoiceItem` 은 사용하지 않음. `skip`이면 `(1=1)`.
 */
function buildExportReturnSmExpKindHeaderParamSql(cols: ColMeta[], set: Set<string>, skip: boolean): string {
  if (skip) {
    return '(1=1)';
  }
  const smCol = hasCol(set, '_TSLInvoice', 'SMExpKind')
    ? 'SMExpKind'
    : pickCol(cols, '_TSLInvoice', [
        'SMExpKind',
        'SMExpKindSeq',
        'SMEXPKIND',
        'ExpKind',
        'SMExportKind',
        'ExportExpKind',
      ]);
  if (!smCol || !hasCol(set, '_TSLInvoice', smCol)) {
    return '(1=0)';
  }
  const hVal = `NULLIF(LTRIM(RTRIM(CAST(h.[${smCol}] AS NVARCHAR(50)))), N'')`;
  return `((${hVal} = @exportReturnSmExpKind) OR (TRY_CONVERT(BIGINT, ${hVal}) = TRY_CONVERT(BIGINT, @exportReturnSmExpKind)))`;
}

/** 수출반품: 음수 Qty 또는 음수 금액 컬럼이 하나라도 있으면 반품 라인으로 본다(ERP·엑셀 불일치 완화). */
function buildExportReturnLineCreditPredicate(cols: ColMeta[], set: Set<string>): string {
  const bits: string[] = [];
  const qtyCol = pickCol(cols, '_TSLInvoiceItem', [
    'Qty',
    'InvoiceQty',
    'OrderQty',
    'ShipQty',
    'OutQty',
    'ItemQty',
  ]);
  if (qtyCol && hasCol(set, '_TSLInvoiceItem', qtyCol)) {
    bits.push(`TRY_CAST(i.[${qtyCol}] AS decimal(18, 6)) < 0`);
  }
  const amtGroups = [
    ['DomAmt', 'DomAmount', 'DomSupplyAmt'],
    ['CurAmt', 'CurAmount', 'ForeignAmt', 'FCurAmt'],
    ['SupplyAmt', 'SplyAmt', 'SupplyAmount'],
    ['NetAmt', 'NetAmount'],
    ['DomVAT', 'DomVat', 'VAT', 'VATAmt', 'DomVATAmt'],
  ];
  for (const g of amtGroups) {
    const ac = pickCol(cols, '_TSLInvoiceItem', g);
    if (ac && hasCol(set, '_TSLInvoiceItem', ac)) {
      bits.push(`TRY_CAST(ISNULL(i.[${ac}], 0) AS decimal(18, 6)) < 0`);
    }
  }
  if (bits.length === 0) {
    throw new BadRequestException(
      '수출반품: _TSLInvoiceItem 에서 음수 반품을 판별할 Qty·DomAmt·CurAmt 등 컬럼을 찾지 못했습니다.',
    );
  }
  return `(${bits.join(' OR ')})`;
}

function nvarcharH(
  cols: ColMeta[],
  set: Set<string>,
  hCands: string[],
  alias: string,
  len: number,
): string {
  const h = pickCol(cols, '_TSLInvoice', hCands);
  if (h && hasCol(set, '_TSLInvoice', h)) {
    return `LTRIM(RTRIM(CAST(h.[${h}] AS NVARCHAR(${len})))) AS ${alias}`;
  }
  return `CAST(NULL AS nvarchar(${len})) AS ${alias}`;
}

function nvarcharHi(
  cols: ColMeta[],
  set: Set<string>,
  hCands: string[],
  iCands: string[],
  alias: string,
  len: number,
): string {
  const h = pickCol(cols, '_TSLInvoice', hCands);
  if (h && hasCol(set, '_TSLInvoice', h)) {
    return `LTRIM(RTRIM(CAST(h.[${h}] AS NVARCHAR(${len})))) AS ${alias}`;
  }
  const i = pickCol(cols, '_TSLInvoiceItem', iCands);
  if (i && hasCol(set, '_TSLInvoiceItem', i)) {
    return `LTRIM(RTRIM(CAST(i.[${i}] AS NVARCHAR(${len})))) AS ${alias}`;
  }
  return `CAST(NULL AS nvarchar(${len})) AS ${alias}`;
}

function nvarcharHs(cols: ColMeta[], set: Set<string>, alias: string): string {
  const itc = pickCol(cols, '_TDAItem', ['HSCode', 'HSNo', 'HS_No', 'ExportHSCode', 'CommodityCode', 'HSCodeNo']);
  if (itc && hasCol(set, '_TDAItem', itc)) {
    return `LTRIM(RTRIM(CAST(it.[${itc}] AS NVARCHAR(120)))) AS ${alias}`;
  }
  return nvarcharHi(
    cols,
    set,
    ['HSCode', 'HSNo', 'HS_No', 'ExportHSCode'],
    ['HSCode', 'HSNo', 'HS_No', 'ItemHSCode'],
    alias,
    120,
  );
}

function decimalHi(
  cols: ColMeta[],
  set: Set<string>,
  hCands: string[],
  iCands: string[],
  alias: string,
): string {
  const h = pickCol(cols, '_TSLInvoice', hCands);
  if (h && hasCol(set, '_TSLInvoice', h)) {
    return `TRY_CAST(h.[${h}] AS decimal(18, 4)) AS ${alias}`;
  }
  const i = pickCol(cols, '_TSLInvoiceItem', iCands);
  if (i && hasCol(set, '_TSLInvoiceItem', i)) {
    return `TRY_CAST(i.[${i}] AS decimal(18, 4)) AS ${alias}`;
  }
  return `CAST(NULL AS decimal(18, 4)) AS ${alias}`;
}

function buildInvoiceLineSqlCore(cols: ColMeta[], set: Set<string>): InvoiceCoreFragments {
  const lineRemarkSelect = hasCol(set, '_TSLInvoiceItem', 'Remark')
    ? 'i.Remark AS LineRemark'
    : hasCol(set, '_TSLInvoiceItem', 'LineRemark')
      ? 'i.LineRemark AS LineRemark'
      : 'CAST(NULL AS nvarchar(max)) AS LineRemark';
  const lineMemoSelect = hasCol(set, '_TSLInvoiceItem', 'Memo')
    ? 'i.Memo AS LineMemo'
    : 'CAST(NULL AS nvarchar(max)) AS LineMemo';

  const priceBits: string[] = [];
  if (hasCol(set, '_TSLInvoiceItem', 'CustPrice')) {
    priceBits.push('NULLIF(i.CustPrice, 0)');
  }
  if (hasCol(set, '_TSLInvoiceItem', 'ItemPrice')) {
    priceBits.push('NULLIF(i.ItemPrice, 0)');
  }
  if (hasCol(set, '_TSLInvoiceItem', 'Price')) {
    priceBits.push('i.Price');
  }
  let lineUnitPriceExpr: string;
  if (priceBits.length === 0) {
    lineUnitPriceExpr = 'CAST(NULL AS decimal(18, 4))';
  } else if (priceBits.length === 1) {
    lineUnitPriceExpr = priceBits[0];
  } else {
    lineUnitPriceExpr = `COALESCE(${priceBits.join(', ')})`;
  }

  const currNameSelect = hasCol(set, '_TDACurr', 'CurrName')
    ? 'curr.CurrName AS CurrName'
    : 'CAST(NULL AS nvarchar(100)) AS CurrName';
  const currNoSelect = hasCol(set, '_TDACurr', 'CurrNo')
    ? 'curr.CurrNo AS CurrNo'
    : 'CAST(NULL AS nvarchar(50)) AS CurrNo';

  /** 수출 구분: 헤더·라인 중 한쪽만 SMExpKind 가 있는 ERP도 지원(기존엔 헤더 없으면 0건) */
  const smHdr = hasCol(set, '_TSLInvoice', 'SMExpKind');
  const smLn = hasCol(set, '_TSLInvoiceItem', 'SMExpKind');
  const hVal = 'NULLIF(LTRIM(RTRIM(CAST(h.SMExpKind AS NVARCHAR(50)))), N\'\')';
  const iVal = 'NULLIF(LTRIM(RTRIM(CAST(i.SMExpKind AS NVARCHAR(50)))), N\'\')';
  const smIncludePredicate =
    !smHdr && !smLn
      ? '(1 = 0)'
      : smHdr && !smLn
        ? `(${hVal} = @includeSmExpKind)`
        : !smHdr && smLn
          ? `(${iVal} = @includeSmExpKind)`
          : `(${hVal} = @includeSmExpKind OR ${iVal} = @includeSmExpKind)`;

  return {
    lineRemarkSelect,
    lineMemoSelect,
    lineUnitPriceExpr,
    currNameSelect,
    currNoSelect,
    smIncludePredicate,
  };
}

function buildExportExtras(cols: ColMeta[], set: Set<string>): ExportExtraFragments {
  const smHdr = hasCol(set, '_TSLInvoice', 'SMExpKind');
  const smLn = hasCol(set, '_TSLInvoiceItem', 'SMExpKind');
  const smExp =
    smHdr && smLn
      ? `LTRIM(RTRIM(CAST(COALESCE(
          NULLIF(LTRIM(RTRIM(CAST(h.SMExpKind AS NVARCHAR(50)))), N''),
          NULLIF(LTRIM(RTRIM(CAST(i.SMExpKind AS NVARCHAR(50)))), N'')
        ) AS NVARCHAR(50)))) AS SMExpKindText`
      : smHdr
        ? `LTRIM(RTRIM(CAST(h.SMExpKind AS NVARCHAR(50)))) AS SMExpKindText`
        : smLn
          ? `LTRIM(RTRIM(CAST(i.SMExpKind AS NVARCHAR(50)))) AS SMExpKindText`
          : `CAST(NULL AS nvarchar(50)) AS SMExpKindText`;

  return {
    categoryStr: nvarcharHi(
      cols,
      set,
      ['SlipDiv', 'DocDiv', 'InvoiceDiv', 'TSLDivKind', 'SMOutKind', 'WorkKind', 'InvoiceKind', 'SlipKind', 'OutKind'],
      ['LineDiv', 'ItemDiv', 'SlipLineDiv', 'DVSerlKind'],
      'CategoryStr',
      200,
    ),
    shipDateRaw: nvarcharHi(
      cols,
      set,
      [
        'ShipDate',
        'ShipmentDate',
        'OnBoardDate',
        'ExportShipDate',
        'ShipYMD',
        'LoadDate',
        'LadeDate',
        'SailingDate',
        'ShpDate',
      ],
      ['ShipDate', 'ShipmentDate', 'LineShipDate'],
      'ShipDateRaw',
      30,
    ),
    portLoading: nvarcharHi(
      cols,
      set,
      [
        'POL',
        'PortOfLoading',
        'LoadingPort',
        'ShipFromPort',
        'DeparturePort',
        'LoadPort',
        'POLName',
        'PortLoadingName',
        'ShipPort',
        'FromPort',
      ],
      ['POL', 'LoadingPort', 'PortOfLoading'],
      'PortLoading',
      400,
    ),
    destination: nvarcharHi(
      cols,
      set,
      [
        'POD',
        'Destination',
        'ArrivalPort',
        'DischargePort',
        'ToPort',
        'DestPort',
        'PODName',
        'DestName',
        'DeliveryPort',
      ],
      ['POD', 'Destination', 'ArrivalPort'],
      'Destination',
      400,
    ),
    incoterms: nvarcharHi(
      cols,
      set,
      ['Incoterms', 'INCOTERMS', 'IncotermsCode', 'TradeTerm', 'DeliveryTerm', 'IncoTerm', 'Incoterm'],
      ['Incoterms', 'IncotermsCode'],
      'Incoterms',
      120,
    ),
    paymentTerms: nvarcharH(
      cols,
      set,
      ['PayTerm', 'PaymentTerm', 'SettlementTerm', 'PayCond', 'PaymentCond', 'TermsOfPayment', 'PaymentTerms'],
      'PaymentTerms',
      400,
    ),
    hsCode: nvarcharHs(cols, set, 'HSCode'),
    originCountry: nvarcharHi(
      cols,
      set,
      ['OriginCountry', 'COO', 'CountryOrigin', 'OriCountry', 'Origin', 'MadeIn', 'CountryOfOrigin'],
      ['OriginCountry', 'COO', 'CountryOrigin'],
      'OriginCountry',
      200,
    ),
    netWeight: decimalHi(
      cols,
      set,
      ['NetWeight', 'NetWt', 'NW', 'ExpNetWeight', 'NetWgt', 'NWeight'],
      ['NetWeight', 'NetWt', 'NW', 'LineNetWeight'],
      'NetWeight',
    ),
    grossWeight: decimalHi(
      cols,
      set,
      ['GrossWeight', 'GrossWt', 'GW', 'ExpGrossWeight', 'GrossWgt', 'GWeight'],
      ['GrossWeight', 'GrossWt', 'GW', 'LineGrossWeight'],
      'GrossWeight',
    ),
    measurement: nvarcharHi(
      cols,
      set,
      ['Measurement', 'Meas', 'CBM', 'VolumeMeas', 'Measure', 'M3', 'Volume'],
      ['Measurement', 'Meas', 'CBM'],
      'Measurement',
      200,
    ),
    cartonNo: nvarcharHi(
      cols,
      set,
      ['CartonNo', 'CTNNo', 'Carton', 'CartonNumber', 'CTN'],
      ['CartonNo', 'CTNNo', 'Carton'],
      'CartonNo',
      200,
    ),
    exportDeclNo: nvarcharH(
      cols,
      set,
      ['ExportDeclNo', 'CLPDeclNo', 'CustomsDeclNo', 'XDeclNo', 'eDANo', 'DeclNo', 'ExportNo', 'CUSDECNo'],
      'ExportDeclNo',
      200,
    ),
    exportDeclDateRaw: nvarcharH(
      cols,
      set,
      ['ExportDeclDate', 'DeclDate', 'CLPDeclDate', 'CustomsDeclDate', 'DeclYMD'],
      'ExportDeclDateRaw',
      30,
    ),
    licenseNo: nvarcharH(
      cols,
      set,
      ['LicenseNo', 'PermitNo', 'QuotaNo', 'ExportLicenseNo', 'LicNo', 'PermitNumber'],
      'LicenseNo',
      200,
    ),
    licenseDateRaw: nvarcharH(
      cols,
      set,
      ['LicenseDate', 'PermitDate', 'LicDate', 'LicenseYMD'],
      'LicenseDateRaw',
      30,
    ),
    lcNo: nvarcharH(cols, set, ['LCNo', 'LC_No', 'LCNumber', 'LCCNo', 'CreditNo'], 'LCNo', 120),
    blNo: nvarcharH(cols, set, ['BLNo', 'BL_No', 'BLNumber', 'HBLNo', 'MBLNo', 'BillOfLadingNo'], 'BLNo', 120),
    vesselName: nvarcharH(
      cols,
      set,
      ['VesselName', 'ShipName', 'Vessel', 'CarrierName', 'VslName', 'ShipNm'],
      'VesselName',
      200,
    ),
    voyageNo: nvarcharH(cols, set, ['VoyageNo', 'VoyNo', 'Voy', 'Voyage', 'VoyNum'], 'VoyageNo', 80),
    etdRaw: nvarcharH(cols, set, ['ETD', 'ETDDate', 'ETDYMD', 'ETDTime', 'ExpectDeparture'], 'ETDRaw', 30),
    etaRaw: nvarcharH(cols, set, ['ETA', 'ETADate', 'ETAYMD', 'ETATime', 'ExpectArrival'], 'ETARaw', 30),
    transportMeans: nvarcharH(
      cols,
      set,
      ['TransportMeans', 'TransMode', 'TransKind', 'MeansOfTransport', 'ShipType', 'TransportType'],
      'TransportMeans',
      200,
    ),
    packMethod: nvarcharHi(
      cols,
      set,
      ['PackMethod', 'PackingMethod', 'PackType', 'PackingType', 'PkgMethod', 'PackingWay'],
      ['PackMethod', 'PackingMethod', 'PackType'],
      'PackMethod',
      200,
    ),
    packQty: decimalHi(
      cols,
      set,
      ['PackQty', 'PackingQty', 'PkgQty', 'PackageQty', 'PackCount'],
      ['PackQty', 'PackingQty', 'PkgQty'],
      'PackQty',
    ),
    packUnit: nvarcharHi(
      cols,
      set,
      ['PackUnit', 'PackingUnit', 'PkgUnit', 'PackageUnit'],
      ['PackUnit', 'PackingUnit', 'PkgUnit'],
      'PackUnit',
      80,
    ),
    smExpKindText: smExp,
  };
}

@Injectable()
export class ErpTslExportInvoiceItemsService {
  private readonly logger = new Logger(ErpTslExportInvoiceItemsService.name);
  private pool: mssql.ConnectionPool | null = null;
  private poolPromise: Promise<mssql.ConnectionPool> | null = null;
  private queryParts: TslExportInvoiceQueryParts | null = null;
  /** `ensureQueryParts` 시점의 컬럼 메타(수출반품 조회 등에서 재사용) */
  private colMetaRows: ColMeta[] = [];
  private colMetaSet: Set<string> = new Set();

  constructor(private readonly config: ConfigService) {}

  private getPool(): Promise<mssql.ConnectionPool> {
    if (this.pool?.connected) {
      return Promise.resolve(this.pool);
    }
    if (this.poolPromise) {
      return this.poolPromise;
    }

    const host = this.config.get<string>('ERP_MSSQL_HOST');
    const port = Number(this.config.get<string>('ERP_MSSQL_PORT') ?? 1433);
    const database = this.config.get<string>('ERP_MSSQL_DATABASE');
    const user = this.config.get<string>('ERP_MSSQL_USER');
    const password = this.config.get<string>('ERP_MSSQL_PASSWORD');

    if (!host || !database || !user || !password) {
      return Promise.reject(
        new ServiceUnavailableException(
          'ERP MSSQL 연결 설정이 없습니다. ERP_MSSQL_* 환경 변수를 확인하세요.',
        ),
      );
    }

    const encrypt = this.config.get<string>('ERP_MSSQL_ENCRYPT') === 'true';
    const trustServerCertificate =
      this.config.get<string>('ERP_MSSQL_TRUST_SERVER_CERT') !== 'false';

    this.poolPromise = (async () => {
      const pool = new mssql.ConnectionPool({
        server: host,
        port,
        database,
        user,
        password,
        options: {
          encrypt,
          trustServerCertificate,
        },
        connectionTimeout: 30_000,
        requestTimeout: 120_000,
      });
      await pool.connect();
      this.pool = pool;
      this.logger.log(`ERP MSSQL connected (export invoice) (${host}:${port}/${database})`);
      return pool;
    })().catch((err) => {
      this.poolPromise = null;
      this.pool = null;
      this.queryParts = null;
      this.colMetaRows = [];
      this.colMetaSet = new Set();
      this.logger.error('ERP MSSQL connection failed (export invoice)', err);
      throw new ServiceUnavailableException(
        'ERP 데이터베이스에 연결할 수 없습니다. 네트워크 및 접속 정보를 확인하세요.',
      );
    });

    return this.poolPromise;
  }

  private async ensureQueryParts(pool: mssql.ConnectionPool): Promise<TslExportInvoiceQueryParts> {
    if (this.queryParts) {
      return this.queryParts;
    }
    const meta = await pool.request().query<ColMeta>(`
      SELECT c.TABLE_NAME AS TABLE_NAME, c.COLUMN_NAME AS COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_SCHEMA = N'dbo'
        AND c.TABLE_NAME IN (N'_TSLInvoice', N'_TSLInvoiceItem', N'_TDACurr', N'_TDAItem', N'_TDAWH', N'_TDAEmp', N'_TDABizUnit', N'_TDAUMinorValue', N'_TDADept')
    `);
    const rows = meta.recordset ?? [];
    this.colMetaRows = rows;
    this.colMetaSet = new Set(rows.map((c) => `${c.TABLE_NAME.toUpperCase()}|${c.COLUMN_NAME.toUpperCase()}`));
    const set = this.colMetaSet;
    const core = buildInvoiceLineSqlCore(rows, set);
    const ex = buildExportExtras(rows, set);
    this.queryParts = { ...core, ...ex } satisfies TslExportInvoiceQueryParts;
    this.logger.log(
      `TSL export invoice SQL plan resolved (SMExpKind: _TSLInvoice=${hasCol(set, '_TSLInvoice', 'SMExpKind')} _TSLInvoiceItem=${hasCol(set, '_TSLInvoiceItem', 'SMExpKind')})`,
    );
    return this.queryParts;
  }

  private parseOptionalPositiveInt(envKey: string, label: string): number | null {
    const raw = this.config.get<string>(envKey)?.trim();
    if (!raw) {
      return null;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      throw new BadRequestException(`${label}은(는) 0 이상의 정수여야 합니다.`);
    }
    return n;
  }

  /** `ERP_TSL_EXPORT_RETURN_SKIP_UM_OUT_KIND_FILTER=true` 이면 수출반품에서 UMOutKind·MinorSeq(8020·2002·`1`) 조건 생략(일자·음수 반품만). */
  private exportReturnSkipUmOutKindFilter(): boolean {
    const v = (this.config.get<string>('ERP_TSL_EXPORT_RETURN_SKIP_UM_OUT_KIND_FILTER') ?? '').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  /** `ERP_TSL_EXPORT_RETURN_SKIP_SM_EXP_KIND_FILTER=true` 이면 수출반품에서 헤더 `SMExpKind` = `8009019` 조건 생략. */
  private exportReturnSkipSmExpKindFilter(): boolean {
    const v = (this.config.get<string>('ERP_TSL_EXPORT_RETURN_SKIP_SM_EXP_KIND_FILTER') ?? '').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  /**
   * 수출 Invoice 일자 구간 품목 라인 (`SMExpKind` = 8009004, 헤더 또는 품목라인 컬럼).
   * 법인·사업장은 국내 거래명세와 동일하게 `ERP_TSL_INVOICE_*` 를 사용합니다.
   */
  async listExportByInvoiceDateRange(
    fromIso: string,
    toIso: string,
    limit?: number,
  ): Promise<{ items: TslExportInvoiceItemRow[]; truncated: boolean }> {
    const parseLocal = (s: string): Date | null => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
      if (!m) return null;
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      const dt = new Date(y, mo - 1, d);
      if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
        return null;
      }
      return dt;
    };

    const from = parseLocal(fromIso);
    const to = parseLocal(toIso);
    if (!from || !to) {
      throw new BadRequestException('유효하지 않은 날짜입니다.');
    }
    if (from > to) {
      throw new BadRequestException('시작일이 종료일보다 늦을 수 없습니다.');
    }
    const rangeMs = to.getTime() - from.getTime();
    if (rangeMs > MAX_RANGE_DAYS * 86400_000) {
      throw new BadRequestException(`조회 기간은 최대 ${MAX_RANGE_DAYS}일까지 가능합니다.`);
    }

    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}${m}${day}`;
    };
    const fromYmd = fmt(from);
    const toYmd = fmt(to);

    const maxRows = Math.min(limit ?? DEFAULT_LIMIT, 10_000);
    const fetchCount = maxRows + 1;

    const companySeq = this.parseOptionalPositiveInt(
      'ERP_TSL_INVOICE_COMPANY_SEQ',
      'ERP_TSL_INVOICE_COMPANY_SEQ',
    );
    const bizUnitFilter = this.parseOptionalPositiveInt('ERP_TSL_INVOICE_BIZ_UNIT', 'ERP_TSL_INVOICE_BIZ_UNIT');

    const pool = await this.getPool();
    const q = await this.ensureQueryParts(pool);
    const request = pool.request();
    request.input('fromYmd', mssql.Char(8), fromYmd);
    request.input('toYmd', mssql.Char(8), toYmd);
    request.input('fetchCount', mssql.Int, fetchCount);
    request.input('includeSmExpKind', mssql.NVarChar(32), INCLUDED_SM_EXP_KIND);
    if (companySeq != null) {
      request.input('companySeq', mssql.Int, companySeq);
    }
    if (bizUnitFilter != null) {
      request.input('bizUnitFilter', mssql.Int, bizUnitFilter);
    }

    const whereExtra: string[] = [];
    if (companySeq != null) {
      whereExtra.push('h.CompanySeq = @companySeq');
    }
    if (bizUnitFilter != null) {
      whereExtra.push('h.BizUnit = @bizUnitFilter');
    }
    const whereTail = whereExtra.length ? ` AND ${whereExtra.join(' AND ')}` : '';

    let result: mssql.IResult<SqlRow>;
    try {
      result = await request.query<SqlRow>(`
      SELECT TOP (@fetchCount)
        ${q.categoryStr},
        CASE
          WHEN LEN(LTRIM(RTRIM(h.InvoiceNo))) = 10 AND LTRIM(RTRIM(h.InvoiceNo)) NOT LIKE N'%-%'
            THEN LEFT(LTRIM(RTRIM(h.InvoiceNo)), 6) + N'-' + SUBSTRING(LTRIM(RTRIM(h.InvoiceNo)), 7, 20)
          ELSE LTRIM(RTRIM(h.InvoiceNo))
        END AS InvoiceNoFmt,
        LTRIM(RTRIM(h.InvoiceDate)) AS InvoiceDateRaw,
        LTRIM(RTRIM(ISNULL(c.CustNo, N''))) +
          CASE WHEN LTRIM(RTRIM(ISNULL(c.CustNo, N''))) <> N'' AND LTRIM(RTRIM(ISNULL(c.CustName, N''))) <> N'' THEN N' ' ELSE N'' END +
          LTRIM(RTRIM(ISNULL(c.CustName, N''))) AS CustDisplay,
        it.ItemNo AS ItemNo,
        it.ItemName AS ItemName,
        it.Spec AS Spec,
        u.UnitName AS UnitName,
        i.Qty AS Qty,
        ${q.lineUnitPriceExpr} AS LineUnitPrice,
        i.DomAmt AS DomAmt,
        i.CurAmt AS CurAmt,
        ${q.lineRemarkSelect},
        ${q.lineMemoSelect},
        ${q.smExpKindText},
        ${q.shipDateRaw},
        ${q.portLoading},
        ${q.destination},
        ${q.incoterms},
        ${q.paymentTerms},
        ${q.currNameSelect},
        ${q.currNoSelect},
        h.ExRate AS ExRate,
        ${q.hsCode},
        ${q.originCountry},
        ${q.netWeight},
        ${q.grossWeight},
        ${q.measurement},
        ${q.cartonNo},
        ${q.exportDeclNo},
        ${q.exportDeclDateRaw},
        ${q.licenseNo},
        ${q.licenseDateRaw},
        ${q.lcNo},
        ${q.blNo},
        ${q.vesselName},
        ${q.voyageNo},
        ${q.etdRaw},
        ${q.etaRaw},
        ${q.transportMeans},
        ${q.packMethod},
        ${q.packQty},
        ${q.packUnit},
        pjt.PJTNo AS PJTNo,
        pjt.PJTName AS PJTName,
        h.BizUnit AS BizUnit
      FROM dbo.[_TSLInvoice] h
      INNER JOIN dbo.[_TSLInvoiceItem] i
        ON h.CompanySeq = i.CompanySeq AND h.InvoiceSeq = i.InvoiceSeq
      LEFT JOIN dbo.[_TDACust] c
        ON h.CompanySeq = c.CompanySeq AND h.CustSeq = c.CustSeq
      LEFT JOIN dbo.[_TDAItem] it
        ON h.CompanySeq = it.CompanySeq AND i.ItemSeq = it.ItemSeq
      LEFT JOIN dbo.[_TDAUnit] u
        ON h.CompanySeq = u.CompanySeq
        AND u.UnitSeq = COALESCE(NULLIF(i.UnitSeq, 0), it.UnitSeq)
      LEFT JOIN dbo.[_TPJTProject] pjt
        ON h.CompanySeq = pjt.CompanySeq AND i.PJTSeq = pjt.PJTSeq
      LEFT JOIN dbo.[_TDACurr] curr
        ON h.CompanySeq = curr.CompanySeq AND h.CurrSeq = curr.CurrSeq
      WHERE LTRIM(RTRIM(h.InvoiceDate)) >= @fromYmd
        AND LTRIM(RTRIM(h.InvoiceDate)) <= @toYmd
        AND ${q.smIncludePredicate}
        ${whereTail}
      ORDER BY LTRIM(RTRIM(h.InvoiceDate)) ASC, h.CompanySeq ASC, h.InvoiceSeq ASC, i.InvoiceSerl ASC
    `);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`TSL export invoice items query failed: ${msg}`);
      throw new BadRequestException(`ERP 수출 Invoice 품목 조회에 실패했습니다. (${msg})`);
    }

    const raw = result.recordset ?? [];
    const truncated = raw.length > maxRows;
    const slice = truncated ? raw.slice(0, maxRows) : raw;
    return {
      items: slice.map((r, i) => ({ ...mapRow(r), rowNo: i + 1 })),
      truncated,
    };
  }

  /**
   * 수출 반품 품목 — ERP「수출반품품목조회」·엑셀 `수출반품품목조회_*.xlsx` 와 맞춤
   * - 일자: 헤더 `InvoiceDate` 구간
   * - 반품 라인: `Qty` 또는 `DomAmt`·`CurAmt`·`SupplyAmt` 등 존재하는 금액 컬럼 중 **하나라도 음수**
   * - **수출반품 구분**: `_TSLInvoice.UMOutKind` = `_TDAUMinorValue.MinorSeq` 이고 `MajorSeq = 8020`, `Serl = 2002`, `ValueText` trim = `'1'` (반품요청·`_TSLDVReq` 와 동일 규칙). `ERP_TSL_EXPORT_RETURN_SKIP_UM_OUT_KIND_FILTER=true` 이면 생략
   * - **`SMExpKind`**: **`_TSLInvoice` 헤더만** `8009019` (`@exportReturnSmExpKind`). `ERP_TSL_EXPORT_RETURN_SKIP_SM_EXP_KIND_FILTER=true` 이면 생략
   */
  async listExportReturnByInvoiceDateRange(
    fromIso: string,
    toIso: string,
    limit?: number,
  ): Promise<{ items: TslExportReturnInvoiceItemRow[]; truncated: boolean }> {
    const parseLocal = (s: string): Date | null => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
      if (!m) return null;
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      const dt = new Date(y, mo - 1, d);
      if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
        return null;
      }
      return dt;
    };

    const from = parseLocal(fromIso);
    const to = parseLocal(toIso);
    if (!from || !to) {
      throw new BadRequestException('유효하지 않은 날짜입니다.');
    }
    if (from > to) {
      throw new BadRequestException('시작일이 종료일보다 늦을 수 없습니다.');
    }
    const rangeMs = to.getTime() - from.getTime();
    if (rangeMs > MAX_RANGE_DAYS * 86400_000) {
      throw new BadRequestException(`조회 기간은 최대 ${MAX_RANGE_DAYS}일까지 가능합니다.`);
    }

    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}${m}${day}`;
    };
    const fromYmd = fmt(from);
    const toYmd = fmt(to);

    const maxRows = Math.min(limit ?? DEFAULT_LIMIT, 10_000);
    const fetchCount = maxRows + 1;

    const companySeq = this.parseOptionalPositiveInt(
      'ERP_TSL_INVOICE_COMPANY_SEQ',
      'ERP_TSL_INVOICE_COMPANY_SEQ',
    );
    const bizUnitFilter = this.parseOptionalPositiveInt('ERP_TSL_INVOICE_BIZ_UNIT', 'ERP_TSL_INVOICE_BIZ_UNIT');

    const pool = await this.getPool();
    const q = await this.ensureQueryParts(pool);
    const rp = buildExportReturnSqlParts(this.colMetaRows, this.colMetaSet);
    const umSkip = this.exportReturnSkipUmOutKindFilter();
    const umOutKindSql = buildExportReturnUmOutKindWhereSql(this.colMetaRows, this.colMetaSet, umSkip);
    const smSkip = this.exportReturnSkipSmExpKindFilter();
    const smReturnSql = buildExportReturnSmExpKindHeaderParamSql(this.colMetaRows, this.colMetaSet, smSkip);
    this.logger.log(
      `TSL export return SQL: UMOutKind∈MinorSeq(8020/2002/ValueText=1) umSkip=${umSkip} SMExpKind=${EXPORT_RETURN_SM_EXP_KIND} smSkip=${smSkip}`,
    );
    const request = pool.request();
    request.input('fromYmd', mssql.Char(8), fromYmd);
    request.input('toYmd', mssql.Char(8), toYmd);
    request.input('fetchCount', mssql.Int, fetchCount);
    if (!smSkip) {
      request.input('exportReturnSmExpKind', mssql.NVarChar(32), EXPORT_RETURN_SM_EXP_KIND);
    }
    if (companySeq != null) {
      request.input('companySeq', mssql.Int, companySeq);
    }
    if (bizUnitFilter != null) {
      request.input('bizUnitFilter', mssql.Int, bizUnitFilter);
    }

    const whereExtra: string[] = [];
    if (companySeq != null) {
      whereExtra.push('h.CompanySeq = @companySeq');
    }
    if (bizUnitFilter != null) {
      whereExtra.push('h.BizUnit = @bizUnitFilter');
    }
    const whereTail = whereExtra.length ? ` AND ${whereExtra.join(' AND ')}` : '';

    const lineCreditSql = buildExportReturnLineCreditPredicate(this.colMetaRows, this.colMetaSet);

    let result: mssql.IResult<SqlReturnRow>;
    try {
      result = await request.query<SqlReturnRow>(`
      SELECT TOP (@fetchCount)
        ${rp.statusSelect},
        ${rp.bizNameSelect},
        CASE
          WHEN LEN(LTRIM(RTRIM(h.InvoiceNo))) = 10 AND LTRIM(RTRIM(h.InvoiceNo)) NOT LIKE N'%-%'
            THEN LEFT(LTRIM(RTRIM(h.InvoiceNo)), 6) + N'-' + SUBSTRING(LTRIM(RTRIM(h.InvoiceNo)), 7, 20)
          ELSE LTRIM(RTRIM(h.InvoiceNo))
        END AS InvoiceNoFmt,
        LTRIM(RTRIM(h.InvoiceDate)) AS InvoiceDateRaw,
        LTRIM(RTRIM(ISNULL(c.CustNo, N''))) AS CustNo,
        LTRIM(RTRIM(ISNULL(c.CustName, N''))) AS CustName,
        it.ItemNo AS ItemNo,
        it.ItemName AS ItemName,
        it.Spec AS Spec,
        u.UnitName AS UnitName,
        i.Qty AS Qty,
        ${q.lineUnitPriceExpr} AS LineUnitPrice,
        i.DomAmt AS DomAmt,
        i.CurAmt AS CurAmt,
        ${rp.domVatSelect},
        ${rp.lineTotalSelect},
        ${q.lineRemarkSelect},
        ${q.lineMemoSelect},
        ${q.smExpKindText},
        ${q.currNameSelect},
        ${q.currNoSelect},
        h.ExRate AS ExRate,
        ${q.exportDeclNo},
        ${rp.whNameExpr},
        ${rp.empSelect},
        ${rp.lotSelect},
        CAST(NULL AS nvarchar(30)) AS CategoryStr,
        CAST(NULL AS nvarchar(30)) AS ShipDateRaw,
        CAST(NULL AS nvarchar(30)) AS PortLoading,
        CAST(NULL AS nvarchar(30)) AS Destination,
        CAST(NULL AS nvarchar(30)) AS Incoterms,
        CAST(NULL AS nvarchar(30)) AS PaymentTerms,
        CAST(NULL AS nvarchar(30)) AS HSCode,
        CAST(NULL AS nvarchar(30)) AS OriginCountry,
        CAST(NULL AS decimal(18, 4)) AS NetWeight,
        CAST(NULL AS decimal(18, 4)) AS GrossWeight,
        CAST(NULL AS nvarchar(30)) AS Measurement,
        CAST(NULL AS nvarchar(30)) AS CartonNo,
        CAST(NULL AS nvarchar(30)) AS ExportDeclDateRaw,
        CAST(NULL AS nvarchar(30)) AS LicenseNo,
        CAST(NULL AS nvarchar(30)) AS LicenseDateRaw,
        CAST(NULL AS nvarchar(30)) AS LCNo,
        CAST(NULL AS nvarchar(30)) AS BLNo,
        CAST(NULL AS nvarchar(30)) AS VesselName,
        CAST(NULL AS nvarchar(30)) AS VoyageNo,
        CAST(NULL AS nvarchar(30)) AS ETDRaw,
        CAST(NULL AS nvarchar(30)) AS ETARaw,
        CAST(NULL AS nvarchar(30)) AS TransportMeans,
        CAST(NULL AS nvarchar(30)) AS PackMethod,
        CAST(NULL AS decimal(18, 4)) AS PackQty,
        CAST(NULL AS nvarchar(30)) AS PackUnit,
        CAST(NULL AS nvarchar(30)) AS PJTNo,
        CAST(NULL AS nvarchar(30)) AS PJTName,
        h.BizUnit AS BizUnit
      FROM dbo.[_TSLInvoice] h
      INNER JOIN dbo.[_TSLInvoiceItem] i
        ON h.CompanySeq = i.CompanySeq AND h.InvoiceSeq = i.InvoiceSeq
      LEFT JOIN dbo.[_TDACust] c
        ON h.CompanySeq = c.CompanySeq AND h.CustSeq = c.CustSeq
      LEFT JOIN dbo.[_TDAItem] it
        ON h.CompanySeq = it.CompanySeq AND i.ItemSeq = it.ItemSeq
      LEFT JOIN dbo.[_TDAUnit] u
        ON h.CompanySeq = u.CompanySeq
        AND u.UnitSeq = COALESCE(NULLIF(i.UnitSeq, 0), it.UnitSeq)
      LEFT JOIN dbo.[_TDACurr] curr
        ON h.CompanySeq = curr.CompanySeq AND h.CurrSeq = curr.CurrSeq
      ${rp.bizJoin}
      ${rp.whRetJoin}
      ${rp.whOutJoin}
      ${rp.empJoin}
      WHERE LTRIM(RTRIM(h.InvoiceDate)) >= @fromYmd
        AND LTRIM(RTRIM(h.InvoiceDate)) <= @toYmd
        AND ${umOutKindSql}
        AND ${smReturnSql}
        AND ${lineCreditSql}
        ${whereTail}
      ORDER BY LTRIM(RTRIM(h.InvoiceDate)) ASC, h.CompanySeq ASC, h.InvoiceSeq ASC, i.InvoiceSerl ASC
    `);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`TSL export return invoice items query failed: ${msg}`);
      throw new BadRequestException(`ERP 수출 반품 품목 조회에 실패했습니다. (${msg})`);
    }

    const raw = result.recordset ?? [];
    const truncated = raw.length > maxRows;
    const slice = truncated ? raw.slice(0, maxRows) : raw;
    return {
      items: slice.map((r, i) => ({ ...mapReturnRow(r), rowNo: i + 1 })),
      truncated,
    };
  }
}
