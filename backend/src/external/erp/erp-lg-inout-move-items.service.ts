import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mssql from 'mssql';

/**
 * 이동 — 헤더·라인 `InOutType = 80`, 기간은 `_TLGInoutDaily.InOutDate` (ERP `_TLGInoutDaily`·`_TLGInoutDailyItem`)
 */
export type LgInoutMoveItemRow = {
  rowNo: number;
  outConfirmNo: string | null;
  moveDate: string;
  reviewDate: string | null;
  lastModAt: string | null;
  moveNo: string | null;
  moveReasonKind: string | null;
  refConfirm: string | null;
  writeStatus: string | null;
  receiptDelvReturnKind: string | null;
  itemName: string | null;
  itemCode: string | null;
  spec: string | null;
  unit: string | null;
  moveQty: number | null;
  lotNo: string | null;
  stdUnitQty: number | null;
  outWhName: string | null;
  inWhName: string | null;
  funcKind: string | null;
  processDeptName: string | null;
  chargeEmpName: string | null;
  specialNote: string | null;
  salesCustName: string | null;
  outDeptName: string | null;
  refCustName: string | null;
  moveReqNo: string | null;
  returnNo: string | null;
  cancelYn: string | null;
};

type SqlRow = {
  OutConfirmNo: string | null;
  MoveDateRaw: string | null;
  ReviewDateRaw: string | null;
  LastModRaw: string | null;
  MoveNo: string | null;
  MoveReasonKind: string | null;
  RefConfirm: string | null;
  WriteStatus: string | null;
  ReceiptDelvReturnKind: string | null;
  ItemName: string | null;
  ItemNo: string | null;
  Spec: string | null;
  UnitName: string | null;
  MoveQty: number | null;
  LotNo: string | null;
  StdUnitQty: number | null;
  OutWHName: string | null;
  InWHName: string | null;
  FuncKind: string | null;
  ProcessDeptName: string | null;
  ChargeEmpName: string | null;
  SpecialNote: string | null;
  SalesCustName: string | null;
  OutDeptName: string | null;
  RefCustName: string | null;
  MoveReqNo: string | null;
  ReturnNo: string | null;
  CancelYn: string | null;
};

const DEFAULT_LIMIT = 8000;
const MAX_RANGE_DAYS = 400;
const MOVE_IN_OUT_TYPE = 80;

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
  return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
}

