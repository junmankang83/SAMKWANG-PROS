import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mssql from 'mssql';

/**
 * 구매입고/반품 품목 조회 (엑셀 열 순서: 사업장 → 자산구분)
 * `dbo._TPUDelvIn` + 라인 테이블(`_TPUDelvInItem` 또는 `TPUDelvInItem`) — 컬럼명은 INFORMATION_SCHEMA로 자동 감지합니다.
 */
export type PuDelvInItemRow = {
  bizUnit: number | null;
  receiptDate: string;
  receiptNo: string | null;
  lineSerl: number | null;
  customerCode: string | null;
  customerName: string | null;
  receiptKind: string | null;
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
};

type SqlRow = {
  BizUnit: number | null;
  DelvInDateRaw: string | null;
  DelvInNoFmt: string | null;
  DelvInSerl: number | null;
  CustNo: string | null;
  CustName: string | null;
  ReceiptKind: string | null;
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
};

/** 동적 SQL에 넣을 식별자(화이트리스트에서만 선택) */
type PuDelvSqlPlan = {
  itemTable: string;
  hDate: string;
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

function mapRow(r: SqlRow): PuDelvInItemRow {
  return {
    bizUnit: r.BizUnit == null ? null : Number(r.BizUnit),
    receiptDate: yyyymmddToIso(r.DelvInDateRaw),
    receiptNo: trimOrNull(r.DelvInNoFmt),
    lineSerl: r.DelvInSerl == null ? null : Number(r.DelvInSerl),
    customerCode: trimOrNull(r.CustNo),
    customerName: trimOrNull(r.CustName),
    receiptKind: trimOrNull(r.ReceiptKind),
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

async function resolveSqlPlan(pool: mssql.ConnectionPool, logger: Logger): Promise<PuDelvSqlPlan> {
  const headerName = '_TPUDelvIn';
  let itemTable = '_TPUDelvInItem';
  if (!(await tableExists(pool, itemTable))) {
    itemTable = 'TPUDelvInItem';
  }
  if (!(await tableExists(pool, itemTable))) {
    throw new ServiceUnavailableException(
      'ERP에 구매입고 라인 테이블(dbo._TPUDelvInItem 또는 dbo.TPUDelvInItem)이 없습니다.',
    );
  }
  if (!(await tableExists(pool, headerName))) {
    throw new ServiceUnavailableException('ERP에 dbo._TPUDelvIn 테이블이 없습니다.');
  }

  const hCols = await listColumns(pool, headerName);
  const iCols = await listColumns(pool, itemTable);

  const hDate =
    pickColumn(hCols, ['DelvInDate', 'InDate', 'RecvDate', 'PUInDate', 'ReceiptDate']) ??
    (() => {
      throw new ServiceUnavailableException(
        '_TPUDelvIn에 입고일 컬럼(DelvInDate·InDate·RecvDate 등)을 찾을 수 없습니다.',
      );
    })();

  const hNo =
    pickColumn(hCols, ['DelvInNo', 'InNo', 'RecvNo', 'PUInNo', 'ReceiptNo']) ??
    (() => {
      throw new ServiceUnavailableException(
        '_TPUDelvIn에 입고번호 컬럼(DelvInNo·InNo 등)을 찾을 수 없습니다.',
      );
    })();

  const hSeq =
    pickColumn(hCols, ['DelvInSeq', 'InSeq', 'PUInSeq', 'PUDelvInSeq', 'RecvSeq']) ??
    (() => {
      throw new ServiceUnavailableException(
        '_TPUDelvIn에 문서키 컬럼(DelvInSeq·InSeq 등)을 찾을 수 없습니다.',
      );
    })();

  const iSeq = pickColumn(iCols, [hSeq, 'DelvInSeq', 'InSeq', 'PUInSeq', 'PUDelvInSeq', 'RecvSeq']);
  if (!iSeq) {
    throw new ServiceUnavailableException(
      `${itemTable}에 헤더와 조인할 키 컬럼(${hSeq} 등)을 찾을 수 없습니다.`,
    );
  }

  const iSerl =
    pickColumn(iCols, ['DelvInSerl', 'InSerl', 'LineSerl', 'ItemSerl']) ??
    (() => {
      throw new ServiceUnavailableException(
        `${itemTable}에 순번 컬럼(DelvInSerl·InSerl 등)을 찾을 수 없습니다.`,
      );
    })();

  const hReceiptKindExpr = pickFirstExpr(
    hCols,
    ['SMInKind', 'SMRecvKind', 'SMPurKind', 'UMInKind', 'InKind', 'DelvInKind'],
    'ReceiptKind',
    'h',
  );

  const iPurOrderSeq = pickColumn(iCols, ['PurOrderSeq', 'POSeq', 'PurOrdSeq', 'OrderSeq']);
  const iPurOrderSerl = pickColumn(iCols, ['PurOrderSerl', 'POSerl', 'PurOrdSerl', 'OrderSerl']);
  const iPurOrderNoLine = pickColumn(iCols, ['PurOrderNo', 'PONo', 'OrderNo']);

  const existsPoUnderscore = await tableExists(pool, '_TPUPurOrder');
  const existsPoPlain = await tableExists(pool, 'TPUPurOrder');
  const hasPoTable = existsPoUnderscore || existsPoPlain;
  const poTable = existsPoUnderscore ? '_TPUPurOrder' : existsPoPlain ? 'TPUPurOrder' : '';
  const poCols = hasPoTable && poTable ? await listColumns(pool, poTable) : [];
  const poSeq = hasPoTable ? pickColumn(poCols, ['PurOrderSeq', 'POSeq', 'OrderSeq']) : null;
  const poNo = hasPoTable ? pickColumn(poCols, ['PurOrderNo', 'PONo', 'OrderNo']) : null;

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

  logger.log(
    `PU DelvIn schema: item=${itemTable}, date=${hDate}, no=${hNo}, seq=${hSeq}/${iSeq}, serl=${iSerl}, poJoin=${Boolean(poJoin)}`,
  );

  return {
    itemTable,
    hDate,
    hNo,
    hSeq,
    iSeq,
    iSerl,
    hReceiptKindExpr: hReceiptKindExpr.replace(' AS ReceiptKind', ''),
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
  };
}

function buildSelectSql(plan: PuDelvSqlPlan, whereTail: string): string {
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
        LTRIM(RTRIM(h.${bracketIdent(plan.hDate)})) AS DelvInDateRaw,
        CASE
          WHEN LEN(LTRIM(RTRIM(h.${bracketIdent(plan.hNo)}))) = 10 AND LTRIM(RTRIM(h.${bracketIdent(plan.hNo)})) NOT LIKE N'%-%'
            THEN LEFT(LTRIM(RTRIM(h.${bracketIdent(plan.hNo)})), 6) + N'-' + SUBSTRING(LTRIM(RTRIM(h.${bracketIdent(plan.hNo)})), 7, 20)
          ELSE LTRIM(RTRIM(h.${bracketIdent(plan.hNo)}))
        END AS DelvInNoFmt,
        i.${bracketIdent(plan.iSerl)} AS DelvInSerl,
        c.CustNo AS CustNo,
        c.CustName AS CustName,
        ${plan.hReceiptKindExpr} AS ReceiptKind,
        ${plan.whSeqExpr} AS WHSeq,
        wh.WHName AS WHName,
        it.ItemNo AS ItemNo,
        it.ItemName AS ItemName,
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
        ${plan.iAssetKindExpr} AS AssetKind
      FROM dbo.[_TPUDelvIn] h
      INNER JOIN dbo.${iTbl} i
        ON h.CompanySeq = i.CompanySeq AND h.${bracketIdent(plan.hSeq)} = i.${bracketIdent(plan.iSeq)}
      LEFT JOIN dbo.[_TDACust] c
        ON h.CompanySeq = c.CompanySeq AND h.CustSeq = c.CustSeq
      LEFT JOIN dbo.[_TDAItem] it
        ON h.CompanySeq = it.CompanySeq AND i.${bracketIdent(plan.itemSeqCol)} = it.ItemSeq
      ${plan.unitJoinSql}
      ${uStdJoin}
      ${plan.whJoinSql}
      ${plan.pjtJoinSql}
      ${plan.poJoin}
      WHERE LTRIM(RTRIM(h.${bracketIdent(plan.hDate)})) >= @fromYmd
        AND LTRIM(RTRIM(h.${bracketIdent(plan.hDate)})) <= @toYmd
        ${whereTail}
      ORDER BY LTRIM(RTRIM(h.${bracketIdent(plan.hDate)})) ASC, h.CompanySeq ASC, h.${bracketIdent(plan.hSeq)} ASC, i.${bracketIdent(plan.iSerl)} ASC
    `;
}

@Injectable()
export class ErpPuDelvInItemsService {
  private readonly logger = new Logger(ErpPuDelvInItemsService.name);
  private pool: mssql.ConnectionPool | null = null;
  private poolPromise: Promise<mssql.ConnectionPool> | null = null;
  private sqlPlan: PuDelvSqlPlan | null = null;

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

  private async getOrBuildSqlPlan(pool: mssql.ConnectionPool): Promise<PuDelvSqlPlan> {
    if (this.sqlPlan) {
      return this.sqlPlan;
    }
    this.sqlPlan = await resolveSqlPlan(pool, this.logger);
    return this.sqlPlan;
  }

  async listByDelvInDateRange(
    fromIso: string,
    toIso: string,
    limit?: number,
  ): Promise<{ items: PuDelvInItemRow[]; truncated: boolean }> {
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
      'ERP_PU_DELV_IN_COMPANY_SEQ',
      'ERP_PU_DELV_IN_COMPANY_SEQ',
    );
    const bizUnitFilter = this.parseOptionalPositiveInt(
      'ERP_PU_DELV_IN_BIZ_UNIT',
      'ERP_PU_DELV_IN_BIZ_UNIT',
    );

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
      this.logger.error(`PU DelvIn query failed: ${msg}`, err instanceof Error ? err.stack : undefined);
      throw new BadRequestException(
        `ERP 조회 쿼리 실행에 실패했습니다. 테이블·컬럼 정의를 확인하세요. (${msg.slice(0, 240)})`,
      );
    }

    const raw = result.recordset ?? [];
    const truncated = raw.length > maxRows;
    const slice = truncated ? raw.slice(0, maxRows) : raw;
    return {
      items: slice.map((r) => mapRow(r)),
      truncated,
    };
  }
}
