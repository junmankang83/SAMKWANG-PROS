import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mssql from 'mssql';

/**
 * 구매납품 품목 조회 — `dbo._TPUDelv` + `dbo._TPUDelvItem`(또는 `TPUDelvItem`).
 * 엑셀「구매납품품목조회」·ERP「외주납품품목조회」 등 50개 데이터 열 순서(선택 열 제외)에 맞춥니다.
 * 수출품은 `SMExpKind` = `8009004`(거래명세와 동일)인 경우만 WHERE에서 제외합니다. 컬럼명은 INFORMATION_SCHEMA로 감지합니다.
 */
export type PuDelvItemRow = {
  /** 조회 결과 표시 순번(1부터) */
  rowNo: number;
  bizUnit: number | null;
  delvDate: string;
  delvNo: string | null;
  purOrderDate: string | null;
  purOrderNo: string | null;
  customerName: string | null;
  customerCode: string | null;
  delvKind: string | null;
  recvProgressStatus: string | null;
  delvDept: string | null;
  delvChargePerson: string | null;
  inspectionKind: string | null;
  itemName: string | null;
  itemCode: string | null;
  spec: string | null;
  unit: string | null;
  unitPrice: number | null;
  qty: number | null;
  vatIncluded: string | null;
  vatRate: number | null;
  supplyAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  currency: string | null;
  exchangeRate: number | null;
  domSupplyAmount: number | null;
  domVatAmount: number | null;
  domTotalAmount: number | null;
  inQty: number | null;
  inAmount: number | null;
  inDomAmount: number | null;
  localForeignKind: string | null;
  whName: string | null;
  manufacturer: string | null;
  itemAssetClass: string | null;
  validUntilDate: string | null;
  okQty: number | null;
  ngQty: number | null;
  ngReturnQty: number | null;
  specialNote: string | null;
  remark: string | null;
  sourceInquiry: string | null;
  progressInquiry: string | null;
  sourceMgmtNo: string | null;
  sourceNo: string | null;
  custLotNo: string | null;
  lastWorkDatetime: string | null;
  itemClassL: string | null;
  itemClassM: string | null;
  itemClassS: string | null;
};

/** `GET /api/erp/pu-delv-items?schemaMeta=true` 응답에만 포함 */
export type PuDelvItemsSchemaMeta = {
  smExpKindOnHeader: boolean;
  smExpKindOnLine: boolean;
  /** 헤더 또는 라인에 `SMExpKind` 컬럼이 있어 8009004 제외 WHERE가 붙는지 */
  smExpKindFilterApplied: boolean;
};

export type PuDelvItemsListResult = {
  items: PuDelvItemRow[];
  truncated: boolean;
  schemaMeta?: PuDelvItemsSchemaMeta;
};

type SqlRow = {
  DelvKindRaw: string | null;
  RecvProgRaw: string | null;
  BizUnit: number | null;
  DelvDateRaw: string | null;
  DelvNoFmt: string | null;
  PurOrderDateRaw: string | null;
  PurOrderNo: string | null;
  CustName: string | null;
  CustomerCodeRaw: string | null;
  DeptName: string | null;
  ChargeEmpName: string | null;
  InspKindRaw: string | null;
  ItemNo: string | null;
  ItemName: string | null;
  Spec: string | null;
  UnitName: string | null;
  Qty: number | null;
  LineUnitPrice: number | null;
  VATInclRaw: string | null;
  VATRate: number | null;
  SupplyAmt: number | null;
  DomVAT: number | null;
  LineTotal: number | null;
  CurrName: string | null;
  CurrNo: string | null;
  ExRate: number | null;
  KrwSupplyAmt: number | null;
  KrwVatAmt: number | null;
  KrwTotalAmt: number | null;
  InQty: number | null;
  InDomAmt: number | null;
  InKrwAmt: number | null;
  LocForKindRaw: string | null;
  WHName: string | null;
  MakerName: string | null;
  ItemAssetRaw: string | null;
  ValidDateRaw: string | null;
  OKQty: number | null;
  NGQty: number | null;
  NGReturnQty: number | null;
  SpecialNote: string | null;
  LineRemark: string | null;
  LineMemo: string | null;
  SrcInquiry: string | null;
  ProgressInquiry: string | null;
  SrcMgmtNo: string | null;
  SrcNo: string | null;
  CustLotNo: string | null;
  LastWorkRaw: string | null;
  ItemClassL: string | null;
  ItemClassM: string | null;
  ItemClassS: string | null;
};

type PuDelvOutSqlPlan = {
  itemTable: string;
  hDate: string;
  /** `CHAR(8)` YYYYMMDD — 기간 WHERE·ORDER BY에 사용 */
  hDateYmdExpr: string;
  hNo: string;
  hSeq: string;
  iSeq: string;
  iSerl: string;
  delvKindExpr: string;
  recvProgExpr: string;
  lineUnitPriceSql: string;
  qtySql: string;
  domAmtSql: string;
  domVatSql: string;
  lineTotalSql: string;
  itemSeqCol: string;
  whSeqExpr: string;
  whJoinSql: string;
  unitJoinSql: string;
  remarkSelect: string;
  empJoinSql: string;
  empSelectSql: string;
  deptJoinSql: string;
  deptSelectSql: string;
  currJoinSql: string;
  exRateSql: string;
  poJoin: string;
  poPurOrderNoSelect: string;
  poPurOrderDateSelect: string;
  customerCodeExpr: string;
  vatInclSql: string;
  vatRateSql: string;
  inQtySql: string;
  inAmtSql: string;
  inKrwAmtSql: string;
  locForKindExpr: string;
  inspKindExpr: string;
  makerNameSql: string;
  itemAssetSql: string;
  validDateSql: string;
  okQtySql: string;
  ngQtySql: string;
  ngRetSql: string;
  specialNoteSql: string;
  srcMgmtSql: string;
  srcNoSql: string;
  custLotSql: string;
  lastWorkSql: string;
  itemClassLSql: string;
  itemClassMSql: string;
  itemClassSSql: string;
  /** 품명: `_TDAItem` 우선, 비면 라인 후보 컬럼 */
  itemNameSelectSql: string;
  /** 품번: `_TDAItem` 우선, 비면 라인 후보 컬럼 */
  itemNoSelectSql: string;
  /** 제조사 `CustName` — `it.MakerSeq` 등 → `_TDACust` mk */
  makerJoinSql: string;
  /** 발주 라인 — 원천/진행 등 보조 컬럼 */
  poiJoinSql: string;
  srcInquirySql: string;
  progressInquirySql: string;
  krwSupplySql: string;
  krwVatSql: string;
  krwTotalSql: string;
  /** 수출 제외: `SMExpKind` = `8009004` 가 아닌 행만(헤더·라인 컬럼이 있으면 각각 적용, 없으면 빈 문자열) */
  exportExcludeWhereSql: string;
  smExpKindOnHeader: boolean;
  smExpKindOnLine: boolean;
};

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

function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function ymdOrTextToIsoOrText(d: string | null): string | null {
  const t = trimOrNull(d);
  if (!t) return null;
  if (/^\d{8}$/.test(t)) {
    const iso = yyyymmddToIso(t);
    return iso || t;
  }
  return t;
}