function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapRow(r: SqlRow): Omit<LgInoutMoveItemRow, 'rowNo'> {
  return {
    outConfirmNo: trimOrNull(r.OutConfirmNo),
    moveDate: yyyymmddToIso(r.MoveDateRaw),
    reviewDate: yyyymmddToIso(r.ReviewDateRaw) || trimOrNull(r.ReviewDateRaw),
    lastModAt: trimOrNull(r.LastModRaw),
    moveNo: trimOrNull(r.MoveNo),
    moveReasonKind: trimOrNull(r.MoveReasonKind),
    refConfirm: trimOrNull(r.RefConfirm),
    writeStatus: trimOrNull(r.WriteStatus),
    receiptDelvReturnKind: trimOrNull(r.ReceiptDelvReturnKind),
    itemName: trimOrNull(r.ItemName),
    itemCode: trimOrNull(r.ItemNo),
    spec: trimOrNull(r.Spec),
    unit: trimOrNull(r.UnitName),
    moveQty: toNumber(r.MoveQty),
    lotNo: trimOrNull(r.LotNo),
    stdUnitQty: toNumber(r.StdUnitQty),
    outWhName: trimOrNull(r.OutWHName),
    inWhName: trimOrNull(r.InWHName),
    funcKind: trimOrNull(r.FuncKind),
    processDeptName: trimOrNull(r.ProcessDeptName),
    chargeEmpName: trimOrNull(r.ChargeEmpName),
    specialNote: trimOrNull(r.SpecialNote),
    salesCustName: trimOrNull(r.SalesCustName),
    outDeptName: trimOrNull(r.OutDeptName),
    refCustName: trimOrNull(r.RefCustName),
    moveReqNo: trimOrNull(r.MoveReqNo),
    returnNo: trimOrNull(r.ReturnNo),
    cancelYn: trimOrNull(r.CancelYn),
  };
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

function pickLineSerlColumn(iCols: { COLUMN_NAME: string }[]): string | null {
  const direct = pickColumn(iCols, [
    'LGInoutDailySerl',
    'TLGInoutDailySerl',
    'TLGInoutDailyItemSerl',
    'LGInoutDailyItemSerl',
    'InoutDailySerl',
    'InoutDailyItemSerl',
    'InOutDailySerl',
    'ItemSerl',
    'LineSerl',
    'Serl',
    'InOutSerl',
    'SlipSerl',
    'DocSerl',
    'DtlSerl',
    'SubSerl',
    'LineNo',
  ]);
  if (direct) return direct;

  const hint = ['INOUT', 'DAILY', 'LINE', 'ITEM', 'SLIP', 'DOC', 'TLG', 'LG'];
  const avoid = new Set(['PURORDERSERL', 'POSERL', 'QCINSPSSERL', 'INSPECTIONSERL'].map((s) => s.toUpperCase()));
  const hits: string[] = [];
  for (const row of iCols) {
    const u = row.COLUMN_NAME.toUpperCase();
    if (!u.endsWith('SERL')) continue;
    if (avoid.has(u)) continue;
    if (hint.some((h) => u.includes(h))) {
      hits.push(row.COLUMN_NAME);
    }
  }
  if (hits.length === 1) return hits[0];
  hits.sort((a, b) => a.length - b.length);
  return hits[0] ?? null;
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

function hColSql(hCols: { COLUMN_NAME: string }[], candidates: string[], sqlNull: string): string {
  const c = pickColumn(hCols, candidates);
  return c ? `h.${bracketIdent(c)}` : sqlNull;
}

function coalesceHiStr(
  hCols: { COLUMN_NAME: string }[],
  iCols: { COLUMN_NAME: string }[],
  candidates: string[],
  width: number,
  alias: string,
): string {
  const hc = pickColumn(hCols, candidates);
  const ic = pickColumn(iCols, candidates);
  if (hc && ic) {
    return `COALESCE(
      NULLIF(LTRIM(RTRIM(CAST(i.${bracketIdent(ic)} AS NVARCHAR(${width})))), N''),
      NULLIF(LTRIM(RTRIM(CAST(h.${bracketIdent(hc)} AS NVARCHAR(${width})))), N'')
    ) AS ${alias}`;
  }
  if (ic) {
    return `LTRIM(RTRIM(CAST(i.${bracketIdent(ic)} AS NVARCHAR(${width})))) AS ${alias}`;
  }
  if (hc) {
    return `LTRIM(RTRIM(CAST(h.${bracketIdent(hc)} AS NVARCHAR(${width})))) AS ${alias}`;
  }
  return `CAST(NULL AS NVARCHAR(${width})) AS ${alias}`;
}

type LgMoveSqlPlan = {
  headerTable: string;
  itemTable: string;
  hSeq: string;
  iSeq: string;
  iSerl: string;
  moveDateYmdExpr: string;
  inOutTypeWhereSql: string;
  lgKindApplySql: string;
  receiptDelvReturnSelectSql: string;
  outConfirmSql: string;
  moveNoSql: string;
  reviewDateSql: string;
  lastModSql: string;
  moveReasonSql: string;
  refConfirmSql: string;
  writeStatusSql: string;
  funcKindSql: string;
  qtySql: string;
  stdUnitQtySql: string;
  unitJoinSql: string;
  whJoinOutSql: string;
  whJoinInSql: string;
  deptJoinSql: string;
  deptNameSelect: string;
  empJoinSql: string;
  empNameSelect: string;
  salesCustJoinSql: string;
  salesCustNameSelect: string;
  outDeptJoinSql: string;
  outDeptNameSelect: string;
  refCustJoinSql: string;
  refCustNameSelect: string;
  itemSeqCol: string;
  specialNoteSql: string;
  moveReqSql: string;
  returnNoSql: string;
  cancelYnSql: string;
  lotNoSql: string;
  bizUnitHeaderCol: string | null;
};

async function resolveLgMoveSqlPlan(pool: mssql.ConnectionPool, logger: Logger): Promise<LgMoveSqlPlan> {
  let headerTable = '_TLGInoutDaily';
  if (!(await tableExists(pool, headerTable))) {
    headerTable = 'TLGInoutDaily';
  }
  if (!(await tableExists(pool, headerTable))) {
    throw new ServiceUnavailableException('ERP에 dbo._TLGInoutDaily 또는 dbo.TLGInoutDaily 테이블이 없습니다.');
  }

  let itemTable = '_TLGInoutDailyItem';
  if (!(await tableExists(pool, itemTable))) {
    itemTable = 'TLGInoutDailyItem';
  }
  if (!(await tableExists(pool, itemTable))) {
    throw new ServiceUnavailableException(
      'ERP에 dbo._TLGInoutDailyItem 또는 dbo.TLGInoutDailyItem 테이블이 없습니다.',
    );
  }

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
    logger.log(`LG move: 헤더·라인 동일 Seq로 조인 → ${hSeq}`);
  } else {
    const pickedH = pickColumn(hCols, hSeqCandidates);
    if (!pickedH) {
      throw new ServiceUnavailableException(
        `${headerTable}에서 일별수불 키 컬럼을 찾지 못했습니다. INFORMATION_SCHEMA로 Seq 컬럼명을 확인하세요.`,
      );
    }
    const pickedI = pickColumn(iCols, [pickedH, ...hSeqCandidates]);
    if (!pickedI) {
      throw new ServiceUnavailableException(
        `${itemTable}에 헤더와 조인할 키 컬럼(헤더 ${pickedH}와 동일 이름의 …Seq)이 없습니다.`,
      );
    }
    hSeq = pickedH;
    iSeq = pickedI;
  }

  const iSerl = pickLineSerlColumn(iCols);
  if (!iSerl) {
    throw new ServiceUnavailableException(`${itemTable}에 라인 순번(…Serl) 컬럼을 찾을 수 없습니다.`);
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
    ]) ??
    (() => {
      throw new ServiceUnavailableException(`${headerTable}에서 이동일 컬럼을 찾을 수 없습니다.`);
    })();

  const hYmd = buildYmd8Expr('h', hDate);
  /** 기간: 반드시 헤더 `_TLGInoutDaily.InOutDate`(감지된 일자 컬럼) 기준 */
  const moveDateYmdExpr = hYmd;

  const inOutTypeCandidates = [
    'InOutType',
    'InoutType',
    'SMInOutType',
    'LGInOutType',
    'SMMainInOutType',
    'LGInOutKind',
    'InOutKind',
    'SMInOutKind',
  ];
  const hInOut = pickColumn(hCols, inOutTypeCandidates);
  const iInOut = pickColumn(iCols, inOutTypeCandidates);
  if (!hInOut && !iInOut) {
    throw new ServiceUnavailableException(
      `${headerTable}/${itemTable}에서 InOutType(수불구분) 컬럼을 찾을 수 없습니다.`,
    );
  }
  const inOutInt = (alias: 'h' | 'i', col: string) =>
    `TRY_CONVERT(int, LTRIM(RTRIM(CAST(${alias}.${bracketIdent(col)} AS NVARCHAR(30)))))`;
  const inOutTypeWhereSql = (() => {
    if (hInOut && iInOut) {
      return `(${inOutInt('h', hInOut)} = ${MOVE_IN_OUT_TYPE} AND ${inOutInt('i', iInOut)} = ${MOVE_IN_OUT_TYPE})`;
    }
    if (hInOut) {
      return `${inOutInt('h', hInOut)} = ${MOVE_IN_OUT_TYPE}`;
    }
    return `${inOutInt('i', iInOut!)} = ${MOVE_IN_OUT_TYPE}`;
  })();

  /** 납품반품구분: 소분류 조인 + 코드 보조 */
  const kindColCandidates = [
    'SMDelvReturnKind',
    'SMDelvKind',
    'SMRecvKind',
    'UMDelvReturnKind',
    'UMRecvKind',
    'DelvReturnKind',
    'RecvReturnKind',
    'InOutKind2',
    'OSPSMInKind',
    'SMInKind',
    'InOutMoveKind',
    'UMRecvInOutKind',
    'SMRecvInOutKind',
    'RecvInOutKind',
  ];
  const hKindPick = pickColumn(hCols, kindColCandidates);
  const iKindPick = pickColumn(iCols, kindColCandidates);
  const rawKindBase = (() => {
    const hExpr = hKindPick ? `LTRIM(RTRIM(CAST(h.${bracketIdent(hKindPick)} AS NVARCHAR(50))))` : `CAST(NULL AS NVARCHAR(50))`;
    const iExpr = iKindPick ? `LTRIM(RTRIM(CAST(i.${bracketIdent(iKindPick)} AS NVARCHAR(50))))` : `CAST(NULL AS NVARCHAR(50))`;
    return `COALESCE(NULLIF(${iExpr}, N''), NULLIF(${hExpr}, N''))`;
  })();

  const kindCase = (tbl: 'h' | 'i', col: string | null): string => {
    if (!col) return `CAST(NULL AS NVARCHAR(20))`;
    const c = `${tbl}.${bracketIdent(col)}`;
    return `CASE LTRIM(RTRIM(UPPER(CAST(${c} AS NVARCHAR(20)))))
      WHEN N'1' THEN N'납품'
      WHEN N'0' THEN N'납품'
      WHEN N'Y' THEN N'납품'
      WHEN N'2' THEN N'반품'
      WHEN N'N' THEN N'반품'
      WHEN N'납품' THEN N'납품'
      WHEN N'반품' THEN N'반품'
      ELSE CAST(NULL AS NVARCHAR(20))
    END`;
  };

  let lgKindApplySql = '';
  let receiptDelvReturnSelectSql = `COALESCE(${kindCase('h', hKindPick)}, ${kindCase('i', iKindPick)}, ${rawKindBase}) AS ReceiptDelvReturnKind`;

  if (await tableExists(pool, '_TDAUMinorValue')) {
    const umCols = await listColumns(pool, '_TDAUMinorValue');
    const mvMinor = pickColumn(umCols, ['MinorSeq', 'MINORSEQ', 'UMMinorSeq']);
    const mvMinorName = pickColumn(umCols, ['MinorName', 'MINORNAME', 'UMinorName', 'MinorDesc']);
    const mvVt = pickColumn(umCols, ['ValueText', 'VALUETEXT', 'MinorValueText']);
    const mvComp = pickColumn(umCols, ['CompanySeq', 'COMPANYSEQ']);
    if (mvMinor && (mvMinorName || mvVt) && (hKindPick || iKindPick)) {
      const namePart =
        mvMinorName && mvVt
          ? `COALESCE(
            NULLIF(LTRIM(RTRIM(CAST(umkLg.${bracketIdent(mvMinorName)} AS NVARCHAR(200)))), N''),
            NULLIF(LTRIM(RTRIM(CAST(umkLg.${bracketIdent(mvVt)} AS NVARCHAR(200)))), N'')
          )`
          : mvMinorName
            ? `LTRIM(RTRIM(CAST(umkLg.${bracketIdent(mvMinorName)} AS NVARCHAR(200))))`
            : `LTRIM(RTRIM(CAST(umkLg.${bracketIdent(mvVt!)} AS NVARCHAR(200))))`;
      const compClause = mvComp
        ? `(umkLg.${bracketIdent(mvComp)} = h.CompanySeq OR umkLg.${bracketIdent(mvComp)} IS NULL)`
        : '1 = 1';
      const ors: string[] = [];
      if (hKindPick) {
        ors.push(`CAST(umkLg.${bracketIdent(mvMinor)} AS NVARCHAR(50)) = CAST(h.${bracketIdent(hKindPick)} AS NVARCHAR(50))`);
        if (mvVt) {
          ors.push(
            `LTRIM(RTRIM(CAST(umkLg.${bracketIdent(mvVt)} AS NVARCHAR(100)))) = LTRIM(RTRIM(CAST(h.${bracketIdent(hKindPick)} AS NVARCHAR(100))))`,
          );
        }
      }
      if (iKindPick) {
        ors.push(`CAST(umkLg.${bracketIdent(mvMinor)} AS NVARCHAR(50)) = CAST(i.${bracketIdent(iKindPick)} AS NVARCHAR(50))`);
        if (mvVt) {
          ors.push(
            `LTRIM(RTRIM(CAST(umkLg.${bracketIdent(mvVt)} AS NVARCHAR(100)))) = LTRIM(RTRIM(CAST(i.${bracketIdent(iKindPick)} AS NVARCHAR(100))))`,
          );
        }
      }
      if (ors.length > 0) {
        lgKindApplySql = `OUTER APPLY (
    SELECT TOP (1) ${namePart} AS LgKindText
    FROM dbo.[_TDAUMinorValue] umkLg
    WHERE ${compClause}
      AND (${ors.join('\n      OR ')})
    ORDER BY CASE WHEN ${mvComp ? `umkLg.${bracketIdent(mvComp)} = h.CompanySeq` : '1'} THEN 0 ELSE 1 END
  ) lgKind`;
        receiptDelvReturnSelectSql = `COALESCE(
      NULLIF(lgKind.LgKindText, N''),
      ${kindCase('h', hKindPick)},
      ${kindCase('i', iKindPick)},
      ${rawKindBase}
    ) AS ReceiptDelvReturnKind`;
      }
    }
  }

  const outConfirmSql = coalesceHiStr(
    hCols,
    iCols,
    [
      'OutCnfmSeq',
      'OutCnfmNo',
      'OutConfirmNo',
      'ShipCnfmNo',
      'LGOutCnfmNo',
      'CnfmOutNo',
      'ShipInstNo',
      'OutFixNo',
    ],
    80,
    'OutConfirmNo',
  );

  const moveNoSql = (() => {
    const c = pickColumn(hCols, [
      'LGInoutDailyNo',
      'TLGInoutDailyNo',
      'InoutDailyNo',
      'InOutDailyNo',
      'SlipNo',
      'DocNo',
      'MoveNo',
    ]);
    return c
      ? `LTRIM(RTRIM(CAST(h.${bracketIdent(c)} AS NVARCHAR(60)))) AS MoveNo`
      : `CAST(NULL AS NVARCHAR(60)) AS MoveNo`;
  })();

  const reviewColH = pickColumn(hCols, ['ReviewDate', 'ChkDate', 'CheckDate2', 'AuditDate', 'ReadDate']);
  const reviewColI = pickColumn(iCols, ['ReviewDate', 'ChkDate', 'CheckDate2', 'AuditDate']);
  const reviewExpr =
    reviewColI && reviewColH
      ? `COALESCE(i.${bracketIdent(reviewColI)}, h.${bracketIdent(reviewColH)})`
      : reviewColI
        ? `i.${bracketIdent(reviewColI)}`
        : reviewColH
          ? `h.${bracketIdent(reviewColH)}`
          : null;
  const reviewDateSql = reviewExpr
    ? `CASE
    WHEN TRY_CONVERT(datetime, ${reviewExpr}, 112) IS NOT NULL THEN CONVERT(CHAR(8), TRY_CONVERT(datetime, ${reviewExpr}, 112), 112)
    WHEN TRY_CONVERT(datetime, ${reviewExpr}) IS NOT NULL THEN CONVERT(CHAR(8), TRY_CONVERT(datetime, ${reviewExpr}), 112)
    ELSE RIGHT(N'00000000' + LTRIM(RTRIM(CAST(${reviewExpr} AS NVARCHAR(30)))), 8)
  END AS ReviewDateRaw`
    : `CAST(NULL AS CHAR(8)) AS ReviewDateRaw`;

  const lastDt = pickColumn(hCols, [
    'LastDateTime',
    'ModDateTime',
    'UpdDateTime',
    'EditDateTime',
    'InsDateTime',
  ]);
  const lastModSql = lastDt
    ? `CONVERT(NVARCHAR(50), h.${bracketIdent(lastDt)}, 120) AS LastModRaw`
    : `CAST(NULL AS NVARCHAR(50)) AS LastModRaw`;

  const moveReasonSql = coalesceHiStr(
    hCols,
    iCols,
    [
      'MoveReasonKindName',
      'MoveReasonName',
      'InOutReasonName',
      'UMMoveReason',
      'SMMoveReason',
      'InOutKindName',
      'MoveKindName',
      'InOutKind',
    ],
    100,
    'MoveReasonKind',
  );

  const refConfirmSql = coalesceHiStr(
    hCols,
    iCols,
    ['RefCnfm', 'RefConfirmYn', 'RefChkYn', 'RefCheckYn', 'ReferCnfm', 'RefYn'],
    40,
    'RefConfirm',
  );

  const writeStatusSql = coalesceHiStr(
    hCols,
    iCols,
    [
      'DocStatName',
      'SlipStatName',
      'WriteStatusName',
      'ApproveStatName',
      'UMDocStatName',
      'UMProgStatName',
      'ProgStatusName',
      'StatusName',
      'StatDesc',
      'ProgStatDesc',
      'SlipStat',
      'DocStat',
      'WriteStat',
      'UMWriteStat',
    ],
    80,
    'WriteStatus',
  );

  const funcKindSql = coalesceHiStr(
    hCols,
    iCols,
    [
      'FuncKindName',
      'UMFuncKind',
      'SMFuncKind',
      'FeatureKindName',
      'InOutStatName',
      'ProgStatName',
      'WorkStatName',
      'NormalStatName',
      'SlipKindName',
      'UMInOutStat',
      'SMInOutStat',
      'DocFuncName',
      'InOutFuncName',
    ],
    100,
    'FuncKind',
  );

  const qtySql = iColSql(iCols, ['Qty', 'InOutQty', 'MoveQty', 'StockQty', 'LGQty'], 'CAST(NULL AS decimal(18, 6))');

  const stdUnitQtyCol = pickColumn(iCols, [
    'StdUnitQty',
    'STDUnitQty',
    'UnitStdQty',
    'BaseUnitQty',
    'StdQty',
    'StdBaseQty',
    'ManageUnitQty',
    'StdConvQty',
    'STDConvQty',
  ]);
  const stdUnitQtySql = stdUnitQtyCol
    ? `TRY_CAST(i.${bracketIdent(stdUnitQtyCol)} AS decimal(18, 6)) AS StdUnitQty`
    : `TRY_CAST(${qtySql} AS decimal(18, 6)) AS StdUnitQty`;

  const unitSeqCol = pickColumn(iCols, ['UnitSeq', 'ItemUnitSeq']);
  const unitJoinSql =
    unitSeqCol != null
      ? `LEFT JOIN dbo.[_TDAUnit] u ON h.CompanySeq = u.CompanySeq AND u.UnitSeq = COALESCE(NULLIF(i.${bracketIdent(unitSeqCol)}, 0), it.UnitSeq)`
      : `LEFT JOIN dbo.[_TDAUnit] u ON h.CompanySeq = u.CompanySeq AND u.UnitSeq = it.UnitSeq`;

  const iOutWh = pickColumn(iCols, ['OutWHSeq', 'FromWHSeq', 'ShipWHSeq', 'OutWhSeq', 'OSOutWHSeq']);
  const hOutWh = pickColumn(hCols, ['OutWHSeq', 'FromWHSeq', 'ShipWHSeq']);
  const outWhExpr =
    iOutWh != null
      ? `NULLIF(i.${bracketIdent(iOutWh)}, 0)`
      : hOutWh != null
        ? `NULLIF(h.${bracketIdent(hOutWh)}, 0)`
        : 'CAST(NULL AS INT)';

  const iInWh = pickColumn(iCols, ['InWHSeq', 'ToWHSeq', 'RecvWHSeq', 'InWhSeq', 'RecvInWHSeq']);
  const hInWh = pickColumn(hCols, ['InWHSeq', 'ToWHSeq', 'RecvWHSeq']);
  const inWhExpr =
    iInWh != null
      ? `NULLIF(i.${bracketIdent(iInWh)}, 0)`
      : hInWh != null
        ? `NULLIF(h.${bracketIdent(hInWh)}, 0)`
        : 'CAST(NULL AS INT)';

  const whJoinOutSql =
    iOutWh || hOutWh
      ? `LEFT JOIN dbo.[_TDAWH] whOut ON h.CompanySeq = whOut.CompanySeq AND whOut.WHSeq = ${outWhExpr}`
      : `LEFT JOIN dbo.[_TDAWH] whOut ON 1 = 0`;
  const whJoinInSql =
    iInWh || hInWh
      ? `LEFT JOIN dbo.[_TDAWH] whIn ON h.CompanySeq = whIn.CompanySeq AND whIn.WHSeq = ${inWhExpr}`
      : `LEFT JOIN dbo.[_TDAWH] whIn ON 1 = 0`;

  const hDeptSeq = pickColumn(hCols, ['DeptSeq', 'ProcDeptSeq', 'ChargeDeptSeq', 'InDeptSeq', 'PicDeptSeq']);
  const deptJoinSql = hDeptSeq
    ? `LEFT JOIN dbo.[_TDADept] dpLg ON h.CompanySeq = dpLg.CompanySeq AND h.${bracketIdent(hDeptSeq)} = dpLg.DeptSeq`
    : `LEFT JOIN dbo.[_TDADept] dpLg ON 1 = 0`;
  const deptNameSelect = hDeptSeq
    ? `LTRIM(RTRIM(CAST(dpLg.DeptName AS NVARCHAR(200)))) AS ProcessDeptName`
    : `CAST(NULL AS NVARCHAR(200)) AS ProcessDeptName`;

  const hEmpSeq = pickColumn(hCols, ['EmpSeq', 'PicEmpSeq', 'ChargeEmpSeq', 'InEmpSeq', 'UserSeq', 'RegEmpSeq']);
  const empJoinSql = hEmpSeq
    ? `LEFT JOIN dbo.[_TDAEmp] empLg ON h.CompanySeq = empLg.CompanySeq AND h.${bracketIdent(hEmpSeq)} = empLg.EmpSeq`
    : `LEFT JOIN dbo.[_TDAEmp] empLg ON 1 = 0`;
  const empNameSelect = hEmpSeq
    ? `LTRIM(RTRIM(CAST(empLg.EmpName AS NVARCHAR(100)))) AS ChargeEmpName`
    : `CAST(NULL AS NVARCHAR(100)) AS ChargeEmpName`;

  const salesCustSeqH = pickColumn(hCols, [
    'SaleCustSeq',
    'SalesCustSeq',
    'SLCustSeq',
    'SellCustSeq',
    'SalesTradeCustSeq',
    'SMCustSeq',
  ]);
  const salesCustSeqI = pickColumn(iCols, [
    'SaleCustSeq',
    'SalesCustSeq',
    'SLCustSeq',
    'SellCustSeq',
    'SalesTradeCustSeq',
  ]);
  let salesCustJoinSql = `LEFT JOIN dbo.[_TDACust] custSale ON 1 = 0`;
  let salesCustNameSelect = `CAST(NULL AS NVARCHAR(200)) AS SalesCustName`;
  if (salesCustSeqH) {
    salesCustJoinSql = `LEFT JOIN dbo.[_TDACust] custSale ON h.CompanySeq = custSale.CompanySeq AND NULLIF(h.${bracketIdent(salesCustSeqH)}, 0) = custSale.CustSeq`;
    salesCustNameSelect = `LTRIM(RTRIM(CAST(custSale.CustName AS NVARCHAR(200)))) AS SalesCustName`;
  } else if (salesCustSeqI) {
    salesCustJoinSql = `LEFT JOIN dbo.[_TDACust] custSale ON h.CompanySeq = custSale.CompanySeq AND NULLIF(i.${bracketIdent(salesCustSeqI)}, 0) = custSale.CustSeq`;
    salesCustNameSelect = `LTRIM(RTRIM(CAST(custSale.CustName AS NVARCHAR(200)))) AS SalesCustName`;
  }

  const outDeptSeqH = pickColumn(hCols, [
    'OutDeptSeq',
    'ShipDeptSeq',
    'FromDeptSeq',
    'OutPicDeptSeq',
    'OSOutDeptSeq',
  ]);
  const outDeptSeqI = pickColumn(iCols, ['OutDeptSeq', 'ShipDeptSeq', 'FromDeptSeq', 'OutPicDeptSeq']);
  let outDeptJoinSql = `LEFT JOIN dbo.[_TDADept] dpOut ON 1 = 0`;
  let outDeptNameSelect = `CAST(NULL AS NVARCHAR(200)) AS OutDeptName`;
  if (outDeptSeqH) {
    outDeptJoinSql = `LEFT JOIN dbo.[_TDADept] dpOut ON h.CompanySeq = dpOut.CompanySeq AND NULLIF(h.${bracketIdent(outDeptSeqH)}, 0) = dpOut.DeptSeq`;
    outDeptNameSelect = `LTRIM(RTRIM(CAST(dpOut.DeptName AS NVARCHAR(200)))) AS OutDeptName`;
  } else if (outDeptSeqI) {
    outDeptJoinSql = `LEFT JOIN dbo.[_TDADept] dpOut ON h.CompanySeq = dpOut.CompanySeq AND NULLIF(i.${bracketIdent(outDeptSeqI)}, 0) = dpOut.DeptSeq`;
    outDeptNameSelect = `LTRIM(RTRIM(CAST(dpOut.DeptName AS NVARCHAR(200)))) AS OutDeptName`;
  }

  const refCustSeqH = pickColumn(hCols, ['RefCustSeq', 'ReferCustSeq', 'RefTradeCustSeq', 'LinkCustSeq']);
  const refCustSeqI = pickColumn(iCols, ['RefCustSeq', 'ReferCustSeq', 'RefTradeCustSeq', 'LinkCustSeq']);
  let refCustJoinSql = `LEFT JOIN dbo.[_TDACust] custRef ON 1 = 0`;
  let refCustNameSelect = `CAST(NULL AS NVARCHAR(200)) AS RefCustName`;
  if (refCustSeqH) {
    refCustJoinSql = `LEFT JOIN dbo.[_TDACust] custRef ON h.CompanySeq = custRef.CompanySeq AND NULLIF(h.${bracketIdent(refCustSeqH)}, 0) = custRef.CustSeq`;
    refCustNameSelect = `LTRIM(RTRIM(CAST(custRef.CustName AS NVARCHAR(200)))) AS RefCustName`;
  } else if (refCustSeqI) {
    refCustJoinSql = `LEFT JOIN dbo.[_TDACust] custRef ON h.CompanySeq = custRef.CompanySeq AND NULLIF(i.${bracketIdent(refCustSeqI)}, 0) = custRef.CustSeq`;
    refCustNameSelect = `LTRIM(RTRIM(CAST(custRef.CustName AS NVARCHAR(200)))) AS RefCustName`;
  }

  const itemSeqCol =
    pickColumn(iCols, ['ItemSeq', 'MatSeq', 'MaterialSeq']) ??
    (() => {
      throw new ServiceUnavailableException(`${itemTable}에 ItemSeq(또는 MatSeq)가 없습니다.`);
    })();

  const specialNoteSql = iColSql(
    iCols,
    [
      'SpecialNote',
      'UnusualNote',
      'SpecNote',
      'LineMemo2',
      'RemarkLine',
      'LineNote',
      'SpecRemark',
      'Memo2',
    ],
    'CAST(NULL AS NVARCHAR(500))',
  );

  const moveReqSql = coalesceHiStr(
    hCols,
    iCols,
    ['MoveReqNo', 'InOutReqNo', 'TLGMoveReqNo', 'ReqNo2', 'MoveRequestNo', 'TransReqNo'],
    80,
    'MoveReqNo',
  );

  const returnNoSql = coalesceHiStr(
    hCols,
    iCols,
    ['ReturnNo', 'RetNo', 'DvRetNo', 'ReturnDocNo', 'RetDocNo', 'ReturnSeqNo'],
    80,
    'ReturnNo',
  );

  const cancelH = pickColumn(hCols, ['CancelYn', 'IsCancel', 'DelYn', 'SlipCancelYn', 'CloseYn', 'UMCancelYn']);
  const cancelI = pickColumn(iCols, ['CancelYn', 'IsCancel', 'DelYn', 'SlipCancelYn', 'CloseYn']);
  const cancelYnSql = (() => {
    const parts: string[] = [];
    if (cancelH) parts.push(`TRY_CONVERT(int, h.${bracketIdent(cancelH)})`);
    if (cancelI) parts.push(`TRY_CONVERT(int, i.${bracketIdent(cancelI)})`);
    if (!parts.length) return `CAST(NULL AS NVARCHAR(10)) AS CancelYn`;
    return `CASE WHEN COALESCE(${parts.join(', ')}, 0) <> 0 THEN N'Y' ELSE N'' END AS CancelYn`;
  })();

  const lotNoSql = iColSql(iCols, ['LotNo', 'LotNumber', 'StockLot'], 'CAST(NULL AS NVARCHAR(100))');

  const bizUnitHeaderCol = pickColumn(hCols, [
    'BizUnit',
    'BizUnitSeq',
    'SiteSeq',
    'WorkPlaceSeq',
    'SMWorkPlaceSeq',
    'BIZUNIT',
  ]);

  logger.log(
    `LG move schema: header=${headerTable}, item=${itemTable}, seq=${hSeq}/${iSeq}, serl=${iSerl}, date=${hDate}`,
  );

  return {
    headerTable,
    itemTable,
    hSeq,
    iSeq,
    iSerl,
    moveDateYmdExpr,
    inOutTypeWhereSql,
    lgKindApplySql,
    receiptDelvReturnSelectSql,
    outConfirmSql,
    moveNoSql,
    reviewDateSql,
    lastModSql,
    moveReasonSql,
    refConfirmSql,
    writeStatusSql,
    funcKindSql,
    qtySql,
    stdUnitQtySql,
    unitJoinSql,
    whJoinOutSql,
    whJoinInSql,
    deptJoinSql,
    deptNameSelect,
    empJoinSql,
    empNameSelect,
    salesCustJoinSql,
    salesCustNameSelect,
    outDeptJoinSql,
    outDeptNameSelect,
    refCustJoinSql,
    refCustNameSelect,
    itemSeqCol,
    specialNoteSql,
    moveReqSql,
    returnNoSql,
    cancelYnSql,
    lotNoSql,
    bizUnitHeaderCol,
  };
}

