import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mssql from 'mssql';

/**
 * 외주입고/반품 품목 조회 (엑셀「외주입고_반품품목조회」열 순)
 * `dbo._TPDOSPDelvIn`(없으면 `dbo.TPDOSPDelvIn`) + 라인(`_TPDOSPDelvInItem` 또는 `TPDOSPDelvInItem`) — 컬럼명은 INFORMATION_SCHEMA로 감지합니다.
 */
export type OspDelvInItemRow = {
  /** 조회 결과 표시 순번(1부터) */
  rowNo: number;
  bizUnit: number | null;
  receiptDate: string;
  receiptNo: string | null;
  lineSerl: number | null;
  customerCode: string | null;
  customerName: string | null;
  receiptKind: string | null;
  /** 입고부서 */
  deptName: string | null;
  /** 입고담당자 */
  inChargeEmpName: string | null;
  whCode: number | null;
  whName: string | null;
  itemCode: string | null;
  itemName: string | null;
  spec: string | null;
  unit: string | null;
  managementUnit: string | null;
  qty: number | null;
  unitPrice: number | null;
  foreignUnitPrice: number | null;
  supplyAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  foreignAmount: number | null;
  projectCode: string | null;
  projectName: string | null;
  purOrderNo: string | null;
  purOrderSerl: number | null;
  inspectionNo: string | null;
  inspectionSerl: number | null;
  remark: string | null;
  assetKind: string | null;
  /** 외주지시번호 */
  ospInstructionNo: string | null;
  /** 외주공정 */
  ospProcessName: string | null;
  /** 특이사항 */
  specialNote: string | null;
  lotNo: string | null;
  /** 차수 */
  lineDegree: number | null;
  /** 부가세포함여부(ERP 코드·숫자 그대로) */
  vatIncludedFlag: string | null;
  /** 자재투입여부 */
  matInputYn: string | null;
  /** 원자재단가 */
  rawMatUnitPrice: number | null;
  itemCatLarge: string | null;
  itemCatMid: string | null;
  itemCatSmall: string | null;
  /** 최종작성일시(문자열) */
  lastModifiedAt: string | null;
  /** 최종작성자 */
  lastWriterName: string | null;
  /** 전표번호 */
  slipNo: string | null;
};

type SqlRow = {
  BizUnit: number | null;
  DelvInDateRaw: string | null;
  DelvInNoFmt: string | null;
  DelvInSerl: number | null;
  CustNo: string | null;
  CustName: string | null;
  ReceiptKind: string | null;
  DeptName: string | null;
  InChargeEmpName: string | null;
  WHSeq: number | null;
  WHName: string | null;
  ItemNo: string | null;
  ItemName: string | null;
  Spec: string | null;
  UnitName: string | null;
  StdUnitName: string | null;
  Qty: number | null;
  LineUnitPrice: number | null;
  ForeignUnitPrice: number | null;
  DomAmt: number | null;
  DomVAT: number | null;
  LineTotal: number | null;
  CurAmt: number | null;
  PJTNo: string | null;
  PJTName: string | null;
  PurOrderNo: string | null;
  PurOrderSerl: number | null;
  InspectionNo: string | null;
  InspectionSerl: number | null;
  LineRemark: string | null;
  LineMemo: string | null;
  AssetKind: string | null;
  OspInstructionNo: string | null;
  OspProcessName: string | null;
  SpecialNote: string | null;
  LotNo: string | null;
  LineDegree: number | null;
  VatInclFlag: string | number | null;
  MatInputYn: string | number | null;
  RawMatUnitPrice: number | null;
  ItemCatL: string | null;
  ItemCatM: string | null;
  ItemCatS: string | null;
  LastModRaw: string | null;
  LastWriterName: string | null;
  SlipNo: string | null;
};

