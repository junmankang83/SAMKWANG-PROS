import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mssql from 'mssql';

/**
 * 작업실적조회 — `dbo._TPDSFCWorkReport`(또는 `TPDSFCWorkReport`) 단일 테이블.
 * 실적일자·품목·수량·시간 등 컬럼명은 `INFORMATION_SCHEMA`로 감지합니다.
 */
import { PDSFC_SKKR_EXCEL_COLUMNS, type PdsfcWorkReportSkkrExcelRow } from './pdsfc-skkr-excel.columns';
import { buildSkkrSelectParts, type SkkrSqlBuildInput } from './pdsfc-skkr-excel-sql';

/** API 응답 행 (엑셀 `작업실적조회_skkr` 52열 레이아웃) */
export type PdsfcWorkReportRow = PdsfcWorkReportSkkrExcelRow;

export type PdsfcWorkReportSchemaMeta = {
  tableName: string;
  dateColumn: string | null;
  companySeqFilterApplied: boolean;
};

function mapSkkrRow(r: Record<string, unknown>, rowNo: number): PdsfcWorkReportSkkrExcelRow {
  const out = { rowNo } as PdsfcWorkReportSkkrExcelRow;
  for (const { key } of PDSFC_SKKR_EXCEL_COLUMNS) {
    const v = r[key];
    if (v !== undefined && v !== null) {
      (out as Record<string, unknown>)[key] = v as string | number;
    }
  }
  return out;
}
const DEFAULT_LIMIT = 8000;
const MAX_RANGE_DAYS = 400;
/** 플랜(SELECT 컬럼·날짜 추론) 변경 시 캐시 무효화 */
const PLAN_VER = 4;

function bracketIdent(name: string): string {
  return `[${name.replace(/\]/g, ']]')}]`;
}