function buildSelectSql(plan: LgMoveSqlPlan, whereTail: string): string {
  const hTbl = bracketIdent(plan.headerTable);
  const iTbl = bracketIdent(plan.itemTable);
  return `
      SELECT TOP (@fetchCount)
        ${plan.outConfirmSql},
        ${plan.moveDateYmdExpr} AS MoveDateRaw,
        ${plan.reviewDateSql},
        ${plan.lastModSql},
        ${plan.moveNoSql},
        ${plan.moveReasonSql},
        ${plan.refConfirmSql},
        ${plan.writeStatusSql},
        ${plan.receiptDelvReturnSelectSql},
        LTRIM(RTRIM(CAST(it.ItemName AS NVARCHAR(500)))) AS ItemName,
        LTRIM(RTRIM(CAST(it.ItemNo AS NVARCHAR(100)))) AS ItemNo,
        LTRIM(RTRIM(CAST(it.Spec AS NVARCHAR(500)))) AS Spec,
        u.UnitName AS UnitName,
        ${plan.qtySql} AS MoveQty,
        ${plan.lotNoSql} AS LotNo,
        ${plan.stdUnitQtySql},
        whOut.WHName AS OutWHName,
        whIn.WHName AS InWHName,
        ${plan.funcKindSql},
        ${plan.deptNameSelect},
        ${plan.empNameSelect},
        ${plan.specialNoteSql} AS SpecialNote,
        ${plan.salesCustNameSelect},
        ${plan.outDeptNameSelect},
        ${plan.refCustNameSelect},
        ${plan.moveReqSql},
        ${plan.returnNoSql},
        ${plan.cancelYnSql}
      FROM dbo.${hTbl} h
      INNER JOIN dbo.${iTbl} i
        ON h.CompanySeq = i.CompanySeq AND h.${bracketIdent(plan.hSeq)} = i.${bracketIdent(plan.iSeq)}
      ${plan.lgKindApplySql}
      LEFT JOIN dbo.[_TDAItem] it
        ON h.CompanySeq = it.CompanySeq AND i.${bracketIdent(plan.itemSeqCol)} = it.ItemSeq
      ${plan.unitJoinSql}
      ${plan.whJoinOutSql}
      ${plan.whJoinInSql}
      ${plan.deptJoinSql}
      ${plan.empJoinSql}
      ${plan.salesCustJoinSql}
      ${plan.outDeptJoinSql}
      ${plan.refCustJoinSql}
      WHERE ${plan.inOutTypeWhereSql}
        AND ${plan.moveDateYmdExpr} >= @fromYmd
        AND ${plan.moveDateYmdExpr} <= @toYmd
        ${whereTail}
      ORDER BY ${plan.moveDateYmdExpr} ASC, h.CompanySeq ASC, h.${bracketIdent(plan.hSeq)} ASC, i.${bracketIdent(plan.iSerl)} ASC
    `;
}

