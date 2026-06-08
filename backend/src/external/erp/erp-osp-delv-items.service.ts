import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mssql from 'mssql';

/**
 * 외주납품 품목 조회 — `dbo._TPDOSPDelv`(없으면 `dbo.TPDOSPDelv`) + `dbo._TPDOSPDelvItem`(없으면 `dbo.TPDOSPDelvItem`).
 * ERP「외주납품품목조회」그리드(납품일·외주처·납품처·품목·금액·발주 등)에 맞춥니다.
 */
export type OspDelvItemRow = {
  rowNo: number;
  status: string | null;
  bizUnit: number | null;
  delvNo: string | null;
  lineSerl: number | null;
  delvDate: string;
  outsourceVendorName: string | null;
  recvVendorName: string | null;
  chargePerson: string | null;
  delvKind: string | null;
  recvProgressStatus: string | null;
  itemCode: string | null;
  itemName: string | null;
  spec: string | null;
  unit: string | null;
  qty: number | null;
  unitPrice: number | null;
  supplyAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  currency: string | null;
  exchangeRate: number | null;
  foreignSupplyAmount: number | null;
  foreignVatAmount: number | null;
  foreignTotalAmount: number | null;
  whName: string | null;
  storageLocation: string | null;
  remark: string | null;
  purOrderNo: string | null;
  purOrderSerl: number | null;
  purOrderDate: string | null;
  regUser: string | null;
  regDateTime: string | null;
};

export type OspDelvItemsSchemaMeta = {
  headerTable: string;
  itemTable: string;
};

export type OspDelvItemsListResult = {
  items: OspDelvItemRow[];
  truncated: boolean;
  schemaMeta?: OspDelvItemsSchemaMeta;
};

type SqlRow = {
  StatusRaw: string | null;
  BizUnit: number | null;
  DelvDateRaw: string | null;
  DelvNoFmt: string | null;
  LineSerl: number | null;
  OutsourceName: string | null;
  RecvName: string | null;
  ChargeEmpName: string | null;
  DelvKindRaw: string | null;
  RecvProgRaw: string | null;
  ItemNo: string | null;
  ItemName: string | null;
  Spec: string | null;
  UnitName: string | null;
  Qty: number | null;
  LineUnitPrice: number | null;
  SupplyAmt: number | null;
  DomVAT: number | null;
  LineTotal: number | null;
  CurrName: string | null;
  CurrNo: string | null;
  ExRate: number | null;
  CurSupply: number | null;
  CurVat: number | null;
  CurTotal: number | null;
  WHName: string | null;
  StorageLoc: string | null;
  LineRemark: string | null;
  LineMemo: string | null;
  PurOrderNo: string | null;
  PurOrderSerl: number | null;
  PurOrderDateRaw: string | null;
  RegEmpName: string | null;
  RegDtRaw: string | null;
};

type OspSqlPlan = {
  headerTable: string;
  itemTable: string;
  hDate: string;
  hNo: string;
  hSeq: string;
  iSeq: string;
  iSerl: string;
  itemSeqCol: string;
  statusSelect: string;
  delvKindExpr: string;
  recvProgExpr: string;
  lineUnitPriceSql: string;
  qtySql: string;
  domAmtSql: string;
  domVatSql: string;
  lineTotalSql: string;
  outCustJoin: string;
  recvCustJoin: string;
  outsourceNameSelect: string;
  recvNameSelect: string;
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
  poSerlSelect: string;
  storageSql: string;
  curSupplySql: string;
  curVatSql: string;
  curTotalSql: string;
  regEmpJoin: string;
  regEmpSelect: string;
  regDtSelect: string;
};

const DEFAULT_LIMIT = 8000;
const MAX_RANGE_DAYS = 400;

function bracketIdent(name: string): string {
  return `[${name.replace(/\]/g, ']]')}]`;
}

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

function ymdOrTextToIsoOrText(d: string | null): string | null {
  const t = trimOrNull(d);
  if (!t) return null;
  if (/^\d{8}$/.test(t)) {
    const iso = yyyymmddToIso(t);
    return iso || t;
  }
  return t;
}