function mapRow(r: SqlRow): Omit<PuDelvItemRow, 'rowNo'> {
  const remark = trimOrNull(r.LineRemark) ?? trimOrNull(r.LineMemo);
  return {
    bizUnit: r.BizUnit == null ? null : Number(r.BizUnit),
    delvDate: yyyymmddToIso(r.DelvDateRaw),
    delvNo: trimOrNull(r.DelvNoFmt),
    purOrderDate: ymdOrTextToIsoOrText(r.PurOrderDateRaw),
    purOrderNo: trimOrNull(r.PurOrderNo),
    customerName: trimOrNull(r.CustName),
    customerCode: trimOrNull(r.CustomerCodeRaw),
    delvKind: trimOrNull(r.DelvKindRaw),
    recvProgressStatus: trimOrNull(r.RecvProgRaw),
    delvDept: trimOrNull(r.DeptName),
    delvChargePerson: trimOrNull(r.ChargeEmpName),
    inspectionKind: trimOrNull(r.InspKindRaw),
    itemName: trimOrNull(r.ItemName),
    itemCode: trimOrNull(r.ItemNo),
    spec: trimOrNull(r.Spec),
    unit: trimOrNull(r.UnitName),
    unitPrice: toNumber(r.LineUnitPrice),
    qty: toNumber(r.Qty),
    vatIncluded: trimOrNull(r.VATInclRaw),
    vatRate: toNumber(r.VATRate),
    supplyAmount: toNumber(r.SupplyAmt),
    vatAmount: toNumber(r.DomVAT),
    totalAmount: toNumber(r.LineTotal),
    currency: trimOrNull(r.CurrName) ?? trimOrNull(r.CurrNo),
    exchangeRate: toNumber(r.ExRate),
    domSupplyAmount: toNumber(r.KrwSupplyAmt),
    domVatAmount: toNumber(r.KrwVatAmt),
    domTotalAmount: toNumber(r.KrwTotalAmt),
    inQty: toNumber(r.InQty),
    inAmount: toNumber(r.InDomAmt),
    inDomAmount: toNumber(r.InKrwAmt),
    localForeignKind: trimOrNull(r.LocForKindRaw),
    whName: trimOrNull(r.WHName),
    manufacturer: trimOrNull(r.MakerName),
    itemAssetClass: trimOrNull(r.ItemAssetRaw),
    validUntilDate: ymdOrTextToIsoOrText(r.ValidDateRaw),
    okQty: toNumber(r.OKQty),
    ngQty: toNumber(r.NGQty),
    ngReturnQty: toNumber(r.NGReturnQty),
    specialNote: trimOrNull(r.SpecialNote),
    remark,
    sourceInquiry: trimOrNull(r.SrcInquiry),
    progressInquiry: trimOrNull(r.ProgressInquiry),
    sourceMgmtNo: trimOrNull(r.SrcMgmtNo),
    sourceNo: trimOrNull(r.SrcNo),
    custLotNo: trimOrNull(r.CustLotNo),
    lastWorkDatetime: trimOrNull(r.LastWorkRaw),
    itemClassL: trimOrNull(r.ItemClassL),
    itemClassM: trimOrNull(r.ItemClassM),
    itemClassS: trimOrNull(r.ItemClassS),
  };
}

const DEFAULT_LIMIT = 8000;
const MAX_RANGE_DAYS = 400;

function bracketIdent(name: string): string {
  return `[${name.replace(/\]/g, ']]')}]`;
}

/** 헤더 납품일 → `CHAR(8)` YYYYMMDD (datetime·문자·숫자 혼용) */
function buildHDelvDateYmdExpr(hDate: string): string {
  const hc = `h.${bracketIdent(hDate)}`;
  return `CASE
    WHEN TRY_CONVERT(datetime, ${hc}, 112) IS NOT NULL THEN CONVERT(CHAR(8), TRY_CONVERT(datetime, ${hc}, 112), 112)
    WHEN TRY_CONVERT(datetime, ${hc}) IS NOT NULL THEN CONVERT(CHAR(8), TRY_CONVERT(datetime, ${hc}), 112)
    ELSE RIGHT(N'00000000' + LTRIM(RTRIM(CAST(${hc} AS NVARCHAR(30)))), 8)
  END`;
}

/** 라인(i)·헤더(h)에서 금액 후보를 순서대로 COALESCE, 없으면 fallbackSql */
function buildCoalesceLineHeadAmt(
  iCols: { COLUMN_NAME: string }[],
  hCols: { COLUMN_NAME: string }[],
  iNames: string[],
  hNames: string[],
  fallbackSql: string,
): string {
  const parts: string[] = [];
  for (const n of iNames) {
    const c = pickColumn(iCols, [n]);
    if (c) {
      parts.push(`i.${bracketIdent(c)}`);
    }
  }
  for (const n of hNames) {
    const c = pickColumn(hCols, [n]);
    if (c) {
      parts.push(`h.${bracketIdent(c)}`);
    }
  }
  if (parts.length === 0) {
    return fallbackSql;
  }
  return `COALESCE(${parts.join(', ')}, ${fallbackSql})`;
}

/** `_TPUDelv` / 라인 — 거래명세 `_TSLInvoice`와 동일한 수출 구분 코드 */
const PU_DELV_EXCLUDED_SM_EXP_KIND = '8009004';

/** `SMExpKind` 가 수출 코드가 아닌 행만 남김(NULL·공백·그 외 코드는 포함). 컬럼 없으면 빈 문자열 반환 */
function smExpKindNotExportWhere(alias: 'h' | 'i', colName: string | null): string {
  if (!colName) return '';
  const c = bracketIdent(colName);
  return ` AND (
    ${alias}.${c} IS NULL
    OR LTRIM(RTRIM(CAST(${alias}.${c} AS NVARCHAR(50)))) = N''
    OR LTRIM(RTRIM(CAST(${alias}.${c} AS NVARCHAR(50)))) <> N'${PU_DELV_EXCLUDED_SM_EXP_KIND}'
  )`;
}