/** 동적 SQL에 넣을 식별자(화이트리스트에서만 선택) */
type OspDelvInSqlPlan = {
  headerTable: string;
  itemTable: string;
  hDate: string;
  hDateYmdExpr: string;
  hNo: string;
  hSeq: string;
  iSeq: string;
  iSerl: string;
  hReceiptKindExpr: string;
  iPurOrderSeq: string | null;
  iPurOrderSerl: string | null;
  iPurOrderNoLine: string | null;
  poJoin: string;
  poPurOrderNoSelect: string;
  iQcInspSeq: string | null;
  iQcInspSerl: string | null;
  iAssetKindExpr: string;
  remarkSelect: string;
  stdUnitSeqCol: string | null;
  /** 라인/헤더에서 선택한 식 (SELECT·JOIN용) */
  lineUnitPriceSql: string;
  qtySql: string;
  domAmtSql: string;
  domVatSql: string;
  curAmtSql: string;
  foreignUnitPriceSql: string;
  lineTotalSql: string;
  itemSeqCol: string;
  whSeqExpr: string;
  whJoinSql: string;
  unitJoinSql: string;
  pjtJoinSql: string;
  deptJoinSql: string;
  deptNameSelect: string;
  inEmpJoinSql: string;
  inEmpNameSelect: string;
  lastWriterJoinSql: string;
  lastWriterNameSelect: string;
  lastModSelect: string;
  slipNoSelect: string;
  inKindApplySql: string;
  receiptKindSelectSql: string;
  itemNameExprSql: string;
  itemNoExprSql: string;
  ospInstrExprSql: string;
  ospProcExprSql: string;
  specialNoteExprSql: string;
  lotNoExprSql: string;
  degreeExprSql: string;
  vatInclExprSql: string;
  matInputExprSql: string;
  rawMatPriceExprSql: string;
  itemCatLExprSql: string;
  itemCatMExprSql: string;
  itemCatSExprSql: string;
  /** 라인 OSPWOSeq 등 → 작업지시 마스터에서 번호 문자열 조회 */
  ospWorkOrdJoinSql: string;
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

function mapRow(r: SqlRow): Omit<OspDelvInItemRow, 'rowNo'> {
  const vatIncl = r.VatInclFlag;
  const matIn = r.MatInputYn;
  return {
    bizUnit: r.BizUnit == null ? null : Number(r.BizUnit),
    receiptDate: yyyymmddToIso(r.DelvInDateRaw),
    receiptNo: trimOrNull(r.DelvInNoFmt),
    lineSerl: r.DelvInSerl == null ? null : Number(r.DelvInSerl),
    customerCode: trimOrNull(r.CustNo),
    customerName: trimOrNull(r.CustName),
    receiptKind: trimOrNull(r.ReceiptKind),
    deptName: trimOrNull(r.DeptName),
    inChargeEmpName: trimOrNull(r.InChargeEmpName),
    whCode: r.WHSeq == null ? null : Number(r.WHSeq),
    whName: trimOrNull(r.WHName),
    itemCode: trimOrNull(r.ItemNo),
    itemName: trimOrNull(r.ItemName),
    spec: trimOrNull(r.Spec),
    unit: trimOrNull(r.UnitName),
    managementUnit: trimOrNull(r.StdUnitName),
    qty: toNumber(r.Qty),
    unitPrice: toNumber(r.LineUnitPrice),
    foreignUnitPrice: toNumber(r.ForeignUnitPrice),
    supplyAmount: toNumber(r.DomAmt),
    vatAmount: toNumber(r.DomVAT),
    totalAmount: toNumber(r.LineTotal),
    foreignAmount: toNumber(r.CurAmt),
    projectCode: trimOrNull(r.PJTNo),
    projectName: trimOrNull(r.PJTName),
    purOrderNo: trimOrNull(r.PurOrderNo),
    purOrderSerl: r.PurOrderSerl == null ? null : Number(r.PurOrderSerl),
    inspectionNo: trimOrNull(r.InspectionNo),
    inspectionSerl: r.InspectionSerl == null ? null : Number(r.InspectionSerl),
    remark: trimOrNull(r.LineRemark) ?? trimOrNull(r.LineMemo),
    assetKind: trimOrNull(r.AssetKind),
    ospInstructionNo: trimOrNull(r.OspInstructionNo),
    ospProcessName: trimOrNull(r.OspProcessName),
    specialNote: trimOrNull(r.SpecialNote),
    lotNo: trimOrNull(r.LotNo),
    lineDegree: r.LineDegree == null ? null : Number(r.LineDegree),
    vatIncludedFlag: vatIncl == null || vatIncl === '' ? null : String(vatIncl).trim(),
    matInputYn: matIn == null || matIn === '' ? null : String(matIn).trim(),
    rawMatUnitPrice: toNumber(r.RawMatUnitPrice),
    itemCatLarge: trimOrNull(r.ItemCatL),
    itemCatMid: trimOrNull(r.ItemCatM),
    itemCatSmall: trimOrNull(r.ItemCatS),
    lastModifiedAt: trimOrNull(r.LastModRaw),
    lastWriterName: trimOrNull(r.LastWriterName),
    slipNo: trimOrNull(r.SlipNo),
  };
}

const DEFAULT_LIMIT = 8000;
const MAX_RANGE_DAYS = 400;

function bracketIdent(name: string): string {
  return `[${name.replace(/\]/g, ']]')}]`;
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

/** 입고일을 YYYYMMDD 8자로 정규화(datetime·문자·숫자 혼용 대응) */
function buildHDateYmdExpr(hDate: string): string {
  const hc = `h.${bracketIdent(hDate)}`;
  return `CASE
    WHEN TRY_CONVERT(datetime, ${hc}, 112) IS NOT NULL THEN CONVERT(CHAR(8), TRY_CONVERT(datetime, ${hc}, 112), 112)
    WHEN TRY_CONVERT(datetime, ${hc}) IS NOT NULL THEN CONVERT(CHAR(8), TRY_CONVERT(datetime, ${hc}), 112)
    ELSE RIGHT(N'00000000' + LTRIM(RTRIM(CAST(${hc} AS NVARCHAR(30)))), 8)
  END`;
}

function buildCoalesceOspLineString(
  iCols: { COLUMN_NAME: string }[],
  candidates: string[],
  fallbackSql: string,
): string {
  const parts: string[] = [];
  for (const name of candidates) {
    const c = pickColumn(iCols, [name]);
    if (c) {
      parts.push(`NULLIF(LTRIM(RTRIM(CAST(i.${bracketIdent(c)} AS NVARCHAR(500)))), N'')`);
    }
  }
  if (parts.length === 0) {
    return fallbackSql;
  }
  return `COALESCE(${parts.join(', ')}, ${fallbackSql})`;
}

function buildFirstLineStringExpr(
  iCols: { COLUMN_NAME: string }[],
  candidates: string[],
  sqlNull: string,
): string {
  for (const name of candidates) {
    const c = pickColumn(iCols, [name]);
    if (c) {
      return `LTRIM(RTRIM(CAST(i.${bracketIdent(c)} AS NVARCHAR(500))))`;
    }
  }
  return sqlNull;
}

function buildFirstLineIntExpr(iCols: { COLUMN_NAME: string }[], candidates: string[], sqlNull: string): string {
  for (const name of candidates) {
    const c = pickColumn(iCols, [name]);
    if (c) {
      return `TRY_CAST(i.${bracketIdent(c)} AS INT)`;
    }
  }
  return sqlNull;
}

/** 작업지시번호: 라인(i) 후보 → 헤더(h) 후보 순 COALESCE */
function buildWorkInstructionNoSql(hCols: { COLUMN_NAME: string }[], iCols: { COLUMN_NAME: string }[]): string {
  const lineCandidates = [
    'OSPIOrderNo',
    'OSPOrderNo',
    'WOOrderNo',
    'WorkOrderNo',
    'JobOrderNo',
    'WorkOrdNo',
    'OSWorkOrdNo',
    'OSPWorkOrdNo',
    'SMWorkOrdNo',
    'JobOrdNo',
    'ManufOrderNo',
    'ProductionOrderNo',
    'PlanNo',
    'ReqNo',
    'OSPReqNo',
    'IOrderNo',
    'OSPIReqNo',
    'OSWorkOrderNo',
    'OutsOrderNo',
    'WorkReqNo',
    'OSPPlanNo',
    'RoutingNo',
    'PrdOrderNo',
    'MOOrdNo',
    'MOrderNo',
    'OSPWOOrdNo',
    'JobOrderNo2',
    'WONo',
    'OSPIOrdNo',
    'OSPOrdNo',
    'OSPWONo',
    'OSPReqNo',
    'ReqNo',
    'RefOrderNo',
  ];
  const headCandidates = [
    'OSPWorkOrdNo',
    'WorkOrdNo',
    'WorkOrderNo',
    'JobOrdNo',
    'OSPIOrderNo',
    'OSPOrderNo',
    'RefWorkOrdNo',
    'WOOrderNo',
    'PlanNo',
    'OSPPlanNo',
  ];
  const parts: string[] = [];
  for (const name of lineCandidates) {
    const c = pickColumn(iCols, [name]);
    if (c) {
      parts.push(`NULLIF(LTRIM(RTRIM(CAST(i.${bracketIdent(c)} AS NVARCHAR(100)))), N'')`);
    }
  }
  for (const name of headCandidates) {
    const c = pickColumn(hCols, [name]);
    if (c) {
      parts.push(`NULLIF(LTRIM(RTRIM(CAST(h.${bracketIdent(c)} AS NVARCHAR(100)))), N'')`);
    }
  }
  /** 숫자형 작업지시·계획 시퀀스(예: 23060511) — 문자열 컬럼이 비어 있을 때 표시용 */
  const lineNumeric = [
    'OSPWOSeq',
    'WOSeq',
    'JobOrdSeq',
    'WorkOrdSeq',
    'PlanSeq',
    'OSPPlanSeq',
    'ReqSeq',
    'OrderSeq',
    'OSPReqSeq',
    'ProdOrderSeq',
    'MOSeq',
    'OSPJobOrdSeq',
    'PRSeq',
    'OSPPRSeq',
    'OSPWorkOrdSeq',
    'OSPDelvReqSeq',
    'DelvReqSeq',
  ];
  const headNumeric = [
    'OSPWOSeq',
    'WOSeq',
    'PlanSeq',
    'OSPPlanSeq',
    'JobOrdSeq',
    'OSPJobOrdSeq',
    'PRSeq',
    'OSPReqSeq',
    'ReqSeq',
    'OSPDelvReqSeq',
  ];
  for (const name of lineNumeric) {
    const c = pickColumn(iCols, [name]);
    if (c) {
      parts.push(
        `NULLIF(LTRIM(RTRIM(CAST(NULLIF(i.${bracketIdent(c)}, 0) AS NVARCHAR(100)))), N'')`,
      );
    }
  }
  for (const name of headNumeric) {
    const c = pickColumn(hCols, [name]);
    if (c) {
      parts.push(
        `NULLIF(LTRIM(RTRIM(CAST(NULLIF(h.${bracketIdent(c)}, 0) AS NVARCHAR(100)))), N'')`,
      );
    }
  }
  if (parts.length === 0) {
    return `CAST(NULL AS NVARCHAR(100))`;
  }
  return `COALESCE(${parts.join(', ')})`;
}

/** 거래명세와 유사한 단가 우선순위 — 실제 존재하는 컬럼만 사용 */
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

function pickFirstExpr(
  rows: { COLUMN_NAME: string }[],
  candidates: string[],
  alias: string,
  tableAlias: string,
): string {
  const col = pickColumn(rows, candidates);
  if (!col) {
    return `CAST(NULL AS NVARCHAR(50)) AS ${alias}`;
  }
  return `LTRIM(RTRIM(CAST(${tableAlias}.${bracketIdent(col)} AS NVARCHAR(50)))) AS ${alias}`;
}

/** SM/UM 입고구분 코드 → 자주 쓰는 「납품」「반품」 문구 (소분류 조인 실패 시 보조) */
function buildSmOspInKindCaseExpr(tableAlias: 'h' | 'i', kindCol: string | null): string {
  if (!kindCol) {
    return `CAST(NULL AS NVARCHAR(50))`;
  }
  const c = `${tableAlias}.${bracketIdent(kindCol)}`;
  return `CASE LTRIM(RTRIM(UPPER(CAST(${c} AS NVARCHAR(50)))))
    WHEN N'1' THEN N'납품'
    WHEN N'0' THEN N'납품'
    WHEN N'Y' THEN N'납품'
    WHEN N'N' THEN N'반품'
    WHEN N'2' THEN N'반품'
    WHEN N'납품' THEN N'납품'
    WHEN N'반품' THEN N'반품'
    ELSE CAST(NULL AS NVARCHAR(50))
  END`;
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

async function resolveOspDelvInSqlPlan(
  pool: mssql.ConnectionPool,
  logger: Logger,
  kindMinorFilter?: { major: number; serl: number } | null,
): Promise<OspDelvInSqlPlan> {
  let headerTable = '_TPDOSPDelvIn';
  if (!(await tableExists(pool, headerTable))) {
    headerTable = 'TPDOSPDelvIn';
  }
  if (!(await tableExists(pool, headerTable))) {
    throw new ServiceUnavailableException('ERP에 dbo._TPDOSPDelvIn 또는 dbo.TPDOSPDelvIn 헤더 테이블이 없습니다.');
  }

  let itemTable = '_TPDOSPDelvInItem';
  if (!(await tableExists(pool, itemTable))) {
    itemTable = 'TPDOSPDelvInItem';
  }
  if (!(await tableExists(pool, itemTable))) {
    throw new ServiceUnavailableException(
      'ERP에 외주입고 라인 테이블(dbo._TPDOSPDelvInItem 또는 dbo.TPDOSPDelvInItem)이 없습니다.',
    );
  }

  const hCols = await listColumns(pool, headerTable);
  const iCols = await listColumns(pool, itemTable);

  const hDate =
    pickColumn(hCols, [
      'OSPDelvInDate',
      'OSPInDate',
      'DelvInDate',
      'InDate',
      'RecvDate',
      'PUInDate',
      'PUDelvInDate',
      'ReceiptDate',
    ]) ??
    (() => {
      throw new ServiceUnavailableException(
        `${headerTable}에서 입고일 컬럼(OSPDelvInDate·DelvInDate·InDate 등)을 찾을 수 없습니다.`,
      );
    })();

  const hNo =
    pickColumn(hCols, ['OSPDelvInNo', 'DelvInNo', 'InNo', 'RecvNo', 'PUInNo', 'OSPInNo', 'ReceiptNo']) ??
    (() => {
      throw new ServiceUnavailableException(
        `${headerTable}에서 입고번호 컬럼(OSPDelvInNo·DelvInNo 등)을 찾을 수 없습니다.`,
      );
    })();

  const hSeq =
    pickColumn(hCols, ['OSPDelvInSeq', 'DelvInSeq', 'InSeq', 'PUInSeq', 'PUDelvInSeq', 'OSPInSeq', 'RecvSeq']) ??
    (() => {
      throw new ServiceUnavailableException(
        `${headerTable}에서 문서키 컬럼(OSPDelvInSeq·DelvInSeq 등)을 찾을 수 없습니다.`,
      );
    })();

  const iSeq = pickColumn(iCols, [hSeq, 'DelvInSeq', 'InSeq', 'PUInSeq', 'PUDelvInSeq', 'RecvSeq']);
  if (!iSeq) {
    throw new ServiceUnavailableException(
      `${itemTable}에 헤더와 조인할 키 컬럼(${hSeq} 등)을 찾을 수 없습니다.`,
    );
  }

  const iSerl =
    pickColumn(iCols, ['OSPDelvInSerl', 'DelvInSerl', 'InSerl', 'LineSerl', 'ItemSerl']) ??
    (() => {
      throw new ServiceUnavailableException(
        `${itemTable}에 순번 컬럼(OSPDelvInSerl·DelvInSerl·InSerl 등)을 찾을 수 없습니다.`,
      );
    })();

  const kindColCandidates = [
    'OSPSMInKind',
    'OSPInKind',
    'SMInKind',
    'SMRecvKind',
    'SMPurKind',
    'UMInKind',
    'UMDelvInKind',
    'SMDelvInKind',
    'InKind',
    'DelvInKind',
  ];

  const hReceiptKindExpr = pickFirstExpr(hCols, kindColCandidates, 'ReceiptKind', 'h');
  const iReceiptKindExpr = pickFirstExpr(iCols, kindColCandidates, 'ReceiptKindLine', 'i');
  const rawKindBase = `COALESCE(
    NULLIF(${hReceiptKindExpr.replace(' AS ReceiptKind', '')}, N''),
    NULLIF(${iReceiptKindExpr.replace(' AS ReceiptKindLine', '')}, N'')
  )`;

  const iPurOrderSeq = pickColumn(iCols, ['PurOrderSeq', 'POSeq', 'PurOrdSeq', 'OrderSeq']);
  const iPurOrderSerl = pickColumn(iCols, ['PurOrderSerl', 'POSerl', 'PurOrdSerl', 'OrderSerl']);
  const iPurOrderNoLine = pickColumn(iCols, ['PurOrderNo', 'PONo', 'OrderNo']);

  const existsOspPoU = await tableExists(pool, '_TPOSPPurOrder');
  const existsOspPoP = await tableExists(pool, 'TPOSPPurOrder');
  const existsPoUnderscore = await tableExists(pool, '_TPUPurOrder');
  const existsPoPlain = await tableExists(pool, 'TPUPurOrder');
  let poTable = '';
  if (existsOspPoU) {
    poTable = '_TPOSPPurOrder';
  } else if (existsOspPoP) {
    poTable = 'TPOSPPurOrder';
  } else if (existsPoUnderscore) {
    poTable = '_TPUPurOrder';
  } else if (existsPoPlain) {
    poTable = 'TPUPurOrder';
  }
  const hasPoTable = Boolean(poTable);
  const poCols = hasPoTable && poTable ? await listColumns(pool, poTable) : [];
  const poSeq = hasPoTable ? pickColumn(poCols, ['PurOrderSeq', 'POSeq', 'OrderSeq', 'OSPPurOrderSeq']) : null;
  const poNo = hasPoTable ? pickColumn(poCols, ['PurOrderNo', 'PONo', 'OrderNo', 'OSPPurOrderNo']) : null;

  let poJoin = '';
  let poPurOrderNoSelect = `CAST(NULL AS NVARCHAR(60)) AS PurOrderNo`;
  if (hasPoTable && poSeq && poNo && iPurOrderSeq) {
    poJoin = `LEFT JOIN dbo.${bracketIdent(poTable)} po
        ON h.CompanySeq = po.CompanySeq
        AND NULLIF(i.${bracketIdent(iPurOrderSeq)}, 0) IS NOT NULL
        AND po.${bracketIdent(poSeq)} = i.${bracketIdent(iPurOrderSeq)}`;
    poPurOrderNoSelect = `COALESCE(
          NULLIF(LTRIM(RTRIM(po.${bracketIdent(poNo)})), N''),
          CASE
            WHEN NULLIF(i.${bracketIdent(iPurOrderSeq)}, 0) IS NULL THEN NULL
            ELSE LTRIM(RTRIM(CAST(i.${bracketIdent(iPurOrderSeq)} AS NVARCHAR(30))))
          END
        ) AS PurOrderNo`;
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
  } else if (iPurOrderSeq) {
    poPurOrderNoSelect = `CASE
            WHEN NULLIF(i.${bracketIdent(iPurOrderSeq)}, 0) IS NULL THEN NULL
            ELSE LTRIM(RTRIM(CAST(i.${bracketIdent(iPurOrderSeq)} AS NVARCHAR(30))))
          END AS PurOrderNo`;
  }

  const iQcInspSeq = pickColumn(iCols, ['QCInspSeq', 'InspSeq', 'QCSeq', 'InspectSeq']);
  const iQcInspSerl = pickColumn(iCols, ['QCInspSerl', 'InspSerl', 'QCSerl', 'InspectSerl']);

  const iAssetKindExpr = pickFirstExpr(
    iCols,
    ['SMAssetKind', 'AssetKind', 'UMAssetKind', 'AssetKindCd'],
    'AssetKind',
    'i',
  );

  const remarkCol = pickColumn(iCols, ['Remark', 'LineRemark']);
  const memoCol = pickColumn(iCols, ['Memo', 'LineMemo']);
  const remarkSelect = `${remarkCol ? `i.${bracketIdent(remarkCol)}` : 'CAST(NULL AS NVARCHAR(500))'} AS LineRemark, ${
    memoCol ? `i.${bracketIdent(memoCol)}` : 'CAST(NULL AS NVARCHAR(500))'
  } AS LineMemo`;

  const stdUnitSeqCol = pickColumn(iCols, ['STDUnitSeq', 'StdUnitSeq']);

  const itemSeqCol =
    pickColumn(iCols, ['ItemSeq', 'MatSeq', 'MaterialSeq', 'ItemSeqNo']) ??
    (() => {
      throw new ServiceUnavailableException(
        `${itemTable}에 품목 연결 컬럼(ItemSeq 등)이 없습니다.`,
      );
    })();

  const lineUnitPriceSql = buildLineUnitPriceSql(iCols);
  const qtySql = iColSql(iCols, ['Qty', 'InQty', 'RecvQty', 'PUQty', 'OrderQty'], 'CAST(NULL AS decimal(18, 6))');
  const domAmtSql = iColSql(
    iCols,
    ['DomAmt', 'SupplyAmt', 'SplyAmt', 'SupplyAmount', 'DomSupplyAmt'],
    'CAST(NULL AS decimal(18, 4))',
  );
  const domVatSql = iColSql(iCols, ['DomVAT', 'VAT', 'VATAmt', 'TaxAmt', 'VatAmt'], 'CAST(NULL AS decimal(18, 4))');
  const curAmtSql = iColSql(iCols, ['CurAmt', 'ForeignAmt', 'FCuryAmt', 'CurrAmt', 'FcurrAmt'], 'CAST(NULL AS decimal(18, 4))');
  const lineTotalSql = `CAST(ISNULL((${domAmtSql}), 0) + ISNULL((${domVatSql}), 0) AS decimal(18, 4))`;
  const foreignUnitPriceSql = `CASE
    WHEN NULLIF((${qtySql}), 0) IS NULL THEN NULL
    ELSE CAST((${curAmtSql}) AS decimal(18, 6)) / CAST((${qtySql}) AS decimal(18, 6))
  END`;

  const iWh = pickColumn(iCols, ['WHSeq', 'InWHSeq', 'WarehouseSeq', 'StkWHSeq']);
  const hWh = pickColumn(hCols, ['WHSeq', 'InWHSeq', 'RecvWHSeq', 'StkWHSeq']);
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
      : `LEFT JOIN dbo.[_TDAUnit] u
        ON h.CompanySeq = u.CompanySeq AND u.UnitSeq = it.UnitSeq`;

  const pjtSeqCol = pickColumn(iCols, ['PJTSeq', 'ProjectSeq']);
  const pjtJoinSql =
    pjtSeqCol != null
      ? `LEFT JOIN dbo.[_TPJTProject] pjt
        ON h.CompanySeq = pjt.CompanySeq AND i.${bracketIdent(pjtSeqCol)} = pjt.PJTSeq`
      : `LEFT JOIN dbo.[_TPJTProject] pjt ON 1 = 0`;

  const hDateYmdExpr = buildHDateYmdExpr(hDate);

  const hDeptSeq = pickColumn(hCols, ['DeptSeq', 'InDeptSeq', 'RecvDeptSeq', 'ChargeDeptSeq', 'WHDeptSeq']);
  const deptJoinSql = hDeptSeq
    ? `LEFT JOIN dbo.[_TDADept] dpIn ON h.CompanySeq = dpIn.CompanySeq AND h.${bracketIdent(hDeptSeq)} = dpIn.DeptSeq`
    : `LEFT JOIN dbo.[_TDADept] dpIn ON 1 = 0`;
  const deptNameSelect = hDeptSeq
    ? `LTRIM(RTRIM(CAST(dpIn.DeptName AS NVARCHAR(200)))) AS DeptName`
    : `CAST(NULL AS NVARCHAR(200)) AS DeptName`;

  const hInEmpSeq = pickColumn(hCols, [
    'EmpSeq',
    'InEmpSeq',
    'ChargeEmpSeq',
    'PicEmpSeq',
    'RecvEmpSeq',
    'RegEmpSeq',
    'InsEmpSeq',
  ]);
  const inEmpJoinSql = hInEmpSeq
    ? `LEFT JOIN dbo.[_TDAEmp] empIn ON h.CompanySeq = empIn.CompanySeq AND h.${bracketIdent(hInEmpSeq)} = empIn.EmpSeq`
    : `LEFT JOIN dbo.[_TDAEmp] empIn ON 1 = 0`;
  const inEmpNameSelect = hInEmpSeq
    ? `LTRIM(RTRIM(CAST(empIn.EmpName AS NVARCHAR(100)))) AS InChargeEmpName`
    : `CAST(NULL AS NVARCHAR(100)) AS InChargeEmpName`;

  const modEmpSeq = pickColumn(hCols, ['ModEmpSeq', 'LastEmpSeq', 'UpdEmpSeq', 'LastUserSeq', 'EditEmpSeq']);
  const lastWriterJoinSql = modEmpSeq
    ? `LEFT JOIN dbo.[_TDAEmp] lwEmp ON h.CompanySeq = lwEmp.CompanySeq AND h.${bracketIdent(modEmpSeq)} = lwEmp.EmpSeq`
    : `LEFT JOIN dbo.[_TDAEmp] lwEmp ON 1 = 0`;
  const lastWriterNameSelect = modEmpSeq
    ? `LTRIM(RTRIM(CAST(lwEmp.EmpName AS NVARCHAR(100)))) AS LastWriterName`
    : `CAST(NULL AS NVARCHAR(100)) AS LastWriterName`;

  const lastDtCol = pickColumn(hCols, [
    'LastDateTime',
    'UpdDateTime',
    'ModDateTime',
    'LastUpdDateTime',
    'EditDateTime',
    'InsDateTime',
    'RegDateTime',
  ]);
  const lastModSelect = lastDtCol
    ? `CONVERT(NVARCHAR(50), h.${bracketIdent(lastDtCol)}, 120) AS LastModRaw`
    : `CAST(NULL AS NVARCHAR(50)) AS LastModRaw`;

  const slipCol = pickColumn(hCols, ['SlipNo', 'DocNo', 'ActNo', 'VoucherNo', 'SlipNo2', 'AcctNo', 'GLDocNo']);
  const slipNoSelect = slipCol
    ? `LTRIM(RTRIM(CAST(h.${bracketIdent(slipCol)} AS NVARCHAR(60)))) AS SlipNo`
    : `CAST(NULL AS NVARCHAR(60)) AS SlipNo`;

  const hKindColPick = pickColumn(hCols, kindColCandidates);
  const iKindColPick = pickColumn(iCols, kindColCandidates);
  const kindCaseH = buildSmOspInKindCaseExpr('h', hKindColPick);
  const kindCaseI = buildSmOspInKindCaseExpr('i', iKindColPick);

  let inKindApplySql = '';
  let receiptKindSelectSql = `COALESCE(${kindCaseH}, ${kindCaseI}, ${rawKindBase}) AS ReceiptKind`;

  if (await tableExists(pool, '_TDAUMinorValue')) {
    const umCols = await listColumns(pool, '_TDAUMinorValue');
    const mvMinor = pickColumn(umCols, ['MinorSeq', 'MINORSEQ', 'UMMinorSeq']);
    const mvMajor = pickColumn(umCols, ['MajorSeq', 'MAJORSEQ']);
    const mvSerl = pickColumn(umCols, ['Serl', 'SERL']);
    const mvMinorName = pickColumn(umCols, ['MinorName', 'MINORNAME', 'UMinorName', 'MinorDesc']);
    const mvVt = pickColumn(umCols, ['ValueText', 'VALUETEXT', 'MinorValueText']);
    const mvComp = pickColumn(umCols, ['CompanySeq', 'COMPANYSEQ']);

    const majorSerlSql =
      kindMinorFilter != null && mvMajor && mvSerl
        ? `AND umk.${bracketIdent(mvMajor)} = ${kindMinorFilter.major} AND umk.${bracketIdent(mvSerl)} = ${kindMinorFilter.serl}`
        : '';

    let namePart = '';
    if (mvMinorName && mvVt) {
      namePart = `COALESCE(
            NULLIF(LTRIM(RTRIM(CAST(umk.${bracketIdent(mvMinorName)} AS NVARCHAR(200)))), N''),
            NULLIF(LTRIM(RTRIM(CAST(umk.${bracketIdent(mvVt)} AS NVARCHAR(200)))), N'')
          )`;
    } else if (mvMinorName) {
      namePart = `LTRIM(RTRIM(CAST(umk.${bracketIdent(mvMinorName)} AS NVARCHAR(200))))`;
    } else if (mvVt) {
      namePart = `LTRIM(RTRIM(CAST(umk.${bracketIdent(mvVt)} AS NVARCHAR(200))))`;
    } else if (mvMinor) {
      namePart = `LTRIM(RTRIM(CAST(umk.${bracketIdent(mvMinor)} AS NVARCHAR(200))))`;
    }

    const compClause = mvComp
      ? `(umk.${bracketIdent(mvComp)} = h.CompanySeq OR umk.${bracketIdent(mvComp)} IS NULL)`
      : '1 = 1';

    const ors: string[] = [];
    if (mvMinor) {
      if (hKindColPick) {
        ors.push(
          `CAST(umk.${bracketIdent(mvMinor)} AS NVARCHAR(50)) = CAST(h.${bracketIdent(hKindColPick)} AS NVARCHAR(50))`,
        );
        if (mvVt) {
          ors.push(
            `LTRIM(RTRIM(CAST(umk.${bracketIdent(mvVt)} AS NVARCHAR(100)))) = LTRIM(RTRIM(CAST(h.${bracketIdent(hKindColPick)} AS NVARCHAR(100))))`,
          );
        }
      }
      if (iKindColPick) {
        ors.push(
          `CAST(umk.${bracketIdent(mvMinor)} AS NVARCHAR(50)) = CAST(i.${bracketIdent(iKindColPick)} AS NVARCHAR(50))`,
        );
        if (mvVt) {
          ors.push(
            `LTRIM(RTRIM(CAST(umk.${bracketIdent(mvVt)} AS NVARCHAR(100)))) = LTRIM(RTRIM(CAST(i.${bracketIdent(iKindColPick)} AS NVARCHAR(100))))`,
          );
        }
      }
    }

    if (namePart && ors.length > 0) {
      const orderComp = mvComp
        ? `CASE WHEN umk.${bracketIdent(mvComp)} = h.CompanySeq THEN 0 ELSE 1 END`
        : '0';
      const orderMinorH =
        hKindColPick && mvMinor
          ? `CASE WHEN CAST(umk.${bracketIdent(mvMinor)} AS NVARCHAR(50)) = CAST(h.${bracketIdent(hKindColPick)} AS NVARCHAR(50)) THEN 0 ELSE 1 END`
          : '0';
      inKindApplySql = `OUTER APPLY (
    SELECT TOP (1) ${namePart} AS KindText
    FROM dbo.[_TDAUMinorValue] umk
    WHERE ${compClause}
      ${majorSerlSql}
      AND (${ors.join('\n      OR ')})
    ORDER BY ${orderComp}, ${orderMinorH}
  ) ink`;
      receiptKindSelectSql = `COALESCE(
        NULLIF(ink.KindText, N''),
        ${kindCaseH},
        ${kindCaseI},
        ${rawKindBase}
      ) AS ReceiptKind`;
    }
  }

  const itemNameExprSql = buildCoalesceOspLineString(
    iCols,
    [
      'OSPItemName',
      'DeliverItemName',
      'OutsItemName',
      'SubItemName',
      'WorkItemName',
      'OrderItemName',
      'UMOutsItemName',
    ],
    `LTRIM(RTRIM(CAST(it.ItemName AS NVARCHAR(500))))`,
  );
  const itemNoExprSql = buildCoalesceOspLineString(
    iCols,
    ['OSPItemNo', 'OutsItemNo', 'SubItemNo', 'CustItemNo', 'WorkItemNo', 'UMOutsItemNo'],
    `LTRIM(RTRIM(CAST(it.ItemNo AS NVARCHAR(100))))`,
  );

  /** 라인 작업지시 시퀀스 → 마스터 테이블에서 표시용 번호(엑셀과 동일) */
  let ospWorkOrdJoinSql = '';
  const ospWoSeqLine = pickColumn(iCols, ['OSPWOSeq', 'WOSeq', 'WorkOrdSeq', 'OSPWorkOrdSeq', 'JobOrdSeq']);
  let ospInstrLeadCoalesce = '';
  if (ospWoSeqLine) {
    const woTableCandidates = [
      '_TPPWorkOrd',
      'TPPWorkOrd',
      '_TOSPWorkOrd',
      'TOSPWorkOrd',
      '_TPPJobOrd',
      'TPPJobOrd',
      '_TDAWorkOrd',
      'TDAWorkOrd',
    ];
    for (const woTable of woTableCandidates) {
      if (!(await tableExists(pool, woTable))) {
        continue;
      }
      const woCols = await listColumns(pool, woTable);
      const wSeq = pickColumn(woCols, [
        'WorkOrdSeq',
        'JobOrdSeq',
        'WOSeq',
        'OSPWOSeq',
        'WorkOrderSeq',
        'OSPWorkOrdSeq',
        'JobOrderSeq',
      ]);
      const wNo = pickColumn(woCols, [
        'WorkOrdNo',
        'JobOrdNo',
        'WorkOrderNo',
        'WOOrderNo',
        'OSPWorkOrdNo',
        'WOOrdNo',
        'OrderNo',
      ]);
      if (wSeq && wNo) {
        ospWorkOrdJoinSql = `LEFT JOIN dbo.${bracketIdent(woTable)} ospWo
        ON h.CompanySeq = ospWo.CompanySeq AND ospWo.${bracketIdent(wSeq)} = NULLIF(i.${bracketIdent(ospWoSeqLine)}, 0)`;
        ospInstrLeadCoalesce = `NULLIF(LTRIM(RTRIM(CAST(ospWo.${bracketIdent(wNo)} AS NVARCHAR(100)))), N''),`;
        logger.log(`OSP DelvIn: 작업지시 조인 ${woTable} (${ospWoSeqLine} → ${wSeq}.${wNo})`);
        break;
      }
    }
  }

  const woInstrCore = buildWorkInstructionNoSql(hCols, iCols);
  const ospInstrExprSql = ospInstrLeadCoalesce
    ? `COALESCE(${ospInstrLeadCoalesce}${woInstrCore})`
    : woInstrCore;

  const ospProcExprSql = buildFirstLineStringExpr(
    iCols,
    ['ProcName', 'WorkProcName', 'OSPProcName', 'ProcessName', 'UMWorkProcName', 'WorkProcDesc', 'RoutingName'],
    `CAST(NULL AS NVARCHAR(500))`,
  );

  const specialNoteExprSql = buildCoalesceOspLineString(
    iCols,
    ['SpecialNote', 'UnusualNote', 'Remark2', 'SpecNote', 'Note1', 'LineSpec'],
    `CAST(NULL AS NVARCHAR(500))`,
  );

  const lotNoExprSql = buildFirstLineStringExpr(
    iCols,
    ['LotNo', 'LotNumber', 'StockLot', 'Lot', 'LotID', 'StockLotNo'],
    `CAST(NULL AS NVARCHAR(100))`,
  );

  const degreeExprSql = buildFirstLineIntExpr(
    iCols,
    ['OrderDeg', 'Chasu', 'SMChasu', 'ReqDeg', 'LineDeg', 'DegreeNo', 'SeqDeg'],
    `CAST(NULL AS INT)`,
  );

  const vatInclCol = pickColumn(iCols, ['VATIncKind', 'TaxIncKind', 'SMVATIncKind', 'VATInKind', 'TaxInKind']);
  const vatInclExprSql = vatInclCol
    ? `LTRIM(RTRIM(CAST(i.${bracketIdent(vatInclCol)} AS NVARCHAR(20)))) AS VatInclFlag`
    : `CAST(NULL AS NVARCHAR(20)) AS VatInclFlag`;

  const matInputCol = pickColumn(iCols, ['MatInputKind', 'InputMatYn', 'MaterialInputYn', 'MatInputYn', 'InputMatKind']);
  const matInputExprSql = matInputCol
    ? `LTRIM(RTRIM(CAST(i.${bracketIdent(matInputCol)} AS NVARCHAR(20)))) AS MatInputYn`
    : `CAST(NULL AS NVARCHAR(20)) AS MatInputYn`;

  const rawMatPriceExprSql = iColSql(
    iCols,
    ['RawMatPrice', 'MatPurPrice', 'MatUnitPrice', 'OriMatPrice', 'RawMatUnitPrice', 'BaseMatPrice'],
    'CAST(NULL AS decimal(18, 6))',
  );

  let itemCatLExprSql = `CAST(NULL AS NVARCHAR(200)) AS ItemCatL`;
  let itemCatMExprSql = `CAST(NULL AS NVARCHAR(200)) AS ItemCatM`;
  let itemCatSExprSql = `CAST(NULL AS NVARCHAR(200)) AS ItemCatS`;
  if (await tableExists(pool, '_TDAItem')) {
    const itCols = await listColumns(pool, '_TDAItem');
    const catL = pickColumn(itCols, ['ItemKindLName', 'ItemCatLName', 'MajorKindName', 'KindLName', 'ItemLClassName']);
    const catM = pickColumn(itCols, ['ItemKindMName', 'ItemCatMName', 'MidKindName', 'KindMName', 'ItemMClassName']);
    const catS = pickColumn(itCols, ['ItemKindSName', 'ItemCatSName', 'MinorKindName', 'KindSName', 'ItemSClassName']);
    if (catL) {
      itemCatLExprSql = `LTRIM(RTRIM(CAST(it.${bracketIdent(catL)} AS NVARCHAR(200)))) AS ItemCatL`;
    }
    if (catM) {
      itemCatMExprSql = `LTRIM(RTRIM(CAST(it.${bracketIdent(catM)} AS NVARCHAR(200)))) AS ItemCatM`;
    }
    if (catS) {
      itemCatSExprSql = `LTRIM(RTRIM(CAST(it.${bracketIdent(catS)} AS NVARCHAR(200)))) AS ItemCatS`;
    }
  }

  logger.log(
    `OSP DelvIn schema: header=${headerTable}, item=${itemTable}, date=${hDate}, no=${hNo}, seq=${hSeq}/${iSeq}, serl=${iSerl}, poJoin=${Boolean(poJoin)}`,
  );

  return {
    headerTable,
    itemTable,
    hDate,
    hDateYmdExpr,
    hNo,
    hSeq,
    iSeq,
    iSerl,
    hReceiptKindExpr: rawKindBase,
    iPurOrderSeq,
    iPurOrderSerl,
    iPurOrderNoLine,
    poJoin,
    poPurOrderNoSelect,
    iQcInspSeq,
    iQcInspSerl,
    iAssetKindExpr: iAssetKindExpr.replace(' AS AssetKind', ''),
    remarkSelect,
    stdUnitSeqCol,
    itemSeqCol,
    lineUnitPriceSql,
    qtySql,
    domAmtSql,
    domVatSql,
    curAmtSql,
    lineTotalSql,
    foreignUnitPriceSql,
    whSeqExpr,
    whJoinSql,
    unitJoinSql,
    pjtJoinSql,
    deptJoinSql,
    deptNameSelect,
    inEmpJoinSql,
    inEmpNameSelect,
    lastWriterJoinSql,
    lastWriterNameSelect,
    lastModSelect,
    slipNoSelect,
    inKindApplySql,
    receiptKindSelectSql,
    itemNameExprSql,
    itemNoExprSql,
    ospInstrExprSql: `${ospInstrExprSql} AS OspInstructionNo`,
    ospProcExprSql: `${ospProcExprSql} AS OspProcessName`,
    specialNoteExprSql: `${specialNoteExprSql} AS SpecialNote`,
    lotNoExprSql: `${lotNoExprSql} AS LotNo`,
    degreeExprSql: `${degreeExprSql} AS LineDegree`,
    vatInclExprSql,
    matInputExprSql,
    rawMatPriceExprSql: `${rawMatPriceExprSql} AS RawMatUnitPrice`,
    itemCatLExprSql,
    itemCatMExprSql,
    itemCatSExprSql,
    ospWorkOrdJoinSql,
  };
}

function buildSelectSql(plan: OspDelvInSqlPlan, whereTail: string): string {
  const iTbl = bracketIdent(plan.itemTable);
  const uStdJoin =
    plan.stdUnitSeqCol != null
      ? `LEFT JOIN dbo.[_TDAUnit] uStd
        ON h.CompanySeq = uStd.CompanySeq AND uStd.UnitSeq = NULLIF(i.${bracketIdent(plan.stdUnitSeqCol)}, 0)`
      : `LEFT JOIN dbo.[_TDAUnit] uStd ON 1 = 0`;
  const purOrderSerlExpr = plan.iPurOrderSerl
    ? `NULLIF(i.${bracketIdent(plan.iPurOrderSerl)}, 0) AS PurOrderSerl`
    : `CAST(NULL AS INT) AS PurOrderSerl`;

  const inspectionNoExpr =
    plan.iQcInspSeq != null
      ? `CASE
          WHEN NULLIF(i.${bracketIdent(plan.iQcInspSeq)}, 0) IS NULL THEN NULL
          ELSE LTRIM(RTRIM(CAST(i.${bracketIdent(plan.iQcInspSeq)} AS NVARCHAR(32))))
        END AS InspectionNo`
      : `CAST(NULL AS NVARCHAR(32)) AS InspectionNo`;

  const inspectionSerlExpr =
    plan.iQcInspSerl != null
      ? `NULLIF(i.${bracketIdent(plan.iQcInspSerl)}, 0) AS InspectionSerl`
      : `CAST(NULL AS INT) AS InspectionSerl`;

  return `
      SELECT TOP (@fetchCount)
        h.BizUnit AS BizUnit,
        ${plan.hDateYmdExpr} AS DelvInDateRaw,
        CASE
          WHEN LEN(LTRIM(RTRIM(h.${bracketIdent(plan.hNo)}))) = 10 AND LTRIM(RTRIM(h.${bracketIdent(plan.hNo)})) NOT LIKE N'%-%'
            THEN LEFT(LTRIM(RTRIM(h.${bracketIdent(plan.hNo)})), 6) + N'-' + SUBSTRING(LTRIM(RTRIM(h.${bracketIdent(plan.hNo)})), 7, 20)
          ELSE LTRIM(RTRIM(h.${bracketIdent(plan.hNo)}))
        END AS DelvInNoFmt,
        i.${bracketIdent(plan.iSerl)} AS DelvInSerl,
        c.CustNo AS CustNo,
        c.CustName AS CustName,
        ${plan.receiptKindSelectSql},
        ${plan.deptNameSelect},
        ${plan.inEmpNameSelect},
        ${plan.whSeqExpr} AS WHSeq,
        wh.WHName AS WHName,
        ${plan.itemNoExprSql} AS ItemNo,
        ${plan.itemNameExprSql} AS ItemName,
        it.Spec AS Spec,
        u.UnitName AS UnitName,
        uStd.UnitName AS StdUnitName,
        ${plan.qtySql} AS Qty,
        ${plan.lineUnitPriceSql} AS LineUnitPrice,
        ${plan.foreignUnitPriceSql} AS ForeignUnitPrice,
        ${plan.domAmtSql} AS DomAmt,
        ${plan.domVatSql} AS DomVAT,
        ${plan.lineTotalSql} AS LineTotal,
        ${plan.curAmtSql} AS CurAmt,
        pjt.PJTNo AS PJTNo,
        pjt.PJTName AS PJTName,
        ${plan.poPurOrderNoSelect},
        ${purOrderSerlExpr},
        ${inspectionNoExpr},
        ${inspectionSerlExpr},
        ${plan.remarkSelect},
        ${plan.iAssetKindExpr} AS AssetKind,
        ${plan.ospInstrExprSql},
        ${plan.ospProcExprSql},
        ${plan.specialNoteExprSql},
        ${plan.lotNoExprSql},
        ${plan.degreeExprSql},
        ${plan.vatInclExprSql},
        ${plan.matInputExprSql},
        ${plan.rawMatPriceExprSql},
        ${plan.itemCatLExprSql},
        ${plan.itemCatMExprSql},
        ${plan.itemCatSExprSql},
        ${plan.lastModSelect},
        ${plan.lastWriterNameSelect},
        ${plan.slipNoSelect}
      FROM dbo.${bracketIdent(plan.headerTable)} h
      INNER JOIN dbo.${iTbl} i
        ON h.CompanySeq = i.CompanySeq AND h.${bracketIdent(plan.hSeq)} = i.${bracketIdent(plan.iSeq)}
      ${plan.ospWorkOrdJoinSql}
      LEFT JOIN dbo.[_TDACust] c
        ON h.CompanySeq = c.CompanySeq AND h.CustSeq = c.CustSeq
      ${plan.deptJoinSql}
      ${plan.inEmpJoinSql}
      ${plan.lastWriterJoinSql}
      ${plan.inKindApplySql}
      LEFT JOIN dbo.[_TDAItem] it
        ON h.CompanySeq = it.CompanySeq AND i.${bracketIdent(plan.itemSeqCol)} = it.ItemSeq
      ${plan.unitJoinSql}
      ${uStdJoin}
      ${plan.whJoinSql}
      ${plan.pjtJoinSql}
      ${plan.poJoin}
      WHERE ${plan.hDateYmdExpr} >= @fromYmd
        AND ${plan.hDateYmdExpr} <= @toYmd
        ${whereTail}
      ORDER BY ${plan.hDateYmdExpr} ASC, h.CompanySeq ASC, h.${bracketIdent(plan.hSeq)} ASC, i.${bracketIdent(plan.iSerl)} ASC
    `;
}

@Injectable()
export class ErpOspDelvInItemsService {
  private readonly logger = new Logger(ErpOspDelvInItemsService.name);
  private pool: mssql.ConnectionPool | null = null;
  private poolPromise: Promise<mssql.ConnectionPool> | null = null;
  private sqlPlan: OspDelvInSqlPlan | null = null;

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
      this.logger.log(`ERP MSSQL connected (OSP delv in) (${host}:${port}/${database})`);
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

  /** 외주입고구분용 `_TDAUMinorValue` Major/Serl(둘 다 있을 때만 적용) */
  private parseOptionalIntEnv(key: string): number | null {
    const raw = this.config.get<string>(key)?.trim();
    if (!raw) {
      return null;
    }
    const n = Number(raw);
    return Number.isFinite(n) && Number.isInteger(n) ? n : null;
  }

  private async getOrBuildSqlPlan(pool: mssql.ConnectionPool): Promise<OspDelvInSqlPlan> {
    if (this.sqlPlan) {
      return this.sqlPlan;
    }
    const major = this.parseOptionalIntEnv('ERP_OSP_DELV_IN_KIND_UMINOR_MAJOR');
    const serl = this.parseOptionalIntEnv('ERP_OSP_DELV_IN_KIND_UMINOR_SERL');
    const kindMinorFilter =
      major != null && serl != null ? ({ major, serl } as const) : null;
    if ((major != null) !== (serl != null)) {
      this.logger.warn(
        'ERP_OSP_DELV_IN_KIND_UMINOR_MAJOR·ERP_OSP_DELV_IN_KIND_UMINOR_SERL은 둘 다 설정해야 소분류 조인이 좁혀집니다.',
      );
    }
    this.sqlPlan = await resolveOspDelvInSqlPlan(pool, this.logger, kindMinorFilter);
    return this.sqlPlan;
  }

  async listByDelvInDateRange(
    fromIso: string,
    toIso: string,
    limit?: number,
  ): Promise<{ items: OspDelvInItemRow[]; truncated: boolean }> {
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

    let companySeq = this.parseOptionalPositiveInt('ERP_OSP_DELV_IN_COMPANY_SEQ', 'ERP_OSP_DELV_IN_COMPANY_SEQ');
    if (companySeq == null) {
      companySeq = this.parseOptionalPositiveInt('ERP_PU_DELV_IN_COMPANY_SEQ', 'ERP_PU_DELV_IN_COMPANY_SEQ');
    }
    let bizUnitFilter = this.parseOptionalPositiveInt('ERP_OSP_DELV_IN_BIZ_UNIT', 'ERP_OSP_DELV_IN_BIZ_UNIT');
    if (bizUnitFilter == null) {
      bizUnitFilter = this.parseOptionalPositiveInt('ERP_PU_DELV_IN_BIZ_UNIT', 'ERP_PU_DELV_IN_BIZ_UNIT');
    }

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
      this.logger.error(`OSP DelvIn query failed: ${msg}`, err instanceof Error ? err.stack : undefined);
      throw new BadRequestException(
        `ERP 조회 쿼리 실행에 실패했습니다. 테이블·컬럼 정의를 확인하세요. (${msg.slice(0, 240)})`,
      );
    }

    const raw = result.recordset ?? [];
    const truncated = raw.length > maxRows;
    const slice = truncated ? raw.slice(0, maxRows) : raw;
    return {
      items: slice.map((r, i) => ({ ...mapRow(r), rowNo: i + 1 })),
      truncated,
    };
  }
}