function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapRow(r: SqlRow): Omit<OspDelvItemRow, 'rowNo'> {
  const remark = trimOrNull(r.LineRemark) ?? trimOrNull(r.LineMemo);
  return {
    status: trimOrNull(r.StatusRaw),
    bizUnit: r.BizUnit == null ? null : Number(r.BizUnit),
    delvNo: trimOrNull(r.DelvNoFmt),
    lineSerl: r.LineSerl == null ? null : Number(r.LineSerl),
    delvDate: yyyymmddToIso(r.DelvDateRaw),
    outsourceVendorName: trimOrNull(r.OutsourceName),
    recvVendorName: trimOrNull(r.RecvName),
    chargePerson: trimOrNull(r.ChargeEmpName),
    delvKind: trimOrNull(r.DelvKindRaw),
    recvProgressStatus: trimOrNull(r.RecvProgRaw),
    itemCode: trimOrNull(r.ItemNo),
    itemName: trimOrNull(r.ItemName),
    spec: trimOrNull(r.Spec),
    unit: trimOrNull(r.UnitName),
    qty: toNumber(r.Qty),
    unitPrice: toNumber(r.LineUnitPrice),
    supplyAmount: toNumber(r.SupplyAmt),
    vatAmount: toNumber(r.DomVAT),
    totalAmount: toNumber(r.LineTotal),
    currency: trimOrNull(r.CurrName) ?? trimOrNull(r.CurrNo),
    exchangeRate: toNumber(r.ExRate),
    foreignSupplyAmount: toNumber(r.CurSupply),
    foreignVatAmount: toNumber(r.CurVat),
    foreignTotalAmount: toNumber(r.CurTotal),
    whName: trimOrNull(r.WHName),
    storageLocation: trimOrNull(r.StorageLoc),
    remark,
    purOrderNo: trimOrNull(r.PurOrderNo),
    purOrderSerl: r.PurOrderSerl == null ? null : Number(r.PurOrderSerl),
    purOrderDate: ymdOrTextToIsoOrText(r.PurOrderDateRaw),
    regUser: trimOrNull(r.RegEmpName),
    regDateTime: trimOrNull(r.RegDtRaw),
  };
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

async function listColumns(pool: mssql.ConnectionPool, tableName: string): Promise<{ COLUMN_NAME: string }[]> {
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

function iColSql(iCols: { COLUMN_NAME: string }[], candidates: string[], sqlNull: string): string {
  const c = pickColumn(iCols, candidates);
  return c ? `i.${bracketIdent(c)}` : sqlNull;
}

function hColSql(hCols: { COLUMN_NAME: string }[], candidates: string[], sqlNull: string): string {
  const c = pickColumn(hCols, candidates);
  return c ? `h.${bracketIdent(c)}` : sqlNull;
}

function buildLineUnitPriceSql(iCols: { COLUMN_NAME: string }[]): string {
  const order = ['CustPrice', 'ItemPrice', 'Price', 'UnitPrice', 'OSPDelvPrice', 'DelvPrice', 'NetPrice'];
  const found: string[] = [];
  for (const o of order) {
    const c = pickColumn(iCols, [o]);
    if (c) found.push(c);
  }
  if (found.length === 0) return 'CAST(NULL AS decimal(18, 6))';
  if (found.length === 1) return `i.${bracketIdent(found[0])}`;
  const lead = found.slice(0, -1).map((c) => `NULLIF(i.${bracketIdent(c)}, 0)`);
  const last = found[found.length - 1];
  return `COALESCE(${[...lead, `i.${bracketIdent(last)}`].join(', ')})`;
}

function pickFirstExpr(
  rows: { COLUMN_NAME: string }[],
  candidates: string[],
  alias: string,
  tableAlias: string,
): string {
  const col = pickColumn(rows, candidates);
  if (!col) {
    return `CAST(NULL AS NVARCHAR(120)) AS ${alias}`;
  }
  return `LTRIM(RTRIM(CAST(${tableAlias}.${bracketIdent(col)} AS NVARCHAR(120)))) AS ${alias}`;
}

async function resolveOspSqlPlan(pool: mssql.ConnectionPool, logger: Logger): Promise<OspSqlPlan> {
  /** ERP 실무·문서 기준으로 언더스코어 테이블(`_TPDOSPDelv`)을 우선(없으면 `TPDOSPDelv`). */
  let headerTable = '_TPDOSPDelv';
  if (!(await tableExists(pool, headerTable))) {
    headerTable = 'TPDOSPDelv';
  }
  if (!(await tableExists(pool, headerTable))) {
    throw new ServiceUnavailableException('ERP에 dbo._TPDOSPDelv 또는 dbo.TPDOSPDelv 헤더 테이블이 없습니다.');
  }

  let itemTable = '_TPDOSPDelvItem';
  if (!(await tableExists(pool, itemTable))) {
    itemTable = 'TPDOSPDelvItem';
  }
  if (!(await tableExists(pool, itemTable))) {
    throw new ServiceUnavailableException('ERP에 dbo._TPDOSPDelvItem 또는 dbo.TPDOSPDelvItem 라인 테이블이 없습니다.');
  }

  const hCols = await listColumns(pool, headerTable);
  const iCols = await listColumns(pool, itemTable);
  const itCols = await listColumns(pool, '_TDAItem');

  const hDate =
    pickColumn(hCols, [
      'OSPDelvDate',
      'DelvDate',
      'PUDelvDate',
      'ShipDate',
      'OutDate',
      'DeliveryDate',
      'DelvOutDate',
      'DocDate',
    ]) ??
    (() => {
      throw new ServiceUnavailableException(`${headerTable}에서 납품일 컬럼을 찾을 수 없습니다.`);
    })();

  const hNo =
    pickColumn(hCols, ['OSPDelvNo', 'DelvNo', 'PUDelvNo', 'DelvOutNo', 'ShipNo', 'DocNo']) ??
    (() => {
      throw new ServiceUnavailableException(`${headerTable}에서 납품번호 컬럼을 찾을 수 없습니다.`);
    })();

  const hSeq =
    pickColumn(hCols, ['OSPDelvSeq', 'DelvSeq', 'PUDelvSeq', 'PUDelvOutSeq', 'ShipSeq', 'DocSeq']) ??
    (() => {
      throw new ServiceUnavailableException(`${headerTable}에서 문서키 컬럼을 찾을 수 없습니다.`);
    })();

  const iSeq = pickColumn(iCols, [hSeq, 'OSPDelvSeq', 'DelvSeq', 'PUDelvSeq', 'ShipSeq', 'DocSeq']);
  if (!iSeq) {
    throw new ServiceUnavailableException(`${itemTable}에 헤더와 조인할 키 컬럼을 찾을 수 없습니다.`);
  }

  const iSerl =
    pickColumn(iCols, ['OSPDelvSerl', 'DelvSerl', 'DelSerl', 'LineSerl', 'ItemSerl', 'DelvItemSerl', 'Serl']) ??
    (() => {
      throw new ServiceUnavailableException(`${itemTable}에 순번 컬럼을 찾을 수 없습니다.`);
    })();

  const statusPick = pickFirstExpr(
    hCols,
    ['SlipStat', 'Status', 'DocStatus', 'DelvStatus', 'ProgressStat', 'OSPDelvStatus'],
    'StatusRaw',
    'h',
  );
  const statusSelect = statusPick;

  const delvKindPick = pickFirstExpr(
    hCols,
    ['SMDelvKind', 'UMDelvKind', 'DelvKind', 'OSPDelvKind', 'DelvKindCd', 'PUDelvKind'],
    'DelvKind',
    'h',
  );
  const delvKindExpr = delvKindPick.replace(' AS DelvKind', '');

  const recvProgPick = pickFirstExpr(
    hCols,
    ['SMRecvStatus', 'RecvProgStatus', 'InProgStatus', 'DelvInProgStatus', 'UMDelvInKind', 'SMDelvStatus'],
    'RecvProg',
    'h',
  );
  const recvProgExpr = recvProgPick.replace(' AS RecvProg', '');

  const itemSeqCol =
    pickColumn(iCols, ['ItemSeq', 'MatSeq', 'MaterialSeq']) ??
    (() => {
      throw new ServiceUnavailableException(`${itemTable}에 ItemSeq 등 품목 연결 컬럼이 없습니다.`);
    })();

  const lineUnitPriceSql = buildLineUnitPriceSql(iCols);
  const qtySql = iColSql(iCols, ['Qty', 'DelvQty', 'ShipQty', 'OSPDelvQty', 'OutQty'], 'CAST(NULL AS decimal(18, 6))');
  const domAmtSql = iColSql(
    iCols,
    ['DomAmt', 'SupplyAmt', 'SplyAmt', 'SupplyAmount', 'DomSupplyAmt'],
    'CAST(NULL AS decimal(18, 4))',
  );
  const domVatSql = iColSql(iCols, ['DomVAT', 'VAT', 'VATAmt', 'TaxAmt'], 'CAST(NULL AS decimal(18, 4))');
  const lineTotalSql = `CAST(ISNULL((${domAmtSql}), 0) + ISNULL((${domVatSql}), 0) AS decimal(18, 4))`;

  const outCustSeq = pickColumn(hCols, [
    'OutCustSeq',
    'OSPCustSeq',
    'SubCustSeq',
    'SubconCustSeq',
    'VendorCustSeq',
    'OutVendorCustSeq',
    'PartnerCustSeq',
  ]);
  const recvCustSeq = pickColumn(hCols, [
    'RecvCustSeq',
    'ShipToCustSeq',
    'DelvCustSeq',
    'RecvVendorSeq',
    'CustSeq',
  ]);

  let outCustJoin = `LEFT JOIN dbo.[_TDACust] oCust ON 1 = 0`;
  let outsourceNameSelect = `CAST(NULL AS NVARCHAR(200)) AS OutsourceName`;
  if (outCustSeq) {
    outCustJoin = `LEFT JOIN dbo.[_TDACust] oCust ON h.CompanySeq = oCust.CompanySeq AND h.${bracketIdent(outCustSeq)} = oCust.CustSeq`;
    outsourceNameSelect = `LTRIM(RTRIM(CAST(oCust.CustName AS NVARCHAR(200)))) AS OutsourceName`;
  }

  let recvCustJoin = `LEFT JOIN dbo.[_TDACust] rCust ON 1 = 0`;
  let recvNameSelect = `CAST(NULL AS NVARCHAR(200)) AS RecvName`;
  if (recvCustSeq) {
    recvCustJoin = `LEFT JOIN dbo.[_TDACust] rCust ON h.CompanySeq = rCust.CompanySeq AND h.${bracketIdent(recvCustSeq)} = rCust.CustSeq`;
    recvNameSelect = `LTRIM(RTRIM(CAST(rCust.CustName AS NVARCHAR(200)))) AS RecvName`;
  }

  const iWh = pickColumn(iCols, ['WHSeq', 'OutWHSeq', 'WarehouseSeq', 'StkWHSeq']);
  const hWh = pickColumn(hCols, ['WHSeq', 'OutWHSeq', 'ShipWHSeq']);
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

  const unitSeqCol = pickColumn(iCols, ['UnitSeq', 'PurUnitSeq']);
  const unitJoinSql =
    unitSeqCol != null
      ? `LEFT JOIN dbo.[_TDAUnit] u
        ON h.CompanySeq = u.CompanySeq AND u.UnitSeq = COALESCE(NULLIF(i.${bracketIdent(unitSeqCol)}, 0), it.UnitSeq)`
      : `LEFT JOIN dbo.[_TDAUnit] u ON h.CompanySeq = u.CompanySeq AND u.UnitSeq = it.UnitSeq`;

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
      ? `LEFT JOIN dbo.[_TDACurr] curr ON h.CompanySeq = curr.CompanySeq AND curr.CurrSeq = ${curSeqExpr}`
      : `LEFT JOIN dbo.[_TDACurr] curr ON 1 = 0`;

  const exRateSql = `COALESCE(${iColSql(iCols, ['ExRate', 'ExchRate', 'ExchangeRate'], 'CAST(NULL AS decimal(18, 6))')}, ${hColSql(hCols, ['ExRate', 'ExchRate', 'ExchangeRate'], 'CAST(NULL AS decimal(18, 6))')})`;

  const iPurOrderSeq = pickColumn(iCols, ['PurOrderSeq', 'POSeq', 'PurOrdSeq', 'OrderSeq']);
  const iPurOrderNoLine = pickColumn(iCols, ['PurOrderNo', 'PONo', 'OrderNo']);
  const iPurOrderSerl = pickColumn(iCols, ['PurOrderSerl', 'POSerl', 'OrderSerl', 'PurOrdSerl']);

  const existsPoU = await tableExists(pool, '_TPUPurOrder');
  const existsPoP = await tableExists(pool, 'TPUPurOrder');
  const existsOspPoU = await tableExists(pool, '_TPOSPPurOrder');
  const existsOspPoP = await tableExists(pool, 'TPOSPPurOrder');
  let poTable = '';
  if (existsOspPoU) {
    poTable = '_TPOSPPurOrder';
  } else if (existsOspPoP) {
    poTable = 'TPOSPPurOrder';
  } else if (existsPoU) {
    poTable = '_TPUPurOrder';
  } else if (existsPoP) {
    poTable = 'TPUPurOrder';
  }
  const poCols = poTable ? await listColumns(pool, poTable) : [];
  const poSeq = poTable ? pickColumn(poCols, ['PurOrderSeq', 'POSeq', 'OrderSeq', 'OSPPurOrderSeq']) : null;
  const poNo = poTable ? pickColumn(poCols, ['PurOrderNo', 'PONo', 'OrderNo', 'OSPPurOrderNo']) : null;
  const poDateCol = poTable
    ? pickColumn(poCols, ['PurOrdDate', 'POrdDate', 'OrdDate', 'OrderDate', 'PurDate', 'PODate', 'PurOrderDate'])
    : null;

  let poJoin = '';
  let poPurOrderNoSelect = `CAST(NULL AS NVARCHAR(60)) AS PurOrderNo`;
  let poPurOrderDateSelect = `CAST(NULL AS NVARCHAR(30)) AS PurOrderDateRaw`;
  let poSerlSelect = `CAST(NULL AS INT) AS PurOrderSerl`;
  if (poTable && poSeq && poNo && iPurOrderSeq) {
    const pTbl = bracketIdent(poTable);
    poJoin = `LEFT JOIN dbo.${pTbl} po
        ON h.CompanySeq = po.CompanySeq
        AND NULLIF(i.${bracketIdent(iPurOrderSeq)}, 0) IS NOT NULL
        AND po.${bracketIdent(poSeq)} = i.${bracketIdent(iPurOrderSeq)}`;
    poPurOrderNoSelect = `COALESCE(
          NULLIF(LTRIM(RTRIM(po.${bracketIdent(poNo)})), N''),
          CASE WHEN NULLIF(i.${bracketIdent(iPurOrderSeq)}, 0) IS NULL THEN NULL
            ELSE LTRIM(RTRIM(CAST(i.${bracketIdent(iPurOrderSeq)} AS NVARCHAR(30)))) END
        ) AS PurOrderNo`;
    if (poDateCol) {
      poPurOrderDateSelect = `LTRIM(RTRIM(CAST(po.${bracketIdent(poDateCol)} AS NVARCHAR(30)))) AS PurOrderDateRaw`;
    }
  } else if (iPurOrderNoLine) {
    poPurOrderNoSelect = `NULLIF(LTRIM(RTRIM(i.${bracketIdent(iPurOrderNoLine)})), N'') AS PurOrderNo`;
  }
  if (iPurOrderSerl) {
    poSerlSelect = `TRY_CAST(i.${bracketIdent(iPurOrderSerl)} AS INT) AS PurOrderSerl`;
  }

  const storICol = pickColumn(iCols, ['StorLocName', 'StorageLoc', 'KeepPlace', 'BinLoc', 'LocName', 'ZoneName']);
  const storHCol = pickColumn(hCols, ['StorLocName', 'StorageLoc', 'KeepPlace', 'BinLoc']);
  let storageSql = `CAST(NULL AS NVARCHAR(200)) AS StorageLoc`;
  if (storICol) {
    storageSql = `LTRIM(RTRIM(CAST(i.${bracketIdent(storICol)} AS NVARCHAR(200)))) AS StorageLoc`;
  } else if (storHCol) {
    storageSql = `LTRIM(RTRIM(CAST(h.${bracketIdent(storHCol)} AS NVARCHAR(200)))) AS StorageLoc`;
  }

  const curSupplySql = iColSql(iCols, ['CurAmt', 'FCurSupplyAmt', 'ForeignSupplyAmt', 'CurSupplyAmt'], 'CAST(NULL AS decimal(18, 4))');
  const curVatSql = iColSql(iCols, ['CurVAT', 'FCurVatAmt', 'ForeignVatAmt'], 'CAST(NULL AS decimal(18, 4))');
  const curTotalSql = iColSql(iCols, ['CurTotalAmt', 'FCurTotalAmt', 'ForeignTotalAmt'], 'CAST(NULL AS decimal(18, 4))');

  const regEmpSeq = pickColumn(hCols, ['RegEmpSeq', 'InsEmpSeq', 'InputEmpSeq', 'InsertEmpSeq']);
  const regEmpJoin = regEmpSeq
    ? `LEFT JOIN dbo.[_TDAEmp] regEmp ON h.CompanySeq = regEmp.CompanySeq AND h.${bracketIdent(regEmpSeq)} = regEmp.EmpSeq`
    : `LEFT JOIN dbo.[_TDAEmp] regEmp ON 1 = 0`;
  const regEmpSelect = regEmpSeq ? `regEmp.EmpName AS RegEmpName` : `CAST(NULL AS NVARCHAR(100)) AS RegEmpName`;

  const regDtCol = pickColumn(hCols, ['InsDateTime', 'RegDateTime', 'InputDateTime', 'InsertDateTime', 'CrtDateTime']);
  const regDtSelect = regDtCol
    ? `LTRIM(RTRIM(CONVERT(NVARCHAR(50), h.${bracketIdent(regDtCol)}, 120))) AS RegDtRaw`
    : `CAST(NULL AS NVARCHAR(50)) AS RegDtRaw`;

  logger.log(
    `OSP Delv schema: header=${headerTable}, item=${itemTable}, date=${hDate}, no=${hNo}, seq=${hSeq}/${iSeq}, serl=${iSerl}, po=${poTable || '(none)'}`,
  );

  return {
    headerTable,
    itemTable,
    hDate,
    hNo,
    hSeq,
    iSeq,
    iSerl,
    itemSeqCol,
    statusSelect,
    delvKindExpr,
    recvProgExpr,
    lineUnitPriceSql,
    qtySql,
    domAmtSql,
    domVatSql,
    lineTotalSql,
    outCustJoin,
    recvCustJoin,
    outsourceNameSelect,
    recvNameSelect,
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
    poSerlSelect,
    storageSql,
    curSupplySql,
    curVatSql,
    curTotalSql,
    regEmpJoin,
    regEmpSelect,
    regDtSelect,
  };
}

function buildSelectSql(plan: OspSqlPlan, whereTail: string): string {
  const hTbl = bracketIdent(plan.headerTable);
  const iTbl = bracketIdent(plan.itemTable);
  return `
      SELECT TOP (@fetchCount)
        ${plan.statusSelect},
        h.BizUnit AS BizUnit,
        LTRIM(RTRIM(h.${bracketIdent(plan.hDate)})) AS DelvDateRaw,
        CASE
          WHEN LEN(LTRIM(RTRIM(h.${bracketIdent(plan.hNo)}))) = 10 AND LTRIM(RTRIM(h.${bracketIdent(plan.hNo)})) NOT LIKE N'%-%'
            THEN LEFT(LTRIM(RTRIM(h.${bracketIdent(plan.hNo)})), 6) + N'-' + SUBSTRING(LTRIM(RTRIM(h.${bracketIdent(plan.hNo)})), 7, 20)
          ELSE LTRIM(RTRIM(h.${bracketIdent(plan.hNo)}))
        END AS DelvNoFmt,
        TRY_CAST(i.${bracketIdent(plan.iSerl)} AS INT) AS LineSerl,
        ${plan.outsourceNameSelect},
        ${plan.recvNameSelect},
        ${plan.empSelectSql},
        ${plan.delvKindExpr} AS DelvKindRaw,
        ${plan.recvProgExpr} AS RecvProgRaw,
        it.ItemNo AS ItemNo,
        it.ItemName AS ItemName,
        it.Spec AS Spec,
        u.UnitName AS UnitName,
        ${plan.qtySql} AS Qty,
        ${plan.lineUnitPriceSql} AS LineUnitPrice,
        ${plan.domAmtSql} AS SupplyAmt,
        ${plan.domVatSql} AS DomVAT,
        ${plan.lineTotalSql} AS LineTotal,
        curr.CurrName AS CurrName,
        curr.CurrNo AS CurrNo,
        ${plan.exRateSql} AS ExRate,
        ${plan.curSupplySql} AS CurSupply,
        ${plan.curVatSql} AS CurVat,
        ${plan.curTotalSql} AS CurTotal,
        wh.WHName AS WHName,
        ${plan.storageSql},
        ${plan.remarkSelect},
        ${plan.poPurOrderNoSelect},
        ${plan.poPurOrderDateSelect},
        ${plan.poSerlSelect},
        ${plan.regEmpSelect},
        ${plan.regDtSelect}
      FROM dbo.${hTbl} h
      INNER JOIN dbo.${iTbl} i
        ON h.CompanySeq = i.CompanySeq AND h.${bracketIdent(plan.hSeq)} = i.${bracketIdent(plan.iSeq)}
      ${plan.outCustJoin}
      ${plan.recvCustJoin}
      LEFT JOIN dbo.[_TDAItem] it
        ON h.CompanySeq = it.CompanySeq AND i.${bracketIdent(plan.itemSeqCol)} = it.ItemSeq
      ${plan.unitJoinSql}
      ${plan.whJoinSql}
      ${plan.empJoinSql}
      ${plan.deptJoinSql}
      ${plan.currJoinSql}
      ${plan.poJoin}
      ${plan.regEmpJoin}
      WHERE LTRIM(RTRIM(h.${bracketIdent(plan.hDate)})) >= @fromYmd
        AND LTRIM(RTRIM(h.${bracketIdent(plan.hDate)})) <= @toYmd
        ${whereTail}
      ORDER BY LTRIM(RTRIM(h.${bracketIdent(plan.hDate)})) ASC, h.CompanySeq ASC, h.${bracketIdent(plan.hSeq)} ASC, i.${bracketIdent(plan.iSerl)} ASC
    `;
}

@Injectable()
export class ErpOspDelvItemsService {
  private readonly logger = new Logger(ErpOspDelvItemsService.name);
  private pool: mssql.ConnectionPool | null = null;
  private poolPromise: Promise<mssql.ConnectionPool> | null = null;
  private sqlPlan: OspSqlPlan | null = null;

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
    const trustServerCertificate = this.config.get<string>('ERP_MSSQL_TRUST_SERVER_CERT') !== 'false';

    this.poolPromise = (async () => {
      const pool = new mssql.ConnectionPool({
        server: host,
        port,
        database,
        user,
        password,
        options: { encrypt, trustServerCertificate },
        connectionTimeout: 30_000,
        requestTimeout: 120_000,
      });
      await pool.connect();
      this.pool = pool;
      this.sqlPlan = null;
      this.logger.log(`ERP MSSQL connected (OSP delv) (${host}:${port}/${database})`);
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

  private async ensurePlan(pool: mssql.ConnectionPool): Promise<OspSqlPlan> {
    if (this.sqlPlan) {
      return this.sqlPlan;
    }
    this.sqlPlan = await resolveOspSqlPlan(pool, this.logger);
    return this.sqlPlan;
  }

  async listByDelvDateRange(
    fromIso: string,
    toIso: string,
    limit?: number,
    schemaMeta?: boolean,
  ): Promise<OspDelvItemsListResult> {
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
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86400_000) {
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

    let companySeq = this.parseOptionalPositiveInt('ERP_OSP_DELV_COMPANY_SEQ', 'ERP_OSP_DELV_COMPANY_SEQ');
    if (companySeq == null) {
      companySeq = this.parseOptionalPositiveInt('ERP_PU_DELV_COMPANY_SEQ', 'ERP_PU_DELV_COMPANY_SEQ');
    }
    let bizUnitFilter = this.parseOptionalPositiveInt('ERP_OSP_DELV_BIZ_UNIT', 'ERP_OSP_DELV_BIZ_UNIT');
    if (bizUnitFilter == null) {
      bizUnitFilter = this.parseOptionalPositiveInt('ERP_PU_DELV_BIZ_UNIT', 'ERP_PU_DELV_BIZ_UNIT');
    }

    const pool = await this.getPool();
    const plan = await this.ensurePlan(pool);

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
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`OSP delv items query failed: ${msg}`);
      throw new BadRequestException(`ERP 외주납품 품목 조회에 실패했습니다. (${msg})`);
    }

    const raw = result.recordset ?? [];
    const truncated = raw.length > maxRows;
    const slice = truncated ? raw.slice(0, maxRows) : raw;
    const items = slice.map((r, i) => ({ ...mapRow(r), rowNo: i + 1 }));

    const out: OspDelvItemsListResult = { items, truncated };
    if (schemaMeta) {
      out.schemaMeta = { headerTable: plan.headerTable, itemTable: plan.itemTable };
    }
    return out;
  }
}
