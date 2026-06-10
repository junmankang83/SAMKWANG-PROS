/**
 * 창고별수불집계 — `skkr_SWLGWHStockSumListQuery` 없이
 * `dbo._TLGInoutDaily`·`dbo._TLGInoutDailyItem`(또는 TLG* 동명) 기반 직접 집계.
 * 입고창고·출고창고에 수량을 나누어 이월·기간입고·기간출고·기말재고를 계산합니다.
 */
import { Logger } from '@nestjs/common';
import * as mssql from 'mssql';

export const WH_STOCK_SUM_DIRECT_SQL_VER = 2;

export function bracketIdent(name: string): string {
  return `[${name.replace(/\]/g, ']]')}]`;
}

export async function tableExists(pool: mssql.ConnectionPool, tableName: string): Promise<boolean> {
  const r = await pool
    .request()
    .input('tn', mssql.NVarChar(128), tableName)
    .query<{ c: number }>(
      `SELECT COUNT(1) AS c FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = @tn`,
    );
  return Number(r.recordset?.[0]?.c) > 0;
}

export async function listColumns(pool: mssql.ConnectionPool, tableName: string): Promise<{ COLUMN_NAME: string }[]> {
  const r = await pool
    .request()
    .input('tn', mssql.NVarChar(128), tableName)
    .query<{ COLUMN_NAME: string }>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = @tn`,
    );
  return r.recordset ?? [];
}

export function pickColumn(rows: { COLUMN_NAME: string }[], candidates: string[]): string | null {
  const map = new Map(rows.map((x) => [x.COLUMN_NAME.toUpperCase(), x.COLUMN_NAME]));
  for (const c of candidates) {
    const exact = map.get(c.toUpperCase());
    if (exact) return exact;
  }
  return null;
}

function pickSharedSeqJoinColumn(
  hCols: { COLUMN_NAME: string }[],
  iCols: { COLUMN_NAME: string }[],
): string | null {
  const hUpper = new Set(hCols.map((c) => c.COLUMN_NAME.toUpperCase()));
  const iUpper = new Set(iCols.map((c) => c.COLUMN_NAME.toUpperCase()));
  const exactByUpper = new Map(hCols.map((c) => [c.COLUMN_NAME.toUpperCase(), c.COLUMN_NAME]));

  const exclude = new Set(
    [
      'COMPANYSEQ',
      'BIZUNIT',
      'BIZUNITSEQ',
      'CUSTSEQ',
      'EMPSEQ',
      'DEPTSEQ',
      'WHSEQ',
      'OUTWHSEQ',
      'INWHSEQ',
      'FROMWHSEQ',
      'TOWHSEQ',
      'RECVWHSEQ',
      'ITEMSEQ',
      'UNITSEQ',
      'STDUNITSEQ',
      'PURORDERSEQ',
      'PJTSEQ',
      'PROJECTSEQ',
      'MODEMPSEQ',
      'REGEMPSEQ',
      'INSSEQ',
      'QCINSPSEQ',
    ].map((s) => s.toUpperCase()),
  );

  const preferOrder = [
    'TLGINOUTDAILYSEQ',
    'LGINOUTDAILYSEQ',
    'INOUTDAILYSEQ',
    'INOUTDAILYMASTERSEQ',
    'DAILYMASTERSEQ',
    'DAILYSEQ',
    'STKINOUTDAILYSEQ',
    'INVINOUTDAILYSEQ',
    'LEDGERDAILYSEQ',
    'LGSTKDAILYSEQ',
    'MASTERSEQ',
    'DOCSEQ',
    'SLIPSEQ',
    'PARENTSEQ',
    'HEADSEQ',
    'MAINSEQ',
  ];

  for (const p of preferOrder) {
    if (hUpper.has(p) && iUpper.has(p) && !exclude.has(p)) {
      return exactByUpper.get(p) ?? null;
    }
  }

  const scored: { name: string; score: number }[] = [];
  for (const h of hCols) {
    const u = h.COLUMN_NAME.toUpperCase();
    if (exclude.has(u) || !u.endsWith('SEQ')) continue;
    if (!iUpper.has(u)) continue;
    let score = 0;
    if (u.includes('INOUT')) score += 10;
    if (u.includes('DAILY')) score += 8;
    if (u.includes('TLG') || u.includes('LG')) score += 5;
    if (u.includes('MASTER') || u.includes('DOC') || u.includes('SLIP')) score += 3;
    scored.push({ name: h.COLUMN_NAME, score });
  }
  scored.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
  return scored[0]?.name ?? null;
}

function buildYmd8Expr(tableAlias: string, col: string): string {
  const c = `${tableAlias}.${bracketIdent(col)}`;
  return `CASE
    WHEN TRY_CONVERT(datetime, ${c}, 112) IS NOT NULL THEN CONVERT(CHAR(8), TRY_CONVERT(datetime, ${c}, 112), 112)
    WHEN TRY_CONVERT(datetime, ${c}) IS NOT NULL THEN CONVERT(CHAR(8), TRY_CONVERT(datetime, ${c}), 112)
    ELSE RIGHT(N'00000000' + LTRIM(RTRIM(CAST(${c} AS NVARCHAR(30)))), 8)
  END`;
}

function iColSql(iCols: { COLUMN_NAME: string }[], candidates: string[], sqlNull: string): string {
  const c = pickColumn(iCols, candidates);
  return c ? `i.${bracketIdent(c)}` : sqlNull;
}

function coalesceItemExpr(
  itCols: { COLUMN_NAME: string }[],
  candidates: string[],
  sqlNull: string,
): string {
  const c = pickColumn(itCols, candidates);
  return c ? `LTRIM(RTRIM(CAST(it.${bracketIdent(c)} AS NVARCHAR(500))))` : sqlNull;
}

/** `_TLGInoutDaily`·`_TLGInoutDailyItem` 기반 raw/flow CTE에 쓰는 식(창고별수불·창고별재고조회 공통) */
export type LgInoutDailyStockSqlCtx = {
  headerTable: string;
  itemTable: string;
  hTbl: string;
  iTbl: string;
  joinOn: string;
  ymdExpr: string;
  bizUnitExpr: string;
  qtyExpr: string;
  inWhExpr: string;
  outWhExpr: string;
  fallbackWhExpr: string;
  itemSeqCol: string;
  cancelSql: string;
  bizUnitCol: string | null;
};

/** @throws Error */
export async function resolveLgInoutDailyStockSqlCtx(
  pool: mssql.ConnectionPool,
  logger: Logger,
): Promise<LgInoutDailyStockSqlCtx> {
  let headerTable = '_TLGInoutDaily';
  if (!(await tableExists(pool, headerTable))) headerTable = 'TLGInoutDaily';
  if (!(await tableExists(pool, headerTable))) {
    throw new Error('ERP에 dbo._TLGInoutDaily 또는 dbo.TLGInoutDaily 테이블이 없습니다.');
  }

  let itemTable = '_TLGInoutDailyItem';
  if (!(await tableExists(pool, itemTable))) itemTable = 'TLGInoutDailyItem';
  if (!(await tableExists(pool, itemTable))) {
    throw new Error('ERP에 dbo._TLGInoutDailyItem 또는 dbo.TLGInoutDailyItem 테이블이 없습니다.');
  }

  const hTbl = `dbo.${bracketIdent(headerTable)}`;
  const iTbl = `dbo.${bracketIdent(itemTable)}`;

  const hCols = await listColumns(pool, headerTable);
  const iCols = await listColumns(pool, itemTable);

  const hSeqCandidates = [
    'TLGInoutDailySeq',
    'TLGInOutDailySeq',
    'LGInoutDailySeq',
    'LGInOutDailySeq',
    'LgInoutDailySeq',
    'InoutDailySeq',
    'InOutDailySeq',
    'InOutDailyMasterSeq',
    'InoutDailyMasterSeq',
    'DailyMasterSeq',
    'DailySeq',
    'StkInoutDailySeq',
    'InvInoutDailySeq',
    'LedgerDailySeq',
    'LgStkDailySeq',
    'MasterSeq',
    'DocSeq',
    'SlipSeq',
    'ParentSeq',
    'HeadSeq',
  ];

  const sharedSeq = pickSharedSeqJoinColumn(hCols, iCols);
  let hSeq: string;
  let iSeq: string;
  if (sharedSeq) {
    hSeq = sharedSeq;
    iSeq = sharedSeq;
    logger.log(`WH stock sum direct: 헤더·라인 동일 Seq → ${hSeq}`);
  } else {
    const pickedH = pickColumn(hCols, hSeqCandidates);
    if (!pickedH) {
      throw new Error(`${headerTable}에서 일별수불 키 컬럼(…Seq)을 찾지 못했습니다.`);
    }
    const pickedI = pickColumn(iCols, [pickedH, ...hSeqCandidates]);
    if (!pickedI) {
      throw new Error(`${itemTable}에 헤더와 조인할 키 컬럼이 없습니다.`);
    }
    hSeq = pickedH;
    iSeq = pickedI;
  }

  const hDate =
    pickColumn(hCols, [
      'InOutDate',
      'InoutDate',
      'MoveDate',
      'SlipDate',
      'WorkDate',
      'RegDate',
      'InsDate',
      'DailyDate',
    ]) ?? (() => {
      throw new Error(`${headerTable}에서 수불일자 컬럼을 찾을 수 없습니다.`);
    })();

  const ymdExpr = buildYmd8Expr('h', hDate);

  const bizUnitCol = pickColumn(hCols, ['BizUnit', 'BizUnitSeq', 'SiteSeq', 'WorkPlaceSeq']);
  const bizUnitExpr = bizUnitCol
    ? `TRY_CAST(h.${bracketIdent(bizUnitCol)} AS INT)`
    : `CAST(@BizUnit AS INT)`;

  const qtyExpr = iColSql(
    iCols,
    ['Qty', 'InOutQty', 'MoveQty', 'StockQty', 'LGQty', 'StkQty'],
    'CAST(NULL AS decimal(19, 5))',
  );

  const iOutWh = pickColumn(iCols, ['OutWHSeq', 'FromWHSeq', 'ShipWHSeq', 'OutWhSeq', 'OSOutWHSeq']);
  const hOutWh = pickColumn(hCols, ['OutWHSeq', 'FromWHSeq', 'ShipWHSeq']);
  const outWhExpr =
    iOutWh != null
      ? `NULLIF(i.${bracketIdent(iOutWh)}, 0)`
      : hOutWh != null
        ? `NULLIF(h.${bracketIdent(hOutWh)}, 0)`
        : `CAST(NULL AS INT)`;

  const iInWh = pickColumn(iCols, ['InWHSeq', 'ToWHSeq', 'RecvWHSeq', 'InWhSeq', 'RecvInWHSeq']);
  const hInWh = pickColumn(hCols, ['InWHSeq', 'ToWHSeq', 'RecvWHSeq']);
  const inWhExpr =
    iInWh != null
      ? `NULLIF(i.${bracketIdent(iInWh)}, 0)`
      : hInWh != null
        ? `NULLIF(h.${bracketIdent(hInWh)}, 0)`
        : `CAST(NULL AS INT)`;

  const lineWhCol = pickColumn(iCols, ['WHSeq', 'StkWHSeq', 'StockWHSeq', 'MainWHSeq', 'BaseWHSeq']);
  const fallbackWhExpr = lineWhCol ? `NULLIF(i.${bracketIdent(lineWhCol)}, 0)` : `CAST(NULL AS INT)`;

  const itemSeqCol = pickColumn(iCols, ['ItemSeq', 'TDAItemSeq', 'ProdItemSeq']);
  if (!itemSeqCol) {
    throw new Error(`${itemTable}에서 ItemSeq 컬럼을 찾을 수 없습니다.`);
  }

  const hCancel = pickColumn(hCols, ['CancelYn', 'IsCancel', 'Canceled', 'DocCancelYn', 'CancelYN']);
  const iCancel = pickColumn(iCols, ['CancelYn', 'IsCancel', 'Canceled', 'CancelYN']);
  const cancelParts: string[] = [];
  if (hCancel) {
    cancelParts.push(
      `(h.${bracketIdent(hCancel)} IS NULL OR LTRIM(RTRIM(UPPER(CAST(h.${bracketIdent(hCancel)} AS NVARCHAR(10))))) NOT IN (N'Y', N'1', N'C', N'T'))`,
    );
  }
  if (iCancel) {
    cancelParts.push(
      `(i.${bracketIdent(iCancel)} IS NULL OR LTRIM(RTRIM(UPPER(CAST(i.${bracketIdent(iCancel)} AS NVARCHAR(10))))) NOT IN (N'Y', N'1', N'C', N'T'))`,
    );
  }
  const cancelSql = cancelParts.length ? ` AND ${cancelParts.join(' AND ')}` : '';

  const joinOn = `h.CompanySeq = i.CompanySeq AND h.${bracketIdent(hSeq)} = i.${bracketIdent(iSeq)}`;

  return {
    headerTable,
    itemTable,
    hTbl,
    iTbl,
    joinOn,
    ymdExpr,
    bizUnitExpr,
    qtyExpr,
    inWhExpr,
    outWhExpr,
    fallbackWhExpr,
    itemSeqCol,
    cancelSql,
    bizUnitCol,
  };
}

/** @throws Error 메시지는 서비스에서 BadRequest로 감쌉니다 */
export async function buildWhStockSumDirectSql(pool: mssql.ConnectionPool, logger: Logger): Promise<string> {
  const ctx = await resolveLgInoutDailyStockSqlCtx(pool, logger);
  const {
    hTbl,
    iTbl,
    joinOn,
    ymdExpr,
    bizUnitExpr,
    qtyExpr,
    inWhExpr,
    outWhExpr,
    fallbackWhExpr,
    itemSeqCol,
    cancelSql,
    bizUnitCol,
  } = ctx;

  let itemJoin = '';
  let itemNameSel = `CAST(NULL AS NVARCHAR(200))`;
  let itemNoSel = `CAST(NULL AS NVARCHAR(100))`;
  let specSel = `CAST(NULL AS NVARCHAR(200))`;
  let itemClassLNameSel = `CAST(NULL AS NVARCHAR(100))`;
  let itemClassMNameSel = `CAST(NULL AS NVARCHAR(100))`;
  let itemClassSNameSel = `CAST(NULL AS NVARCHAR(100))`;
  let unitJoin = '';
  let unitNameSel = `CAST(NULL AS NVARCHAR(30))`;
  let itemKindSel = `CAST(NULL AS NVARCHAR(100))`;
  let locationSel = `CAST(NULL AS NVARCHAR(500))`;
  let manageJoin = '';
  let manageUnitNameSel = `CAST(NULL AS NVARCHAR(30))`;
  let safetyStockSel = `CAST(NULL AS DECIMAL(19, 3))`;

  const hasItemMaster = await tableExists(pool, '_TDAItem');
  if (hasItemMaster) {
    const itCols = await listColumns(pool, '_TDAItem');
    itemJoin = `LEFT JOIN dbo.[_TDAItem] it ON agg.CompanySeq = it.CompanySeq AND agg.ItemSeq = it.ItemSeq`;
    itemNameSel = `${coalesceItemExpr(itCols, ['ItemName', 'ItemEngName'], 'CAST(NULL AS NVARCHAR(200))')}`;
    itemNoSel = `${coalesceItemExpr(itCols, ['ItemNo', 'ItemCd', 'ItemCode', 'ProdNo'], 'CAST(NULL AS NVARCHAR(100))')}`;
    specSel = `${coalesceItemExpr(itCols, ['Spec', 'ItemSpec'], 'CAST(NULL AS NVARCHAR(200))')}`;
    itemClassLNameSel = `${coalesceItemExpr(itCols, ['ItemClassLName', 'ItemGrpLName', 'ClassLName'], 'CAST(NULL AS NVARCHAR(100))')}`;
    itemClassMNameSel = `${coalesceItemExpr(itCols, ['ItemClassMName', 'ItemGrpMName', 'ClassMName'], 'CAST(NULL AS NVARCHAR(100))')}`;
    itemClassSNameSel = `${coalesceItemExpr(itCols, ['ItemClassSName', 'ItemGrpSName', 'ClassSName'], 'CAST(NULL AS NVARCHAR(100))')}`;
    itemKindSel = `${coalesceItemExpr(itCols, ['ItemKindName', 'ItemAcctName', 'UMItemKindName', 'ItemGrpName', 'SMABCName'], 'CAST(NULL AS NVARCHAR(100))')}`;
    locationSel = `${coalesceItemExpr(itCols, ['Location', 'ItemLocation', 'PlaceName', 'StkLocation', 'WHLocation'], 'CAST(NULL AS NVARCHAR(500))')}`;
    const safetyCol = pickColumn(itCols, ['SafetyStockQty', 'SafetyStock', 'SafeStkQty', 'SafeQty', 'SafetyQty']);
    safetyStockSel = safetyCol
      ? `TRY_CAST(it.${bracketIdent(safetyCol)} AS DECIMAL(19, 3))`
      : `CAST(NULL AS DECIMAL(19, 3))`;

    if (await tableExists(pool, '_TDAUnit')) {
      unitJoin = `LEFT JOIN dbo.[_TDAUnit] u ON agg.CompanySeq = u.CompanySeq AND u.UnitSeq = it.UnitSeq`;
      unitNameSel = `LTRIM(RTRIM(CAST(u.UnitName AS NVARCHAR(30))))`;
    }

    const mUnitSeq = pickColumn(itCols, ['ManageUnitSeq', 'MngUnitSeq', 'CtrlUnitSeq', 'StdManageUnitSeq']);
    if (mUnitSeq && (await tableExists(pool, '_TDAUnit'))) {
      manageJoin = `LEFT JOIN dbo.[_TDAUnit] mu ON agg.CompanySeq = mu.CompanySeq AND NULLIF(it.${bracketIdent(mUnitSeq)}, 0) = mu.UnitSeq`;
      manageUnitNameSel = `LTRIM(RTRIM(CAST(mu.UnitName AS NVARCHAR(30))))`;
    } else {
      manageUnitNameSel = unitNameSel;
    }
  }

  let whJoin = `LEFT JOIN dbo.[_TDAWH] wh ON agg.CompanySeq = wh.CompanySeq AND agg.WHSeq = wh.WHSeq`;
  let whNameSel = `LTRIM(RTRIM(CAST(wh.WHName AS NVARCHAR(100))))`;
  let whCodeSel = `CAST(agg.WHSeq AS NVARCHAR(40))`;
  if (await tableExists(pool, '_TDAWH')) {
    const whCols = await listColumns(pool, '_TDAWH');
    const whNo = pickColumn(whCols, ['WHNo', 'WHCode', 'WHCd', 'WarehouseNo', 'WHNumber', 'WHID']);
    if (whNo) {
      whCodeSel = `LTRIM(RTRIM(CAST(wh.${bracketIdent(whNo)} AS NVARCHAR(40))))`;
    }
  } else {
    whJoin = `LEFT JOIN (SELECT CAST(NULL AS INT) AS CompanySeq, CAST(NULL AS INT) AS WHSeq, CAST(NULL AS NVARCHAR(100)) AS WHName) wh ON 1=0`;
    whNameSel = `CAST(NULL AS NVARCHAR(100))`;
  }

  return `
SET NOCOUNT ON;
WITH raw AS (
  SELECT
      h.CompanySeq,
      ${bizUnitExpr} AS BizUnit,
      ${ymdExpr} AS InOutYmd,
      ABS(ISNULL(TRY_CAST(${qtyExpr} AS DECIMAL(19, 5)), 0)) AS LineQty,
      ${inWhExpr} AS InWHSeq,
      ${outWhExpr} AS OutWHSeq,
      ${fallbackWhExpr} AS FallbackWHSeq,
      i.${bracketIdent(itemSeqCol)} AS ItemSeq
  FROM ${hTbl} h
  INNER JOIN ${iTbl} i ON ${joinOn}
  WHERE h.CompanySeq = @companySeq
    AND (${bizUnitCol ? `TRY_CAST(h.${bracketIdent(bizUnitCol)} AS INT) = @BizUnit` : '1 = 1'})
    AND ${ymdExpr} <= @DateTo
    AND ${ymdExpr} >= @histFromYmd
    ${cancelSql}
),
flow AS (
  SELECT CompanySeq, BizUnit, ItemSeq, InOutYmd, InWHSeq AS WHSeq, LineQty AS InPart, CAST(0 AS DECIMAL(19, 5)) AS OutPart
  FROM raw WHERE InWHSeq IS NOT NULL AND InWHSeq <> 0
  UNION ALL
  SELECT CompanySeq, BizUnit, ItemSeq, InOutYmd, OutWHSeq, CAST(0 AS DECIMAL(19, 5)), LineQty
  FROM raw WHERE OutWHSeq IS NOT NULL AND OutWHSeq <> 0
  UNION ALL
  SELECT CompanySeq, BizUnit, ItemSeq, InOutYmd, FallbackWHSeq, LineQty, CAST(0 AS DECIMAL(19, 5))
  FROM raw
  WHERE (InWHSeq IS NULL OR InWHSeq = 0) AND (OutWHSeq IS NULL OR OutWHSeq = 0)
    AND FallbackWHSeq IS NOT NULL AND FallbackWHSeq <> 0
),
agg AS (
  SELECT
      CompanySeq,
      BizUnit,
      WHSeq,
      ItemSeq,
      SUM(CASE WHEN InOutYmd < @DateFr THEN InPart - OutPart ELSE 0 END) AS PrevQty,
      SUM(CASE WHEN InOutYmd >= @DateFr AND InOutYmd <= @DateTo THEN InPart ELSE 0 END) AS InQty,
      SUM(CASE WHEN InOutYmd >= @DateFr AND InOutYmd <= @DateTo THEN OutPart ELSE 0 END) AS OutQty
  FROM flow
  GROUP BY CompanySeq, BizUnit, WHSeq, ItemSeq
  HAVING
      ABS(SUM(CASE WHEN InOutYmd < @DateFr THEN InPart - OutPart ELSE 0 END)) >= 0.00001
      OR ABS(SUM(CASE WHEN InOutYmd >= @DateFr AND InOutYmd <= @DateTo THEN InPart ELSE 0 END)) >= 0.00001
      OR ABS(SUM(CASE WHEN InOutYmd >= @DateFr AND InOutYmd <= @DateTo THEN OutPart ELSE 0 END)) >= 0.00001
)
SELECT TOP (@fetchCount)
    ${itemKindSel} AS itemKind,
    ${itemClassSNameSel} AS itemGroupName,
    ${itemClassLNameSel} AS classLargeName,
    ${itemClassMNameSel} AS classMiddleName,
    ${itemNoSel} AS itemNo,
    ${itemNameSel} AS itemName,
    ${specSel} AS spec,
    ${unitNameSel} AS unitName,
    ${manageUnitNameSel} AS manageUnitName,
    ${whCodeSel} AS whCode,
    ${whNameSel} AS whName,
    ${locationSel} AS location,
    CAST(NULL AS NVARCHAR(200)) AS project,
    CAST(agg.PrevQty AS DECIMAL(19, 3)) AS openingQty,
    CAST(0 AS DECIMAL(19, 3)) AS openingAmt,
    CAST(agg.InQty AS DECIMAL(19, 3)) AS inQty,
    CAST(0 AS DECIMAL(19, 3)) AS inAmt,
    CAST(agg.OutQty AS DECIMAL(19, 3)) AS outQty,
    CAST(0 AS DECIMAL(19, 3)) AS outAmt,
    CAST(agg.PrevQty + agg.InQty - agg.OutQty AS DECIMAL(19, 3)) AS closingQty,
    CAST(0 AS DECIMAL(19, 3)) AS closingAmt,
    CAST(agg.PrevQty + agg.InQty - agg.OutQty AS DECIMAL(19, 3)) AS availStockQty,
    ${safetyStockSel} AS safetyStockQty,
    CAST(0 AS DECIMAL(19, 3)) AS poRequestQty,
    CAST(0 AS DECIMAL(19, 3)) AS poBalanceQty,
    CAST(0 AS DECIMAL(19, 3)) AS expectInQty,
    CAST(0 AS DECIMAL(19, 3)) AS expectOutQty,
    CAST(0 AS DECIMAL(19, 3)) AS expectAvailQty,
    CAST(0 AS DECIMAL(19, 3)) AS unpaidQty,
    CAST(0 AS DECIMAL(19, 3)) AS expectProdQty,
    CAST(0 AS DECIMAL(19, 3)) AS reservedQty,
    CAST(0 AS DECIMAL(19, 3)) AS shortageQty,
    CAST(0 AS DECIMAL(19, 3)) AS properStockQty,
    CAST(0 AS DECIMAL(19, 3)) AS excessStockQty,
    CAST(NULL AS DECIMAL(19, 6)) AS turnoverRate,
    CAST(NULL AS DECIMAL(19, 3)) AS turnoverDays
FROM agg
${itemJoin}
${unitJoin}
${manageJoin}
${whJoin}
ORDER BY agg.BizUnit ASC, agg.WHSeq ASC, agg.ItemSeq ASC;
`;
}