async function listColumnMeta(
  pool: mssql.ConnectionPool,
  table: string,
): Promise<{ COLUMN_NAME: string; DATA_TYPE: string }[]> {
  const r = await pool
    .request()
    .input('tn', mssql.NVarChar(128), table)
    .query<{ COLUMN_NAME: string; DATA_TYPE: string }>(
      `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
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

function isLikelyNonBusinessDateColumn(name: string): boolean {
  const u = name.toUpperCase();
  if (u === 'REGDATE' || u === 'INSDATE' || u === 'CREATEDATE' || u === 'WRITEDATE') return true;
  if ((u.includes('MOD') || u.startsWith('UPT') || u.includes('EDIT')) && (u.includes('DATE') || u.includes('TIME')))
    return true;
  return false;
}

/** 후보 목록에 없을 때: date/datetime 계열 컬럼에서 실적일로 보이는 컬럼 추론 */
function inferDateColumnFromDateTypes(meta: { COLUMN_NAME: string; DATA_TYPE: string }[]): string | null {
  const rows = meta.filter((r) =>
    ['date', 'datetime', 'datetime2', 'smalldatetime'].includes(r.DATA_TYPE.toLowerCase()),
  );
  if (rows.length === 0) return null;
  const score = (col: string): number => {
    if (isLikelyNonBusinessDateColumn(col)) return 99;
    const u = col.toUpperCase();
    if (/(RESULT|RSLT|REPORT|PERFORM|PROD|SFC).*(DATE|DT|TIME)/.test(u)) return 0;
    if (/^(WORK|ACT)(DATE|DT|YMD)/.test(u)) return 0;
    if (/(WORK|PROD|DV).*(DATE|YMD|DT)/.test(u)) return 1;
    if (/(SLIP|BASE|STD|OCCUR|TRAN).*(DATE|YMD)/i.test(col)) return 3;
    if (u.includes('DATE') || u.endsWith('DT')) return 6;
    return 10;
  };
  rows.sort(
    (a, b) => score(a.COLUMN_NAME) - score(b.COLUMN_NAME) || a.COLUMN_NAME.localeCompare(b.COLUMN_NAME),
  );
  const best = rows.find((x) => score(x.COLUMN_NAME) < 90);
  return best?.COLUMN_NAME ?? null;
}

/** int/varchar 등 실적일(YYYYMMDD) 저장 컬럼 추론 */
function inferDateColumnFromTypedNames(meta: { COLUMN_NAME: string; DATA_TYPE: string }[]): string | null {
  const ok = new Set(['varchar', 'nvarchar', 'char', 'nchar', 'int', 'bigint', 'decimal', 'numeric']);
  const rows = meta.filter((m) => ok.has(m.DATA_TYPE.toLowerCase()) && !isLikelyNonBusinessDateColumn(m.COLUMN_NAME));
  if (rows.length === 0) return null;
  const score = (col: string): number => {
    const u = col.toUpperCase();
    if (/(RESULT|RSLT|REPORT|PERFORM|PROD|SFC).*(YMD|DATE)/.test(u)) return 0;
    if (/^(WORK|ACT)(YMD|DATE)/.test(u)) return 1;
    if (u.endsWith('YMD') || u.endsWith('YM')) return 2;
    if (/(SLIP|BASE|STD|DV).*(YMD|DATE)/i.test(col)) return 4;
    if (u.includes('DATE')) return 8;
    return 20;
  };
  rows.sort(
    (a, b) => score(a.COLUMN_NAME) - score(b.COLUMN_NAME) || a.COLUMN_NAME.localeCompare(b.COLUMN_NAME),
  );
  const best = rows.find((x) => score(x.COLUMN_NAME) < 15);
  return best?.COLUMN_NAME ?? null;
}

async function tableExists(pool: mssql.ConnectionPool, name: string): Promise<boolean> {
  const r = await pool
    .request()
    .input('tn', mssql.NVarChar(128), name)
    .query<{ c: number }>(
      `SELECT COUNT(1) AS c FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = @tn`,
    );
  return Number(r.recordset?.[0]?.c) > 0;
}

function nvExpr(alias: string, col: string | null, width: number): string {
  if (!col) return `CAST(NULL AS NVARCHAR(${width}))`;
  return `LTRIM(RTRIM(CAST(${alias}.${bracketIdent(col)} AS NVARCHAR(${width}))))`;
}

function decExpr(alias: string, col: string | null): string {
  if (!col) return `CAST(NULL AS decimal(18, 4))`;
  return `TRY_CAST(${alias}.${bracketIdent(col)} AS decimal(18, 4))`;
}

/** 실적(w) 값이 비어 있으면 조인 테이블 값으로 채움 */
function coalesceWJoined(enabled: boolean, wColExpr: string, joinedExpr: string): string {
  if (!enabled) return wColExpr;
  return `COALESCE(NULLIF(${wColExpr}, N''), ${joinedExpr})`;
}

/** 실적(w) 값이 비어 있으면 품목(it) 값으로 채움 */
function coalesceWIt(enabled: boolean, wColExpr: string, itExpr: string): string {
  if (!enabled) return wColExpr;
  return `COALESCE(NULLIF(${wColExpr}, N''), ${itExpr})`;
}

function buildDateYmdExpr(alias: string, dateCol: string): string {
  const d = `LTRIM(RTRIM(CAST(${alias}.${bracketIdent(dateCol)} AS NVARCHAR(30))))`;
  return `CASE
    WHEN TRY_CONVERT(datetime, ${d}, 112) IS NOT NULL
      THEN CONVERT(CHAR(8), TRY_CONVERT(datetime, ${d}, 112), 112)
    WHEN TRY_CONVERT(datetime, ${d}) IS NOT NULL
      THEN CONVERT(CHAR(8), TRY_CONVERT(datetime, ${d}), 112)
    ELSE RIGHT(N'00000000' + ${d}, 8)
  END`;
}

type WorkReportPlan = {
  ver: number;
  tableName: string;
  dateCol: string | null;
  dateYmdExpr: string;
  companyCol: string | null;
  orderExpr: string;
  skkrSelectParts: string;
  /** `FROM dbo.[w] w` 이후 LEFT JOIN 블록 */
  joinSql: string;
};

@Injectable()
export class ErpPdsfcWorkReportService {
  private readonly logger = new Logger(ErpPdsfcWorkReportService.name);
  private pool: mssql.ConnectionPool | null = null;
  private poolPromise: Promise<mssql.ConnectionPool> | null = null;
  private plan: WorkReportPlan | null = null;

  constructor(private readonly config: ConfigService) {}

  private getPool(): Promise<mssql.ConnectionPool> {
    if (this.pool?.connected) return Promise.resolve(this.pool);
    if (this.poolPromise) return this.poolPromise;

    const host = this.config.get<string>('ERP_MSSQL_HOST');
    const port = Number(this.config.get<string>('ERP_MSSQL_PORT') ?? 1433);
    const database = this.config.get<string>('ERP_MSSQL_DATABASE');
    const user = this.config.get<string>('ERP_MSSQL_USER');
    const password = this.config.get<string>('ERP_MSSQL_PASSWORD');

    if (!host || !database || !user || !password) {
      return Promise.reject(
        new ServiceUnavailableException('ERP MSSQL 연결 설정이 없습니다. ERP_MSSQL_* 환경 변수를 확인하세요.'),
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
      this.plan = null;
      this.logger.log(`ERP MSSQL connected (PDSFC work report) (${host}:${port}/${database})`);
      return pool;
    })().catch((err) => {
      this.poolPromise = null;
      this.pool = null;
      this.plan = null;
      this.logger.error('ERP MSSQL connection failed', err);
      throw new ServiceUnavailableException('ERP 데이터베이스에 연결할 수 없습니다.');
    });

    return this.poolPromise;
  }

  /** `ERP_PDSFC_WORK_REPORT_COMPANY_SEQ` 비움·0 은 법인 필터 없음(0만 넣은 설정 실수 방지) */
  private parseOptionalCompanySeqFilter(): number | null {
    const raw = this.config.get<string>('ERP_PDSFC_WORK_REPORT_COMPANY_SEQ')?.trim();
    if (!raw || raw === '0') return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      throw new BadRequestException('ERP_PDSFC_WORK_REPORT_COMPANY_SEQ은(는) 비우거나 1 이상의 정수여야 합니다.');
    }
    return n;
  }

  private async resolvePlan(pool: mssql.ConnectionPool): Promise<WorkReportPlan> {
    if (this.plan && this.plan.ver === PLAN_VER) return this.plan;

    let tableName = '_TPDSFCWorkReport';
    if (!(await tableExists(pool, tableName))) {
      if (await tableExists(pool, 'TPDSFCWorkReport')) tableName = 'TPDSFCWorkReport';
      else {
        throw new ServiceUnavailableException('dbo._TPDSFCWorkReport(또는 TPDSFCWorkReport) 테이블이 없습니다.');
      }
    }

    const meta = await listColumnMeta(pool, tableName);
    const cols = meta.map((m) => ({ COLUMN_NAME: m.COLUMN_NAME }));
    const pick = (cands: string[]) => pickColumn(cols, cands);

    let dateCol = pick([
      'WorkDate',
      'ReportDate',
      'ResultDate',
      'SFCWorkDate',
      'ProdDate',
      'WorkYMD',
      'SlipDate',
      'ActDate',
      'PerformDate',
      'WorkReportDate',
      'SFCReportDate',
      'ResultYMD',
      'RsltYMD',
      'RsltDate',
      'WorkResultDate',
      'PerformYMD',
      'ReportYMD',
      'ProdYMD',
      'SFCYMD',
      'ActYMD',
      'DVWorkDate',
      'InstWorkDate',
      'OccurDate',
      'TranDate',
      'BaseYMD',
      'StdYMD',
      'YMD',
      'DailyYMD',
      'WriteDate',
    ]);
    if (!dateCol) dateCol = inferDateColumnFromDateTypes(meta);
    if (!dateCol) dateCol = inferDateColumnFromTypedNames(meta);
    if (!dateCol) dateCol = pick(['RegDate', 'InsDate', 'CreateDate']);
    if (!dateCol) {
      throw new ServiceUnavailableException(
        `${tableName}에서 실적일자 컬럼을 찾지 못했습니다. INFORMATION_SCHEMA의 날짜·YMD 컬럼명을 확인하세요.`,
      );
    }

    const companyCol = pick(['CompanySeq', 'COMPANYSEQ']);

    const dateYmdExpr = buildDateYmdExpr('w', dateCol);

    const resultNo = pick([
      'SFCWorkReportNo',
      'WorkReportNo',
      'ReportNo',
      'SFCReportNo',
      'PerformNo',
      'SlipNo',
      'DocNo',
      'WorkNo',
      'ResultNo',
    ]);

    const workplaceCode = pick([
      'WorkShop',
      'WorkShopCd',
      'WorkShopCode',
      'WorkPlaceCode',
      'WPlaceCode',
      'WCenterCode',
      'ShopCode',
      'WSCode',
      'WCCode',
      'WorkCenterCode',
      'LineCode',
      'AreaCode',
    ]);
    const workplaceName = pick([
      'WorkShopName',
      'WorkPlaceName',
      'ShopName',
      'WCenterName',
      'LineName',
      'WorkCenterName',
      'WCName',
      'AreaName',
      'WorkCenterNm',
    ]);
    const workplaceSingle = pick(['WorkCenter', 'WorkPlace', 'WShop', 'WSName']);

    const processCode = pick([
      'ProcessCode',
      'OpCode',
      'WProcessCode',
      'OperationCode',
      'ProcCode',
      'WPCode',
      'OpSeq',
    ]);
    const processName = pick(['ProcessName', 'OpName', 'WPOperationName', 'ProcName', 'OperationName', 'OpSeqName']);

    const equipmentCode = pick([
      'EquipCode',
      'MachineCode',
      'ResourceCode',
      'FacilityCode',
      'EquipNo',
      'MCCode',
      'AssetCode',
    ]);
    const equipmentName = pick([
      'EquipName',
      'MachineName',
      'ResourceName',
      'FacilityName',
      'EquipNoName',
      'EquipDisplayName',
    ]);

    const itemNo = pick(['ItemNo', 'ItemCode', 'PartNo', 'MaterialNo', 'ProdItemNo']);
    const itemName = pick(['ItemName', 'PartName', 'MaterialName', 'ProdItemName']);
    const spec = pick(['Spec', 'ItemSpec', 'PartSpec', 'MaterialSpec']);
    const unitName = pick(['UnitName', 'Unit', 'UOM', 'StockUnitName']);
    const instructQty = pick([
      'InstructQty',
      'PlanQty',
      'OrderQty',
      'InstQty',
      'TargetQty',
      'DVQty',
      'WorkInstQty',
      'StdQty',
    ]);
    const productionQty = pick(['ProdQty', 'ResultQty', 'OutputQty', 'WorkQty', 'PerformQty', 'ProductQty', 'Qty']);
    const goodQty = pick(['GoodQty', 'OKQty', 'PassQty', 'AcceptQty', 'YieldQty']);
    const workerName = pick(['EmpName', 'WorkerName', 'PicEmpName', 'OperatorName', 'WorkEmpName', 'UserName']);
    const workOrderNo = pick([
      'WorkOrderNo',
      'WOOrdNo',
      'SOOrdNo',
      'OrderNo',
      'InstNo',
      'WorkInstNo',
      'DVInstNo',
      'MOOrdNo',
    ]);
    const deptName = pick(['DeptName', 'PicDeptName', 'WorkDeptName']);

    const finalWorkCol = pick([
      'ModDateTime',
      'UptDateTime',
      'LastWorkDateTime',
      'EndDateTime',
      'WorkEndDT',
      'FinalWorkDateTime',
      'CloseDateTime',
      'LastResultDateTime',
      'PerformEndDT',
    ]);
    const processSeqCol = pick([
      'ProcessSerl',
      'ProcessSeq',
      'OpSerl',
      'OpSeq',
      'WProcessSeq',
      'ProcSerl',
      'ProcSeq',
      'OperationSerl',
    ]);
    const mfgUnitPrice = pick([
      'MfgUnitPrice',
      'ProdUnitPrice',
      'ManuUnitPrice',
      'MfgUP',
      'MakeUP',
      'ManufactureUP',
    ]);
    const prodAmount = pick(['ProdAmt', 'ProdAmount', 'ProductionAmt', 'ResultAmt', 'ProdMoney']);
    const goodAmount = pick(['GoodAmt', 'GoodAmount', 'OKAmt', 'PassAmt']);
    const defectAmount = pick(['DefectAmt', 'DefectAmount', 'BadAmt', 'NGAmt', 'RejectAmt']);
    const stdUnitPrice = pick(['StdUnitPrice', 'StdUP', 'StandardUnitPrice', 'StdPrice']);
    const settleUnitPrice = pick(['SettleUnitPrice', 'CloseUP', 'SettleUP', 'ClosingUP', 'CostUP']);
    const defectCost = pick(['DefectCost', 'BadCost', 'NGCost', 'RejectCost']);
    const matRegenProc = pick(['MatRegenProc', 'MatRecycle', 'MatReuseProc', 'MatRegenAmt']);
    const scrapCost = pick(['ScrapCost', 'RealScrapCost', 'LossScrapCost', 'ScrapAmt']);
    const workMinutes = pick([
      'WorkMinutes',
      'TotalWorkMinutes',
      'GrossWorkMinutes',
      'OpWorkMinutes',
      'TotalMinutes',
    ]);
    const manMinutes = pick(['ManMinutes', 'MHMin', 'LaborMinutes', 'ManMin', 'StdManMinutes', 'WorkManMinutes']);
    const loadMinutes = pick(['LoadMinutes', 'BurdenMinutes', 'LoadMin', 'BurdenMin']);
    const runMinutes = pick(['RunMinutes', 'RunMin', 'MachineRunMinutes', 'ActRunMinutes']);
    const lossRate = pick(['LossRate', 'LossPct', 'YieldLossRate', 'LossRatio']);
    const plannedStopMin = pick(['PlannedStopMin', 'PlanStopMin', 'PlanIdleMin', 'SchStopMin']);
    const stopLossMin = pick(['StopLossMin', 'StopLossMinutes', 'DownLossMin']);
    const stdWorkTime = pick(['StdWorkTime', 'StandardWorkTime', 'StdOpTime', 'StdOpMinutes']);
    const cavity = pick(['Cavity', 'Cavities', 'CavityCnt', 'MoldCavity']);
    const lossMinutes = pick(['LossMinutes', 'IdleMinutes', 'LossMin', 'WasteMinutes']);
    const shiftType = pick(['ShiftType', 'DayNightKind', 'DNKind', 'WorkShift', 'DayNight']);
    const prodPlanNo = pick(['ProdPlanNo', 'MPSNo', 'PlanNo', 'PrdPlanNo', 'ProdPlanOrdNo']);
    const workKind = pick(['WorkKind', 'WorkType', 'SFCWorkKind', 'PerformKind', 'ResultKind']);
    const matInputYn = pick(['MatInputYn', 'MaterialInputYn', 'MatInYn', 'InputYn']);
    const finalInspTarget = pick(['FinalInspTarget', 'LastInspTarget', 'FinalQcTarget', 'FinalInspYn']);
    const receiptYn = pick(['ReceiptYn', 'InWHYn', 'StockInYn', 'RecvYn', 'WareInYn']);
    const moldName = pick(['MoldName', 'DieName', 'MoldNm']);
    const moldNo = pick(['MoldNo', 'DieNo', 'MOLDNO']);
    const revNo = pick(['RevNo', 'RevisionNo', 'VerNo', 'VersionNo', 'Rev']);
    const poNo = pick(['PONo', 'PurOrderNo', 'POOrdNo', 'PurchaseOrderNo', 'OrderPNo']);
    const equipSpec = pick(['EquipSpec', 'MachineSpec', 'FacilitySpec', 'MCSpec', 'EquipSpecification']);

    const orderSeq = pick(['SFCWorkReportSerl', 'WorkReportSerl', 'ReportSerl', 'Serl', 'LineSerl', 'Seq']);
    const orderNo = resultNo;

    const itemSeqCol = pick(['ItemSeq', 'ITEMSEQ']);
    const empSeqCol = pick(['EmpSeq', 'PicEmpSeq', 'WorkerEmpSeq', 'WorkEmpSeq', 'WEmpSeq']);
    const unitSeqCol = pick(['UnitSeq', 'UNITSEQ']);

    let joinSql = '';
    let hasItemJoin = false;
    let hasEmpJoin = false;
    let hasUnitJoin = false;
    let hasWorkShopJoin = false;

    if (companyCol && (await tableExists(pool, '_TDAItem'))) {
      if (itemSeqCol) {
        joinSql += `\n      LEFT JOIN dbo.[_TDAItem] it ON w.${bracketIdent(companyCol)} = it.CompanySeq AND w.${bracketIdent(itemSeqCol)} = it.ItemSeq`;
        hasItemJoin = true;
      } else if (itemNo) {
        joinSql += `\n      LEFT JOIN dbo.[_TDAItem] it ON w.${bracketIdent(companyCol)} = it.CompanySeq AND LTRIM(RTRIM(CAST(w.${bracketIdent(itemNo)} AS NVARCHAR(120)))) = LTRIM(RTRIM(CAST(it.ItemNo AS NVARCHAR(120))))`;
        hasItemJoin = true;
      }
    }

    const workShopSeqCol = pick(['WorkShopSeq', 'WSSeq', 'ShopSeq', 'WSHSeq', 'WPlaceSeq']);
    if (companyCol && workShopSeqCol && (await tableExists(pool, '_TDAWorkShop'))) {
      joinSql += `\n      LEFT JOIN dbo.[_TDAWorkShop] wshop ON w.${bracketIdent(companyCol)} = wshop.CompanySeq AND w.${bracketIdent(workShopSeqCol)} = wshop.${bracketIdent(workShopSeqCol)}`;
      hasWorkShopJoin = true;
    }

    if (companyCol && empSeqCol && (await tableExists(pool, '_TDAEmp'))) {
      joinSql += `\n      LEFT JOIN dbo.[_TDAEmp] emp ON w.${bracketIdent(companyCol)} = emp.CompanySeq AND w.${bracketIdent(empSeqCol)} = emp.EmpSeq`;
      hasEmpJoin = true;
    }

    if (companyCol && (await tableExists(pool, '_TDAUnit'))) {
      if (hasItemJoin) {
        joinSql += `\n      LEFT JOIN dbo.[_TDAUnit] u ON it.CompanySeq = u.CompanySeq AND u.UnitSeq = NULLIF(it.UnitSeq, 0)`;
        hasUnitJoin = true;
      } else if (unitSeqCol) {
        joinSql += `\n      LEFT JOIN dbo.[_TDAUnit] u ON w.${bracketIdent(companyCol)} = u.CompanySeq AND u.UnitSeq = NULLIF(w.${bracketIdent(unitSeqCol)}, 0)`;
        hasUnitJoin = true;
      }
    }

    let hasDeptJoin = false;
    const deptSeqCol = pick(['DeptSeq', 'PicDeptSeq', 'WorkDeptSeq', 'ProdDeptSeq']);
    if (companyCol && deptSeqCol && (await tableExists(pool, '_TDADept'))) {
      joinSql += `\n      LEFT JOIN dbo.[_TDADept] d ON w.${bracketIdent(companyCol)} = d.CompanySeq AND w.${bracketIdent(deptSeqCol)} = d.DeptSeq`;
      hasDeptJoin = true;
    }

    let hasEmpFinalJoin = false;
    const finalEmpSeqCol = pick([
      'FinalEmpSeq',
      'LastEmpSeq',
      'ModEmpSeq',
      'UptEmpSeq',
      'CloseEmpSeq',
      'LastWorkEmpSeq',
      'EndEmpSeq',
      'ModifierEmpSeq',
      'ChgEmpSeq',
    ]);
    if (companyCol && finalEmpSeqCol && (await tableExists(pool, '_TDAEmp'))) {
      joinSql += `\n      LEFT JOIN dbo.[_TDAEmp] empF ON w.${bracketIdent(companyCol)} = empF.CompanySeq AND w.${bracketIdent(finalEmpSeqCol)} = empF.EmpSeq`;
      hasEmpFinalJoin = true;
    }

    let itItemL: string | null = null;
    let itItemM: string | null = null;
    let itItemS: string | null = null;
    let itAsset: string | null = null;
    if (hasItemJoin && (await tableExists(pool, '_TDAItem'))) {
      const itMetaCols = (await listColumnMeta(pool, '_TDAItem')).map((m) => ({ COLUMN_NAME: m.COLUMN_NAME }));
      itItemL = pickColumn(itMetaCols, [
        'ItemKindLName',
        'ItemCatLName',
        'MajorKindName',
        'KindLName',
        'ItemLClassName',
        'ItemKindLNm',
        'LargeKindName',
        'ItemGroupLName',
        'ItemLClass',
      ]);
      itItemM = pickColumn(itMetaCols, [
        'ItemKindMName',
        'ItemCatMName',
        'MidKindName',
        'KindMName',
        'ItemMClassName',
        'ItemKindMNm',
      ]);
      itItemS = pickColumn(itMetaCols, [
        'ItemKindSName',
        'ItemCatSName',
        'MinorKindName',
        'KindSName',
        'ItemSClassName',
        'ItemKindSNm',
      ]);
      itAsset = pickColumn(itMetaCols, [
        'AssetKindName',
        'ItemAssetKindName',
        'AssetClassName',
        'AssetKind',
        'ItemAssetName',
        'AssetTypeName',
      ]);
    }

    const w = 'w';
    const itItemNo = `LTRIM(RTRIM(CAST(it.ItemNo AS NVARCHAR(120))))`;
    const itItemName = `LTRIM(RTRIM(CAST(it.ItemName AS NVARCHAR(300))))`;
    const itSpec = `LTRIM(RTRIM(CAST(it.Spec AS NVARCHAR(400))))`;
    const uUnitName = `LTRIM(RTRIM(CAST(u.UnitName AS NVARCHAR(80))))`;
    const empEmpName = `LTRIM(RTRIM(CAST(emp.EmpName AS NVARCHAR(120))))`;
    const empFinalName = `LTRIM(RTRIM(CAST(empF.EmpName AS NVARCHAR(120))))`;
    const wsShopName = `LTRIM(RTRIM(CAST(wshop.WorkShopName AS NVARCHAR(200))))`;

    const skkrInput: SkkrSqlBuildInput = {
      nv: nvExpr,
      dec: decExpr,
      coalesceWIt,
      coalesceWJoined,
      dateYmdExpr,
      hasItemJoin,
      hasEmpJoin,
      hasUnitJoin,
      hasWorkShopJoin,
      hasDeptJoin,
      hasEmpFinalJoin,
      itItemNo,
      itItemName,
      itSpec,
      uUnitName,
      empEmpName,
      empFinalName,
      wsShopName,
      itItemL,
      itItemM,
      itItemS,
      itAsset,
      w: 'w',
      finalWorkCol,
      mfgUnitPrice,
      prodAmount,
      goodAmount,
      defectAmount,
      stdUnitPrice,
      settleUnitPrice,
      defectCost,
      matRegenProc,
      scrapCost,
      workMinutes,
      manMinutes,
      loadMinutes,
      runMinutes,
      lossRate,
      plannedStopMin,
      stopLossMin,
      stdWorkTime,
      cavity,
      lossMinutes,
      shiftType,
      prodPlanNo,
      workKind,
      matInputYn,
      finalInspTarget,
      receiptYn,
      moldName,
      moldNo,
      revNo,
      poNo,
      processSeqCol,
      workplaceSingle,
      workplaceCode,
      workplaceName,
      processCode,
      processName,
      equipmentCode,
      equipmentName,
      equipSpec,
      itemNo,
      itemName,
      spec,
      unitName,
      instructQty,
      productionQty,
      goodQty,
      defectQty: null,
      workerName,
      workOrderNo,
      remark: null,
      deptName,
    };

    const skkrSelectParts = buildSkkrSelectParts(skkrInput);

    const orderParts: string[] = [dateYmdExpr];
    if (orderNo) orderParts.push(`LTRIM(RTRIM(CAST(w.${bracketIdent(orderNo)} AS NVARCHAR(120))))`);
    if (orderSeq) orderParts.push(`TRY_CAST(w.${bracketIdent(orderSeq)} AS int)`);
    const orderExpr = orderParts.join(', ');

    this.plan = {
      ver: PLAN_VER,
      tableName,
      dateCol,
      dateYmdExpr,
      companyCol,
      orderExpr,
      skkrSelectParts,
      joinSql,
    };

    this.logger.log(
      `PDSFC work report: table=${tableName} dateCol=${dateCol} companyCol=${companyCol ?? '(none)'} resultNo=${resultNo ?? '(none)'} itemJoin=${hasItemJoin} empJoin=${hasEmpJoin} unitJoin=${hasUnitJoin} workShopJoin=${hasWorkShopJoin} deptJoin=${hasDeptJoin} empFinalJoin=${hasEmpFinalJoin}`,
    );
    return this.plan;
  }

  async listByDateRange(
    fromIso: string,
    toIso: string,
    limit?: number,
    schemaMeta?: boolean,
  ): Promise<{
    items: PdsfcWorkReportRow[];
    truncated: boolean;
    schemaMeta?: PdsfcWorkReportSchemaMeta;
  }> {
    const parseLocal = (s: string): Date | null => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
      if (!m) return null;
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      const dt = new Date(y, mo - 1, d);
      if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
      return dt;
    };

    const from = parseLocal(fromIso);
    const to = parseLocal(toIso);
    if (!from || !to) throw new BadRequestException('유효하지 않은 날짜입니다.');
    if (from > to) throw new BadRequestException('시작일이 종료일보다 늦을 수 없습니다.');
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86400_000) {
      throw new BadRequestException(`조회 기간은 최대 ${MAX_RANGE_DAYS}일까지 가능합니다.`);
    }

    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const fromYmd = fmt(from);
    const toYmd = fmt(to);
    const maxRows = Math.min(limit ?? DEFAULT_LIMIT, 10_000);
    const fetchCount = maxRows + 1;

    const companySeq = this.parseOptionalCompanySeqFilter();

    const pool = await this.getPool();
    const p = await this.resolvePlan(pool);
    const tbl = bracketIdent(p.tableName);

    const sql = `
      SELECT TOP (@fetchCount)
        ${p.skkrSelectParts}
      FROM dbo.${tbl} w
      ${p.joinSql}
      WHERE ${p.dateYmdExpr} >= @fromYmd AND ${p.dateYmdExpr} <= @toYmd
        ${companySeq != null && p.companyCol ? `AND w.${bracketIdent(p.companyCol)} = @companySeq` : ''}
      ORDER BY ${p.orderExpr}
    `;

    const request = pool.request();
    request.input('fromYmd', mssql.Char(8), fromYmd);
    request.input('toYmd', mssql.Char(8), toYmd);
    request.input('fetchCount', mssql.Int, fetchCount);
    if (companySeq != null && p.companyCol) request.input('companySeq', mssql.Int, companySeq);

    let result: mssql.IResult<Record<string, unknown>>;
    try {
      result = await request.query<Record<string, unknown>>(sql);
    } catch (err: unknown) {
      this.plan = null;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`PDSFC work report query failed: ${msg}`);
      throw new BadRequestException(
        `작업실적조회에 실패했습니다. _TPDSFCWorkReport 컬럼명을 확인하세요. (${msg.slice(0, 220)})`,
      );
    }

    const raw = result.recordset ?? [];
    const truncated = raw.length > maxRows;
    const slice = truncated ? raw.slice(0, maxRows) : raw;
    const items = slice.map((r, i) => mapSkkrRow(r, i + 1));

    const base = { items, truncated };
    if (schemaMeta) {
      return {
        ...base,
        schemaMeta: {
          tableName: p.tableName,
          dateColumn: p.dateCol,
          companySeqFilterApplied: Boolean(companySeq != null && p.companyCol),
        },
      };
    }
    return base;
  }
}