async function listColumns(
  pool: mssql.ConnectionPool,
  tableName: string,
): Promise<{ COLUMN_NAME: string }[]> {
  const r = await pool
    .request()
    .input('tn', mssql.NVarChar(128), tableName)
    .query<{ COLUMN_NAME: string }>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = @tn`,
    );
  return r.recordset ?? [];
}

function pickColumn(rows: { COLUMN_NAME: string }[], candidates: string[]): string | null {
  const map = new Map(rows.map((x) => [x.COLUMN_NAME.toUpperCase(), x.COLUMN_NAME]));
  for (const c of candidates) {
    const exact = map.get(c.toUpperCase());
    if (exact) {
      return exact;
    }
  }
  return null;
}

function buildLineUnitPriceSql(iCols: { COLUMN_NAME: string }[]): string {
  const order = [
    'CustPrice',
    'ItemPrice',
    'Price',
    'PurPrice',
    'UnitPrice',
    'PUPrice',
    'NetPrice',
    'EstPrice',
    'EvalPrice',
    'PurUnitPrice',
  ];
  const found: string[] = [];
  for (const o of order) {
    const c = pickColumn(iCols, [o]);
    if (c) {
      found.push(c);
    }
  }
  if (found.length === 0) {
    return 'CAST(NULL AS decimal(18, 6))';
  }
  if (found.length === 1) {
    return `i.${bracketIdent(found[0])}`;
  }
  const lead = found.slice(0, -1).map((c) => `NULLIF(i.${bracketIdent(c)}, 0)`);
  const last = found[found.length - 1];
  return `COALESCE(${[...lead, `i.${bracketIdent(last)}`].join(', ')})`;
}

function iColSql(iCols: { COLUMN_NAME: string }[], candidates: string[], sqlNull: string): string {
  const c = pickColumn(iCols, candidates);
  return c ? `i.${bracketIdent(c)}` : sqlNull;
}

function itColSql(itCols: { COLUMN_NAME: string }[], candidates: string[], sqlNull: string): string {
  const c = pickColumn(itCols, candidates);
  return c ? `it.${bracketIdent(c)}` : sqlNull;
}

function hColSql(hCols: { COLUMN_NAME: string }[], candidates: string[], sqlNull: string): string {
  const c = pickColumn(hCols, candidates);
  return c ? `h.${bracketIdent(c)}` : sqlNull;
}

function pickFirstExpr(
  rows: { COLUMN_NAME: string }[],
  candidates: string[],
  alias: string,
  tableAlias: string,
): string {
  const col = pickColumn(rows, candidates);
  if (!col) {
    return `CAST(NULL AS NVARCHAR(80)) AS ${alias}`;
  }
  return `LTRIM(RTRIM(CAST(${tableAlias}.${bracketIdent(col)} AS NVARCHAR(80)))) AS ${alias}`;
}

async function tableExists(pool: mssql.ConnectionPool, tableName: string): Promise<boolean> {
  const r = await pool
    .request()
    .input('tn', mssql.NVarChar(128), tableName)
    .query<{ c: number }>(
      `SELECT COUNT(1) AS c FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = @tn`,
    );
  return Number(r.recordset?.[0]?.c) > 0;
}

async function resolveSqlPlan(pool: mssql.ConnectionPool, logger: Logger): Promise<PuDelvOutSqlPlan> {
  const headerName = '_TPUDelv';
  let itemTable = '_TPUDelvItem';
  if (!(await tableExists(pool, itemTable))) {
    itemTable = 'TPUDelvItem';
  }
  if (!(await tableExists(pool, itemTable))) {
    throw new ServiceUnavailableException(
      'ERP에 구매납품 라인 테이블(dbo._TPUDelvItem 또는 dbo.TPUDelvItem)이 없습니다.',
    );
  }
  if (!(await tableExists(pool, headerName))) {
    throw new ServiceUnavailableException('ERP에 dbo._TPUDelv 테이블이 없습니다.');
  }

  const hCols = await listColumns(pool, headerName);
  const iCols = await listColumns(pool, itemTable);
  const itCols = await listColumns(pool, '_TDAItem');
  const custCols = await listColumns(pool, '_TDACust');

  const hDate =
    pickColumn(hCols, ['DelvDate', 'PUDelvDate', 'ShipDate', 'OutDate', 'DeliveryDate', 'DelvOutDate']) ??
    (() => {
      throw new ServiceUnavailableException(
        '_TPUDelv에 납품일 컬럼(DelvDate·PUDelvDate·ShipDate 등)을 찾을 수 없습니다.',
      );
    })();
  const hDateYmdExpr = buildHDelvDateYmdExpr(hDate);

  const hNo =
    pickColumn(hCols, ['DelvNo', 'PUDelvNo', 'DelvOutNo', 'ShipNo', 'DocNo']) ??
    (() => {
      throw new ServiceUnavailableException('_TPUDelv에 납품번호 컬럼(DelvNo·PUDelvNo 등)을 찾을 수 없습니다.');
    })();

  const hSeq =
    pickColumn(hCols, ['DelvSeq', 'PUDelvSeq', 'PUDelvOutSeq', 'ShipSeq', 'DocSeq']) ??
    (() => {
      throw new ServiceUnavailableException('_TPUDelv에 문서키 컬럼(DelvSeq·PUDelvSeq 등)을 찾을 수 없습니다.');
    })();

  const iSeq = pickColumn(iCols, [hSeq, 'DelvSeq', 'PUDelvSeq', 'PUDelvOutSeq', 'ShipSeq', 'DocSeq']);
  if (!iSeq) {
    throw new ServiceUnavailableException(
      `${itemTable}에 헤더와 조인할 키 컬럼(${hSeq} 등)을 찾을 수 없습니다.`,
    );
  }

  const iSerl =
    pickColumn(iCols, ['DelvSerl', 'DelSerl', 'LineSerl', 'ItemSerl', 'DelvItemSerl', 'Serl']) ??
    (() => {
      throw new ServiceUnavailableException(
        `${itemTable}에 순번 컬럼(DelvSerl·LineSerl 등)을 찾을 수 없습니다.`,
      );
    })();

  const delvKindPick = pickFirstExpr(
    hCols,
    ['SMDelvKind', 'UMDelvKind', 'DelvKind', 'PUDelvKind', 'DelvKindCd', 'DelvStatusKind', 'PUDelvKindName'],
    'DelvKind',
    'h',
  );
  const delvKindExpr = delvKindPick.replace(' AS DelvKind', '');

  const recvProgPick = pickFirstExpr(
    hCols,
    [
      'SMRecvStatus',
      'DelvInProgStatus',
      'InProgStatus',
      'RecvProgStatus',
      'UMDelvInKind',
      'SMDelvStatus',
      'UMStatus',
      'DelvStatus',
      'DocStatus',
    ],
    'RecvProg',
    'h',
  );
  const recvProgExpr = recvProgPick.replace(' AS RecvProg', '');

  const itemSeqCol =
    pickColumn(iCols, ['ItemSeq', 'MatSeq', 'MaterialSeq', 'ItemSeqNo']) ??
    (() => {
      throw new ServiceUnavailableException(`${itemTable}에 품목 연결 컬럼(ItemSeq 등)이 없습니다.`);
    })();

  const lineUnitPriceSql = buildLineUnitPriceSql(iCols);
  const qtySql = iColSql(iCols, ['Qty', 'DelvQty', 'ShipQty', 'PUDelvQty', 'OrderQty', 'OutQty'], 'CAST(NULL AS decimal(18, 6))');
  const domAmtSql = iColSql(
    iCols,
    ['DomAmt', 'SupplyAmt', 'SplyAmt', 'SupplyAmount', 'DomSupplyAmt'],
    'CAST(NULL AS decimal(18, 4))',
  );
  const domVatSql = iColSql(iCols, ['DomVAT', 'VAT', 'VATAmt', 'TaxAmt', 'VatAmt'], 'CAST(NULL AS decimal(18, 4))');
  const lineTotalSql = `CAST(ISNULL((${domAmtSql}), 0) + ISNULL((${domVatSql}), 0) AS decimal(18, 4))`;

  const krwSupplySql = buildCoalesceLineHeadAmt(
    iCols,
    hCols,
    [
      'KrwSupplyAmt',
      'WonSupplyAmt',
      'KSupplyAmt',
      'DomSupplyAmt',
      'DomSplyAmt',
      'KrwSplyAmt',
      'SupplyAmtKRW',
      'WonSplyAmt',
      'KrwSupplyAmount',
    ],
    ['KrwSupplyAmt', 'WonSupplyAmt', 'DomSupplyAmt', 'KSupplyAmt'],
    `(${domAmtSql})`,
  );
  const krwVatSql = buildCoalesceLineHeadAmt(
    iCols,
    hCols,
    ['KrwVatAmt', 'WonVatAmt', 'DomVatAmt', 'KrwVAT', 'DomVAT', 'VatAmtKRW', 'KrwVATAmt', 'WonVat'],
    ['KrwVatAmt', 'WonVatAmt', 'DomVatAmt', 'DomVAT'],
    `(${domVatSql})`,
  );
  const krwTotalSql = buildCoalesceLineHeadAmt(
    iCols,
    hCols,
    [
      'KrwTotalAmt',
      'WonTotalAmt',
      'DomTotalAmt',
      'KrwAmt',
      'TotAmtKRW',
      'DomTotal',
      'KrwLineTotal',
      'WonLineTotal',
    ],
    ['KrwTotalAmt', 'WonTotalAmt', 'DomTotalAmt'],
    `(${lineTotalSql})`,
  );

  const iWh = pickColumn(iCols, ['WHSeq', 'OutWHSeq', 'WarehouseSeq', 'StkWHSeq', 'DelvWHSeq']);
  const hWh = pickColumn(hCols, ['WHSeq', 'OutWHSeq', 'ShipWHSeq', 'StkWHSeq']);
  let whSeqExpr = 'CAST(NULL AS INT)';
  if (iWh) {
    whSeqExpr = `i.${bracketIdent(iWh)}`;
  } else if (hWh) {
    whSeqExpr = `h.${bracketIdent(hWh)}`;
  }
  const whJoinSql =
    iWh || hWh
      ? `LEFT JOIN dbo.[_TDAWH] wh ON h.CompanySeq = wh.CompanySeq AND wh.WHSeq = ${whSeqExpr}`
      : `LEFT JOIN dbo.[_TDAWH] wh ON 1 = 0`;

  const unitSeqCol = pickColumn(iCols, ['UnitSeq', 'PurUnitSeq', 'SalesUnitSeq']);
  const unitJoinSql =
    unitSeqCol != null
      ? `LEFT JOIN dbo.[_TDAUnit] u
        ON h.CompanySeq = u.CompanySeq AND u.UnitSeq = COALESCE(NULLIF(i.${bracketIdent(unitSeqCol)}, 0), it.UnitSeq)`
      : `LEFT JOIN dbo.[_TDAUnit] u
        ON h.CompanySeq = u.CompanySeq AND u.UnitSeq = it.UnitSeq`;

  const remarkCol = pickColumn(iCols, ['Remark', 'LineRemark']);
  const memoCol = pickColumn(iCols, ['Memo', 'LineMemo']);
  const remarkSelect = `${remarkCol ? `i.${bracketIdent(remarkCol)}` : 'CAST(NULL AS NVARCHAR(500))'} AS LineRemark, ${
    memoCol ? `i.${bracketIdent(memoCol)}` : 'CAST(NULL AS NVARCHAR(500))'
  } AS LineMemo`;

  const hEmpSeq = pickColumn(hCols, ['EmpSeq', 'ChargeEmpSeq', 'PicEmpSeq', 'SalesEmpSeq', 'DelvEmpSeq']);
  const empJoinSql = hEmpSeq
    ? `LEFT JOIN dbo.[_TDAEmp] emp ON h.CompanySeq = emp.CompanySeq AND h.${bracketIdent(hEmpSeq)} = emp.EmpSeq`
    : `LEFT JOIN dbo.[_TDAEmp] emp ON 1 = 0`;
  const empSelectSql = hEmpSeq ? `emp.EmpName AS ChargeEmpName` : `CAST(NULL AS NVARCHAR(100)) AS ChargeEmpName`;

  const hDeptSeq = pickColumn(hCols, ['DeptSeq', 'ChargeDeptSeq', 'SalesDeptSeq']);
  const deptJoinSql = hDeptSeq
    ? `LEFT JOIN dbo.[_TDADept] dp ON h.CompanySeq = dp.CompanySeq AND h.${bracketIdent(hDeptSeq)} = dp.DeptSeq`
    : `LEFT JOIN dbo.[_TDADept] dp ON 1 = 0`;
  const deptSelectSql = hDeptSeq ? `dp.DeptName AS DeptName` : `CAST(NULL AS NVARCHAR(100)) AS DeptName`;

  const iCur = pickColumn(iCols, ['CurSeq', 'CurrSeq']);
  const hCur = pickColumn(hCols, ['CurSeq', 'CurrSeq']);
  let curSeqExpr = 'CAST(NULL AS INT)';
  if (iCur && hCur) {
    curSeqExpr = `COALESCE(NULLIF(i.${bracketIdent(iCur)}, 0), NULLIF(h.${bracketIdent(hCur)}, 0))`;
  } else if (iCur) {
    curSeqExpr = `NULLIF(i.${bracketIdent(iCur)}, 0)`;
  } else if (hCur) {
    curSeqExpr = `NULLIF(h.${bracketIdent(hCur)}, 0)`;
  }
  const currJoinSql =
    iCur || hCur
      ? `LEFT JOIN dbo.[_TDACurr] curr
        ON h.CompanySeq = curr.CompanySeq AND curr.CurrSeq = ${curSeqExpr}`
      : `LEFT JOIN dbo.[_TDACurr] curr ON 1 = 0`;

  const exRateSql = `COALESCE(${iColSql(iCols, ['ExRate', 'ExchRate', 'ExchangeRate', 'FXRate'], 'CAST(NULL AS decimal(18, 6))')}, ${hColSql(hCols, ['ExRate', 'ExchRate', 'ExchangeRate', 'FXRate'], 'CAST(NULL AS decimal(18, 6))')})`;

  const custNoCol = pickColumn(custCols, ['CustNo', 'CustCode', 'PartnerNo', 'BizPartnerNo']);
  const customerCodeExpr = custNoCol
    ? `LTRIM(RTRIM(CAST(c.${bracketIdent(custNoCol)} AS NVARCHAR(60))))`
    : `LTRIM(RTRIM(CAST(c.CustSeq AS NVARCHAR(30))))`;

  const iPurOrderSeq = pickColumn(iCols, [
    'PurOrderSeq',
    'POSeq',
    'PurOrdSeq',
    'OrderSeq',
    'POrdSeq',
    'PurchaseOrderSeq',
    'POKey',
    'PurOrderKey',
    'OrdSeq',
    'PDOrdSeq',
  ]);
  const iPurOrderSerl = pickColumn(iCols, [
    'PurOrderSerl',
    'POSerl',
    'PurOrdSerl',
    'OrderSerl',
    'PurOrderDtlSerl',
    'PurOrdDtlSerl',
    'POLineSerl',
    'POItemSerl',
    'OrdSerl',
    'LineSerl',
  ]);
  const iPurOrderNoLine = pickColumn(iCols, [
    'PurOrderNo',
    'PONo',
    'OrderNo',
    'PurOrdNo',
    'PurchaseOrderNo',
    'PDOrdNo',
    'OrdNo',
    'PurOrderNum',
    'POrdNo',
  ]);

  const existsPoUnderscore = await tableExists(pool, '_TPUPurOrder');
  const existsPoPlain = await tableExists(pool, 'TPUPurOrder');
  const hasPoTable = existsPoUnderscore || existsPoPlain;
  const poTable = existsPoUnderscore ? '_TPUPurOrder' : existsPoPlain ? 'TPUPurOrder' : '';
  const poCols = hasPoTable && poTable ? await listColumns(pool, poTable) : [];
  const poSeq = hasPoTable
    ? pickColumn(poCols, ['PurOrderSeq', 'POSeq', 'OrderSeq', 'POrdSeq', 'PurchaseOrderSeq', 'POKey', 'PurOrderKey'])
    : null;
  const poNo = hasPoTable
    ? pickColumn(poCols, [
        'PurOrderNo',
        'PONo',
        'OrderNo',
        'PurOrdNo',
        'PurchaseOrderNo',
        'PDOrdNo',
        'OrdNo',
        'PurOrderNum',
      ])
    : null;
  const poDateCol = hasPoTable
    ? pickColumn(poCols, [
        'PurOrdDate',
        'POrdDate',
        'OrdDate',
        'OrderDate',
        'PurDate',
        'PODate',
        'PurOrderDate',
        'OrderRegDate',
        'POrdRegDate',
        'RegDate',
      ])
    : null;

  /** 발주일: `po` 조인 성공 시 헤더 우선, 없으면 납품라인·납품헤더 후보 */
  const linePoDateExpr = iColSql(
    iCols,
    [
      'PurOrderDate',
      'PurOrdDate',
      'POrdDate',
      'OrdDate',
      'OrderDate',
      'PODate',
      'PurDate',
      'PORegDate',
      'PurOrderRegDate',
    ],
    'CAST(NULL AS NVARCHAR(30))',
  );
  const hdrPoDateExpr = hColSql(
    hCols,
    [
      'PurOrderDate',
      'PurOrdDate',
      'POrdDate',
      'OrdDate',
      'OrderDate',
      'PODate',
      'PurDate',
      'PORegDate',
    ],
    'CAST(NULL AS NVARCHAR(30))',
  );
  const purOrderDateSelectFromPo = (poDatePartSql: string) =>
    `COALESCE(
        ${poDatePartSql},
        NULLIF(LTRIM(RTRIM(CAST(${linePoDateExpr} AS NVARCHAR(30)))), N''),
        NULLIF(LTRIM(RTRIM(CAST(${hdrPoDateExpr} AS NVARCHAR(30)))), N'')
      ) AS PurOrderDateRaw`;

  let poJoin = '';
  let poPurOrderNoSelect = `CAST(NULL AS NVARCHAR(60)) AS PurOrderNo`;
  let poPurOrderDateSelect = purOrderDateSelectFromPo(`CAST(NULL AS NVARCHAR(30))`);
  if (hasPoTable && poTable && poSeq && poNo && iPurOrderSeq) {
    poJoin = `LEFT JOIN dbo.${bracketIdent(poTable)} po
        ON h.CompanySeq = po.CompanySeq
        AND NULLIF(i.${bracketIdent(iPurOrderSeq)}, 0) IS NOT NULL
        AND po.${bracketIdent(poSeq)} = i.${bracketIdent(iPurOrderSeq)}`;
    poPurOrderNoSelect = `COALESCE(
          NULLIF(LTRIM(RTRIM(po.${bracketIdent(poNo)})), N''),
          ${
            iPurOrderNoLine
              ? `NULLIF(LTRIM(RTRIM(CAST(i.${bracketIdent(iPurOrderNoLine)} AS NVARCHAR(100)))), N''),`
              : ''
          }
          CASE
            WHEN NULLIF(i.${bracketIdent(iPurOrderSeq)}, 0) IS NULL THEN NULL
            ELSE LTRIM(RTRIM(CAST(i.${bracketIdent(iPurOrderSeq)} AS NVARCHAR(30))))
          END
        ) AS PurOrderNo`;
    const poDatePart = poDateCol
      ? `NULLIF(LTRIM(RTRIM(CAST(po.${bracketIdent(poDateCol)} AS NVARCHAR(30)))), N'')`
      : `CAST(NULL AS NVARCHAR(30))`;
    poPurOrderDateSelect = purOrderDateSelectFromPo(poDatePart);
  } else if (hasPoTable && poTable && poSeq && poNo && iPurOrderNoLine) {
    /** 라인에 발주번호만 있고 Seq 컬럼명이 다를 때 — 번호 문자열로 발주 헤더 조인 */
    poJoin = `LEFT JOIN dbo.${bracketIdent(poTable)} po
        ON h.CompanySeq = po.CompanySeq
        AND NULLIF(LTRIM(RTRIM(CAST(i.${bracketIdent(iPurOrderNoLine)} AS NVARCHAR(100)))), N'') IS NOT NULL
        AND LTRIM(RTRIM(CAST(po.${bracketIdent(poNo)} AS NVARCHAR(100)))) = LTRIM(RTRIM(CAST(i.${bracketIdent(iPurOrderNoLine)} AS NVARCHAR(100))))`;
    poPurOrderNoSelect = `COALESCE(
          NULLIF(LTRIM(RTRIM(CAST(po.${bracketIdent(poNo)} AS NVARCHAR(100)))), N''),
          NULLIF(LTRIM(RTRIM(CAST(i.${bracketIdent(iPurOrderNoLine)} AS NVARCHAR(100)))), N'')
        ) AS PurOrderNo`;
    const poDatePart = poDateCol
      ? `NULLIF(LTRIM(RTRIM(CAST(po.${bracketIdent(poDateCol)} AS NVARCHAR(30)))), N'')`
      : `CAST(NULL AS NVARCHAR(30))`;
    poPurOrderDateSelect = purOrderDateSelectFromPo(poDatePart);
  } else if (iPurOrderNoLine) {
    poPurOrderNoSelect = `COALESCE(
          NULLIF(LTRIM(RTRIM(i.${bracketIdent(iPurOrderNoLine)})), N''),
          ${
            iPurOrderSeq
              ? `CASE WHEN NULLIF(i.${bracketIdent(iPurOrderSeq)}, 0) IS NULL THEN NULL
            ELSE LTRIM(RTRIM(CAST(i.${bracketIdent(iPurOrderSeq)} AS NVARCHAR(30)))) END`
              : 'CAST(NULL AS NVARCHAR(60))'
          }
        ) AS PurOrderNo`;
    poPurOrderDateSelect = purOrderDateSelectFromPo(`CAST(NULL AS NVARCHAR(30))`);
  } else if (iPurOrderSeq) {
    poPurOrderNoSelect = `CASE
            WHEN NULLIF(i.${bracketIdent(iPurOrderSeq)}, 0) IS NULL THEN NULL
            ELSE LTRIM(RTRIM(CAST(i.${bracketIdent(iPurOrderSeq)} AS NVARCHAR(30))))
          END AS PurOrderNo`;
    poPurOrderDateSelect = purOrderDateSelectFromPo(`CAST(NULL AS NVARCHAR(30))`);
  }

  let poiJoinSql = '';
  let poiSrcCol: string | null = null;
  let poiProgCol: string | null = null;
  const poiTableName = (await tableExists(pool, '_TPUPurOrderItem'))
    ? '_TPUPurOrderItem'
    : (await tableExists(pool, 'TPUPurOrderItem'))
      ? 'TPUPurOrderItem'
      : '';
  if (poiTableName && hasPoTable && poTable && poSeq && iPurOrderSeq && iPurOrderSerl) {
    const poci = await listColumns(pool, poiTableName);
    const poiPoSeq = pickColumn(poci, ['PurOrderSeq', 'POSeq', 'OrderSeq', 'POrdSeq', 'PurchaseOrderSeq']);
    const poiPoSerl = pickColumn(poci, [
      'PurOrderSerl',
      'POSerl',
      'PurOrdSerl',
      'OrderSerl',
      'PurOrderDtlSerl',
      'POLineSerl',
    ]);
    if (poiPoSeq && poiPoSerl) {
      poiJoinSql = `LEFT JOIN dbo.${bracketIdent(poiTableName)} poi
        ON h.CompanySeq = poi.CompanySeq
        AND NULLIF(i.${bracketIdent(iPurOrderSeq)}, 0) IS NOT NULL
        AND NULLIF(i.${bracketIdent(iPurOrderSerl)}, 0) IS NOT NULL
        AND poi.${bracketIdent(poiPoSeq)} = i.${bracketIdent(iPurOrderSeq)}
        AND poi.${bracketIdent(poiPoSerl)} = i.${bracketIdent(iPurOrderSerl)}`;
      poiSrcCol = pickColumn(poci, [
        'SrcInquiry',
        'SourceInquiry',
        'OriInquiry',
        'RootInquiry',
        'RefInquiry',
        'CustOrdInquiry',
      ]);
      poiProgCol = pickColumn(poci, [
        'ProgressInquiry',
        'PrgInquiry',
        'ProgInquiry',
        'ProgStatusInq',
        'ProgressStatus',
        'RecvProgressInq',
      ]);
    }
  }

  const srcLineSql = iColSql(
    iCols,
    [
      'SrcInquiry',
      'SourceInquiry',
      'OriInquiry',
      'RootInquiry',
      'RefInquiry',
      'CustInquiry',
      'InquirySrc',
    ],
    'CAST(NULL AS NVARCHAR(500))',
  );
  const progLineSql = iColSql(
    iCols,
    [
      'ProgressInquiry',
      'PrgInquiry',
      'ProgInquiry',
      'ProgressInq',
      'ProgStatus',
      'RecvProgressInq',
    ],
    'CAST(NULL AS NVARCHAR(500))',
  );
  let srcInquirySql = srcLineSql;
  let progressInquirySql = progLineSql;
  if (poiJoinSql && poiSrcCol) {
    srcInquirySql = `COALESCE(NULLIF(LTRIM(RTRIM(CAST(poi.${bracketIdent(poiSrcCol)} AS NVARCHAR(500)))), N''), (${srcLineSql}))`;
  }
  if (poiJoinSql && poiProgCol) {
    progressInquirySql = `COALESCE(NULLIF(LTRIM(RTRIM(CAST(poi.${bracketIdent(poiProgCol)} AS NVARCHAR(500)))), N''), (${progLineSql}))`;
  }

  const inspKindPick = pickFirstExpr(
    iCols,
    ['QCInspKind', 'InspKind', 'InspectKind', 'QCKind', 'UMInspKind', 'SMInspKind', 'DelvInspKind'],
    'InspKind',
    'i',
  );
  const inspKindExpr = inspKindPick.replace(' AS InspKind', '');

  const vatInclCol = pickColumn(iCols, [
    'VATInYN',
    'TaxInYN',
    'TaxIncludeYN',
    'VATIncludeYN',
    'IsVATInclude',
    'VATIncYN',
  ]);
  const vatInclSql = vatInclCol
    ? `LTRIM(RTRIM(CAST(i.${bracketIdent(vatInclCol)} AS NVARCHAR(20))))`
    : `CAST(NULL AS NVARCHAR(20))`;

  const vatRateCol = pickColumn(iCols, ['VATRate', 'TaxRate', 'VATPerc', 'TaxPerc', 'VATRatePerc']);
  const vatRateSql = vatRateCol
    ? `CAST(i.${bracketIdent(vatRateCol)} AS decimal(18, 6))`
    : `CAST(NULL AS decimal(18, 6))`;

  const inQtySql = iColSql(
    iCols,
    [
      'InQty',
      'RecvQty',
      'DelvInQty',
      'StockInQty',
      'WHInQty',
      'RcvQty',
      'GRQty',
      'RecvInQty',
      'PUInQty',
      'PurInQty',
      'RecvGRQty',
    ],
    'CAST(NULL AS decimal(18, 6))',
  );
  const inAmtSql = iColSql(
    iCols,
    [
      'InDomAmt',
      'RecvDomAmt',
      'InAmt',
      'GRDomAmt',
      'RecvAmt',
      'InFcurrAmt',
      'RecvFcurrAmt',
      'InSupplyAmt',
    ],
    'CAST(NULL AS decimal(18, 4))',
  );
  const inKrwAmtSql = iColSql(
    iCols,
    [
      'InKrwAmt',
      'InWonAmt',
      'RecvKrwAmt',
      'InDomTotAmt',
      'InKrwTotAmt',
      'RecvKrwTotAmt',
      'InWonTotAmt',
    ],
    `CAST(NULL AS decimal(18, 4))`,
  );

  const locForICol = pickColumn(iCols, ['LocForKind', 'DmFcKind', 'DmstFrnKind', 'DomFrgnKind', 'LocalForeignKind']);
  const locForHCol = pickColumn(hCols, ['LocForKind', 'DmFcKind', 'DmstFrnKind', 'DomFrgnKind']);
  let locForKindExpr = `CAST(NULL AS NVARCHAR(40))`;
  if (locForICol && locForHCol) {
    locForKindExpr = `COALESCE(LTRIM(RTRIM(CAST(i.${bracketIdent(locForICol)} AS NVARCHAR(40)))), LTRIM(RTRIM(CAST(h.${bracketIdent(locForHCol)} AS NVARCHAR(40)))))`;
  } else if (locForICol) {
    locForKindExpr = `LTRIM(RTRIM(CAST(i.${bracketIdent(locForICol)} AS NVARCHAR(40))))`;
  } else if (locForHCol) {
    locForKindExpr = `LTRIM(RTRIM(CAST(h.${bracketIdent(locForHCol)} AS NVARCHAR(40))))`;
  }

  const hSmExpKindCol = pickColumn(hCols, ['SMExpKind']);
  const iSmExpKindCol = pickColumn(iCols, ['SMExpKind']);
  const exportExcludeWhereSql =
    smExpKindNotExportWhere('h', hSmExpKindCol) + smExpKindNotExportWhere('i', iSmExpKindCol);

  const makerNameCol = pickColumn(itCols, [
    'MakerName',
    'MfgName',
    'ManufName',
    'MakeCustName',
    'ManufacturerName',
    'MakerCustName',
    'MFGName',
    'SupName',
  ]);
  let makerNameSql = makerNameCol
    ? `LTRIM(RTRIM(CAST(it.${bracketIdent(makerNameCol)} AS NVARCHAR(200))))`
    : `CAST(NULL AS NVARCHAR(200))`;
  const makerSeqOnItem = pickColumn(itCols, ['MakerSeq', 'MakerCustSeq', 'MfgCustSeq', 'MFGCustSeq', 'MakeCustSeq']);
  let makerJoinSql = '';
  if (makerSeqOnItem) {
    makerJoinSql = `LEFT JOIN dbo.[_TDACust] mk
      ON h.CompanySeq = mk.CompanySeq
      AND NULLIF(it.${bracketIdent(makerSeqOnItem)}, 0) IS NOT NULL
      AND mk.CustSeq = it.${bracketIdent(makerSeqOnItem)}`;
    makerNameSql = `COALESCE(NULLIF(LTRIM(RTRIM(CAST(mk.CustName AS NVARCHAR(200)))), N''), (${makerNameSql}))`;
  }

  const itemAssetPick = pickFirstExpr(
    itCols,
    ['ItemAssetClassName', 'AssetClassName', 'ItemAssetKindName', 'SMAssetKindName', 'AssetKindName', 'AssetKind'],
    'ItemAsset',
    'it',
  );
  const itemAssetSql = itemAssetPick.replace(' AS ItemAsset', '');

  const validDateCol = pickColumn(itCols, ['ExpiryDate', 'ValidDate', 'UseLimitDate', 'LimitDate', 'ExpiryYmd']);
  const validDateSql = validDateCol
    ? `LTRIM(RTRIM(CAST(it.${bracketIdent(validDateCol)} AS NVARCHAR(30))))`
    : `CAST(NULL AS NVARCHAR(30))`;

  const okQtySql = iColSql(iCols, ['OKQty', 'PassQty', 'GoodQty', 'AcceptQty'], 'CAST(NULL AS decimal(18, 6))');
  const ngQtySql = iColSql(iCols, ['NGQty', 'RejectQty', 'DefectQty', 'BadQty'], 'CAST(NULL AS decimal(18, 6))');
  const ngRetSql = iColSql(iCols, ['NGReturnQty', 'RejectReturnQty', 'DefectReturnQty'], 'CAST(NULL AS decimal(18, 6))');

  const specNoteCol = pickColumn(iCols, ['SpecNote', 'SpecialNote', 'IssueNote', 'AbnormalNote', 'SplRemark']);
  const specialNoteSql = specNoteCol
    ? `LTRIM(RTRIM(CAST(i.${bracketIdent(specNoteCol)} AS NVARCHAR(500))))`
    : `CAST(NULL AS NVARCHAR(500))`;

  const srcMgmtSql = iColSql(
    iCols,
    [
      'SrcMgmtNo',
      'SourceMgmtNo',
      'OriMgmtNo',
      'RootMgmtNo',
      'OrigMgmtNo',
      'RefMgmtNo',
      'CustMgmtNo',
    ],
    'CAST(NULL AS NVARCHAR(80))',
  );
  const srcNoSql = iColSql(
    iCols,
    ['SrcNo', 'SourceNo', 'RefDocNo', 'OriDocNo', 'RootDocNo', 'OrigDocNo', 'CustDocNo', 'RefNo'],
    'CAST(NULL AS NVARCHAR(80))',
  );
  const custLotSql = iColSql(
    iCols,
    ['CustLotNo', 'CustomerLotNo', 'CLotNo', 'UserLotNo', 'CustLOT', 'ExtLotNo'],
    'CAST(NULL AS NVARCHAR(80))',
  );

  const iMod = pickColumn(iCols, [
    'ModDateTime',
    'UpdDateTime',
    'LstUpdDateTime',
    'LastUpdDateTime',
    'LastDateTime',
    'EditDateTime',
    'LastWorkDateTime',
  ]);
  const hMod = pickColumn(hCols, [
    'ModDateTime',
    'UpdDateTime',
    'LstUpdDateTime',
    'LastUpdDateTime',
    'LastDateTime',
    'EditDateTime',
    'InsDateTime',
    'RegDateTime',
  ]);
  const lastWorkSql =
    iMod && hMod
      ? `LTRIM(RTRIM(CONVERT(NVARCHAR(50), COALESCE(i.${bracketIdent(iMod)}, h.${bracketIdent(hMod)}), 120)))`
      : iMod
        ? `LTRIM(RTRIM(CONVERT(NVARCHAR(50), i.${bracketIdent(iMod)}, 120)))`
        : hMod
          ? `LTRIM(RTRIM(CONVERT(NVARCHAR(50), h.${bracketIdent(hMod)}, 120)))`
          : `CAST(NULL AS NVARCHAR(50))`;

  const itemClassLSql = itColSql(
    itCols,
    [
      'ItemLClassName',
      'LargeClassName',
      'LClassName',
      'ItemLargeClassName',
      'ItemKindLName',
      'KindLName',
      'MajorKindName',
      'ItemCatLName',
      'MajorClassName',
      'ClassLName',
    ],
    'CAST(NULL AS NVARCHAR(120))',
  );
  const itemClassMSql = itColSql(
    itCols,
    [
      'ItemMClassName',
      'MidClassName',
      'MClassName',
      'ItemMidClassName',
      'ItemKindMName',
      'KindMName',
      'MidKindName',
      'ItemCatMName',
      'ClassMName',
    ],
    'CAST(NULL AS NVARCHAR(120))',
  );
  const itemClassSSql = itColSql(
    itCols,
    [
      'ItemSClassName',
      'SmallClassName',
      'SClassName',
      'ItemSmallClassName',
      'ItemKindSName',
      'KindSName',
      'MinorKindName',
      'ItemCatSName',
      'ClassSName',
    ],
    'CAST(NULL AS NVARCHAR(120))',
  );

  const lineItemNameSql = iColSql(
    iCols,
    ['ItemName', 'MatName', 'MaterialName', 'LineItemName', 'PurItemName', 'UMItemName', 'OutItemName'],
    'CAST(NULL AS NVARCHAR(500))',
  );
  const itemNameSelectSql = `COALESCE(NULLIF(LTRIM(RTRIM(CAST(it.ItemName AS NVARCHAR(500)))), N''), (${lineItemNameSql}))`;
  const lineItemNoSql = iColSql(
    iCols,
    ['ItemNo', 'MatNo', 'MaterialNo', 'LineItemNo', 'PurItemNo', 'CustItemNo', 'OutItemNo'],
    'CAST(NULL AS NVARCHAR(100))',
  );
  const itemNoSelectSql = `COALESCE(NULLIF(LTRIM(RTRIM(CAST(it.ItemNo AS NVARCHAR(100)))), N''), (${lineItemNoSql}))`;

  logger.log(
    `PU Delv schema: item=${itemTable}, date=${hDate}, no=${hNo}, seq=${hSeq}/${iSeq}, serl=${iSerl}, poJoin=${Boolean(poJoin)}, SMExpKind h=${Boolean(hSmExpKindCol)} i=${Boolean(iSmExpKindCol)}`,
  );

  return {
    itemTable,
    hDate,
    hDateYmdExpr,
    hNo,
    hSeq,
    iSeq,
    iSerl,
    delvKindExpr,
    recvProgExpr,
    lineUnitPriceSql,
    qtySql,
    domAmtSql,
    domVatSql,
    lineTotalSql,
    itemSeqCol,
    whSeqExpr,
    whJoinSql,
    unitJoinSql,
    remarkSelect,
    empJoinSql,
    empSelectSql,
    deptJoinSql,
    deptSelectSql,
    currJoinSql,
    exRateSql,
    poJoin,
    poPurOrderNoSelect,
    poPurOrderDateSelect,
    customerCodeExpr,
    vatInclSql,
    vatRateSql,
    inQtySql,
    inAmtSql,
    inKrwAmtSql,
    locForKindExpr,
    inspKindExpr,
    makerJoinSql,
    makerNameSql,
    itemAssetSql,
    validDateSql,
    okQtySql,
    ngQtySql,
    ngRetSql,
    specialNoteSql,
    srcMgmtSql,
    srcNoSql,
    custLotSql,
    lastWorkSql,
    itemClassLSql,
    itemClassMSql,
    itemClassSSql,
    itemNameSelectSql,
    itemNoSelectSql,
    poiJoinSql,
    srcInquirySql,
    progressInquirySql,
    krwSupplySql,
    krwVatSql,
    krwTotalSql,
    exportExcludeWhereSql,
    smExpKindOnHeader: hSmExpKindCol != null,
    smExpKindOnLine: iSmExpKindCol != null,
  };
}

function buildSelectSql(plan: PuDelvOutSqlPlan, whereTail: string): string {
  const iTbl = bracketIdent(plan.itemTable);
  return `
      SELECT TOP (@fetchCount)
        ${plan.delvKindExpr} AS DelvKindRaw,
        ${plan.recvProgExpr} AS RecvProgRaw,
        h.BizUnit AS BizUnit,
        ${plan.hDateYmdExpr} AS DelvDateRaw,
        CASE
          WHEN LEN(LTRIM(RTRIM(h.${bracketIdent(plan.hNo)}))) = 10 AND LTRIM(RTRIM(h.${bracketIdent(plan.hNo)})) NOT LIKE N'%-%'
            THEN LEFT(LTRIM(RTRIM(h.${bracketIdent(plan.hNo)})), 6) + N'-' + SUBSTRING(LTRIM(RTRIM(h.${bracketIdent(plan.hNo)})), 7, 20)
          ELSE LTRIM(RTRIM(h.${bracketIdent(plan.hNo)}))
        END AS DelvNoFmt,
        ${plan.poPurOrderDateSelect},
        ${plan.poPurOrderNoSelect},
        c.CustName AS CustName,
        ${plan.customerCodeExpr} AS CustomerCodeRaw,
        ${plan.deptSelectSql},
        ${plan.empSelectSql},
        ${plan.inspKindExpr} AS InspKindRaw,
        ${plan.itemNameSelectSql} AS ItemName,
        ${plan.itemNoSelectSql} AS ItemNo,
        it.Spec AS Spec,
        u.UnitName AS UnitName,
        ${plan.lineUnitPriceSql} AS LineUnitPrice,
        ${plan.qtySql} AS Qty,
        ${plan.vatInclSql} AS VATInclRaw,
        ${plan.vatRateSql} AS VATRate,
        ${plan.domAmtSql} AS SupplyAmt,
        ${plan.domVatSql} AS DomVAT,
        ${plan.lineTotalSql} AS LineTotal,
        curr.CurrName AS CurrName,
        curr.CurrNo AS CurrNo,
        ${plan.exRateSql} AS ExRate,
        ${plan.krwSupplySql} AS KrwSupplyAmt,
        ${plan.krwVatSql} AS KrwVatAmt,
        ${plan.krwTotalSql} AS KrwTotalAmt,
        ${plan.inQtySql} AS InQty,
        ${plan.inAmtSql} AS InDomAmt,
        ${plan.inKrwAmtSql} AS InKrwAmt,
        ${plan.locForKindExpr} AS LocForKindRaw,
        wh.WHName AS WHName,
        ${plan.makerNameSql} AS MakerName,
        ${plan.itemAssetSql} AS ItemAssetRaw,
        ${plan.validDateSql} AS ValidDateRaw,
        ${plan.okQtySql} AS OKQty,
        ${plan.ngQtySql} AS NGQty,
        ${plan.ngRetSql} AS NGReturnQty,
        ${plan.specialNoteSql} AS SpecialNote,
        ${plan.remarkSelect},
        ${plan.srcInquirySql} AS SrcInquiry,
        ${plan.progressInquirySql} AS ProgressInquiry,
        ${plan.srcMgmtSql} AS SrcMgmtNo,
        ${plan.srcNoSql} AS SrcNo,
        ${plan.custLotSql} AS CustLotNo,
        ${plan.lastWorkSql} AS LastWorkRaw,
        ${plan.itemClassLSql} AS ItemClassL,
        ${plan.itemClassMSql} AS ItemClassM,
        ${plan.itemClassSSql} AS ItemClassS
      FROM dbo.[_TPUDelv] h
      INNER JOIN dbo.${iTbl} i
        ON h.CompanySeq = i.CompanySeq AND h.${bracketIdent(plan.hSeq)} = i.${bracketIdent(plan.iSeq)}
      LEFT JOIN dbo.[_TDACust] c
        ON h.CompanySeq = c.CompanySeq AND h.CustSeq = c.CustSeq
      LEFT JOIN dbo.[_TDAItem] it
        ON h.CompanySeq = it.CompanySeq AND i.${bracketIdent(plan.itemSeqCol)} = it.ItemSeq
      ${plan.unitJoinSql}
      ${plan.whJoinSql}
      ${plan.empJoinSql}
      ${plan.deptJoinSql}
      ${plan.currJoinSql}
      ${plan.poJoin}
      ${plan.poiJoinSql}
      ${plan.makerJoinSql}
      WHERE ${plan.hDateYmdExpr} >= @fromYmd
        AND ${plan.hDateYmdExpr} <= @toYmd
        ${plan.exportExcludeWhereSql}
        ${whereTail}
      ORDER BY ${plan.hDateYmdExpr} ASC, h.CompanySeq ASC, h.${bracketIdent(plan.hSeq)} ASC, i.${bracketIdent(plan.iSerl)} ASC
    `;
}

@Injectable()
export class ErpPuDelvItemsService {
  private readonly logger = new Logger(ErpPuDelvItemsService.name);
  private pool: mssql.ConnectionPool | null = null;
  private poolPromise: Promise<mssql.ConnectionPool> | null = null;
  private sqlPlan: PuDelvOutSqlPlan | null = null;

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
      this.sqlPlan = null;
      this.logger.log(`ERP MSSQL connected (${host}:${port}/${database})`);
      return pool;
    })().catch((err) => {
      this.poolPromise = null;
      this.pool = null;
      this.sqlPlan = null;
      this.logger.error('ERP MSSQL connection failed', err);
      throw new ServiceUnavailableException(
        'ERP 데이터베이스에 연결할 수 없습니다. 네트워크 및 접속 정보를 확인하세요.',
      );
    });

    return this.poolPromise;
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

  private async getOrBuildSqlPlan(pool: mssql.ConnectionPool): Promise<PuDelvOutSqlPlan> {
    if (this.sqlPlan) {
      return this.sqlPlan;
    }
    this.sqlPlan = await resolveSqlPlan(pool, this.logger);
    return this.sqlPlan;
  }

  async listByDelvDateRange(
    fromIso: string,
    toIso: string,
    limit?: number,
    includeSchemaMeta?: boolean,
  ): Promise<PuDelvItemsListResult> {
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

    const companySeq = this.parseOptionalPositiveInt('ERP_PU_DELV_COMPANY_SEQ', 'ERP_PU_DELV_COMPANY_SEQ');
    const bizUnitFilter = this.parseOptionalPositiveInt('ERP_PU_DELV_BIZ_UNIT', 'ERP_PU_DELV_BIZ_UNIT');

    const pool = await this.getPool();
    const plan = await this.getOrBuildSqlPlan(pool);

    const request = pool.request();
    request.input('fromYmd', mssql.Char(8), fromYmd);
    request.input('toYmd', mssql.Char(8), toYmd);
    request.input('fetchCount', mssql.Int, fetchCount);
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

    const sql = buildSelectSql(plan, whereTail);

    let result: mssql.IResult<SqlRow>;
    try {
      result = await request.query<SqlRow>(sql);
    } catch (err: unknown) {
      this.sqlPlan = null;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`PU Delv query failed: ${msg}`, err instanceof Error ? err.stack : undefined);
      throw new BadRequestException(
        `ERP 조회 쿼리 실행에 실패했습니다. 테이블·컬럼 정의를 확인하세요. (${msg.slice(0, 240)})`,
      );
    }

    const raw = result.recordset ?? [];
    const truncated = raw.length > maxRows;
    const slice = truncated ? raw.slice(0, maxRows) : raw;
    const items = slice.map((r, i) => ({ ...mapRow(r), rowNo: i + 1 }));
    const base: PuDelvItemsListResult = { items, truncated };
    if (includeSchemaMeta) {
      base.schemaMeta = {
        smExpKindOnHeader: plan.smExpKindOnHeader,
        smExpKindOnLine: plan.smExpKindOnLine,
        smExpKindFilterApplied: plan.smExpKindOnHeader || plan.smExpKindOnLine,
      };
    }
    return base;
  }
}