@Injectable()
export class ErpLgInoutMoveItemsService {
  private readonly logger = new Logger(ErpLgInoutMoveItemsService.name);
  private pool: mssql.ConnectionPool | null = null;
  private poolPromise: Promise<mssql.ConnectionPool> | null = null;
  private sqlPlan: LgMoveSqlPlan | null = null;

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
        options: { encrypt, trustServerCertificate },
        connectionTimeout: 30_000,
        requestTimeout: 120_000,
      });
      await pool.connect();
      this.pool = pool;
      this.sqlPlan = null;
      this.logger.log(`ERP MSSQL connected (LG inout move) (${host}:${port}/${database})`);
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
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      throw new BadRequestException(`${label}은(는) 0 이상의 정수여야 합니다.`);
    }
    return n;
  }

  private async getOrBuildSqlPlan(pool: mssql.ConnectionPool): Promise<LgMoveSqlPlan> {
    if (this.sqlPlan) {
      return this.sqlPlan;
    }
    this.sqlPlan = await resolveLgMoveSqlPlan(pool, this.logger);
    return this.sqlPlan;
  }

  async listByMoveDateRange(
    fromIso: string,
    toIso: string,
    limit?: number,
  ): Promise<{ items: LgInoutMoveItemRow[]; truncated: boolean }> {
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

    let companySeq = this.parseOptionalPositiveInt('ERP_LG_INOUT_COMPANY_SEQ', 'ERP_LG_INOUT_COMPANY_SEQ');
    if (companySeq == null) {
      companySeq = this.parseOptionalPositiveInt('ERP_PU_DELV_IN_COMPANY_SEQ', 'ERP_PU_DELV_IN_COMPANY_SEQ');
    }
    let bizUnitFilter = this.parseOptionalPositiveInt('ERP_LG_INOUT_BIZ_UNIT', 'ERP_LG_INOUT_BIZ_UNIT');
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

    const whereExtra: string[] = [];
    if (companySeq != null) {
      whereExtra.push('h.CompanySeq = @companySeq');
    }
    if (bizUnitFilter != null) {
      if (plan.bizUnitHeaderCol) {
        request.input('bizUnitFilter', mssql.Int, bizUnitFilter);
        whereExtra.push(`h.${bracketIdent(plan.bizUnitHeaderCol)} = @bizUnitFilter`);
      } else {
        this.logger.warn(
          'ERP_LG_INOUT_BIZ_UNIT(또는 PU 폴백)이 설정되어 있으나 일별수불 헤더에 BizUnit·BizUnitSeq 등 컬럼이 없어 사업장 필터를 건너뜁니다. 행이 0건이면 .env의 사업장 값을 비우거나 실제 컬럼명에 맞게 조정하세요.',
        );
      }
    }
    const whereTail = whereExtra.length ? ` AND ${whereExtra.join(' AND ')}` : '';

    const sql = buildSelectSql(plan, whereTail);

    let result: mssql.IResult<SqlRow>;
    try {
      result = await request.query<SqlRow>(sql);
    } catch (err: unknown) {
      this.sqlPlan = null;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`LG inout move query failed: ${msg}`, err instanceof Error ? err.stack : undefined);
      throw new BadRequestException(
        `ERP 조회 쿼리 실행에 실패했습니다. _TLGInoutDaily·Item 컬럼명을 INFORMATION_SCHEMA로 확인하세요. (${msg.slice(0, 240)})`,
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
