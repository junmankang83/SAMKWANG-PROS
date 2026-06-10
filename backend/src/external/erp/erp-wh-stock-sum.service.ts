import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mssql from 'mssql';

import { normalizeErpMssqlUser2Login } from './erp-mssql-user2-normalize';
import { qualifyListBatchProc } from './erp-wh-stock-list-batch';
import { buildWhStockSumBatchSql } from './erp-wh-stock-sum-batch';
import { buildWhStockSumDirectSql, WH_STOCK_SUM_DIRECT_SQL_VER } from './erp-wh-stock-sum-direct';
import { mapStockSumNqlRowToGrid, pickWhStockSumNqlMainRecordset } from './erp-wh-stock-sum-nql-map';
import { tryBuildWhStockSumFromNqlPivotSets } from './erp-wh-stock-sum-nql-pivot';
import { type WhStockSumGridRow } from './wh-stock-sum-grid.columns';

const DEFAULT_LIMIT = 8000;
const MAX_RANGE_DAYS = 400;

function rowVal(r: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(r, k)) return r[k];
    const lk = k.toLowerCase();
    for (const rk of Object.keys(r)) {
      if (rk.toLowerCase() === lk) return r[rk];
    }
  }
  return undefined;
}

/** `_TLGInoutDaily` 직접 SQL 결과(구 camelCase) → 엑셀 동일 38열 */
function mapDirectSqlRowToGrid(r: Record<string, unknown>, rowNo: number): WhStockSumGridRow {
  const s = (k: string) => toStr(rowVal(r, k));
  const n = (k: string) => toNum(rowVal(r, k));
  return {
    rowNo,
    assetGrpName: s('itemKind'),
    classLName: s('classLargeName'),
    classMName: s('classMiddleName'),
    classSName: s('itemGroupName'),
    itemName: s('itemName'),
    itemNo: s('itemNo'),
    spec: s('spec'),
    unitName: s('unitName'),
    itemStatus: s('manageUnitName'),
    whDivName: null,
    whName: s('whName'),
    whGroupName: null,
    storageLoc: s('location'),
    whCode: s('whCode'),
    carryQty: n('openingQty') ?? undefined,
    carryAmt: n('openingAmt') ?? undefined,
    inQty: n('inQty') ?? undefined,
    inAmt: n('inAmt') ?? undefined,
    outQty: n('outQty') ?? undefined,
    outAmt: n('outAmt') ?? undefined,
    stkQty: n('closingQty') ?? undefined,
    stkAmt: n('closingAmt') ?? undefined,
    safetyQty: n('safetyStockQty') ?? undefined,
    safetyAmt: n('safetyStockAmt') ?? undefined,
    stdPrice: undefined,
    settlePrice: undefined,
    inMove: 0,
    inSubst: 0,
    inProd: 0,
    inOutsrc: 0,
    inPurchase: 0,
    inImport: 0,
    outTrx: 0,
    outExportInv: 0,
    outEtc: 0,
    outMove: 0,
    outSubst: 0,
    outWork: 0,
  };
}

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/**
 * `skkr_SWLGWHStockSumListQuery`는 여러 결과 집합을 반환합니다(입출고유형 헤더, `#TempReturn_ROW` 고정행, RowIDX·ColIDX·Qty 피벗 등).
 * 그리드에는 고정행 집합을 사용합니다.
 */
function pickWhStockProcRecordset(
  recordsets: Record<string, unknown>[][] | undefined,
  fallbackRecordset: Record<string, unknown>[] | undefined,
): Record<string, unknown>[] {
  const sets = Array.isArray(recordsets) ? recordsets.filter((s) => Array.isArray(s) && s.length > 0) : [];
  if (sets.length === 0) return fallbackRecordset ?? [];

  const keysOf = (row: Record<string, unknown> | undefined): string[] =>
    row && typeof row === 'object' ? Object.keys(row as object) : [];

  const scoreSet = (set: Record<string, unknown>[]): number => {
    const k = new Set(keysOf(set[0]));
    if (k.size === 0) return -1;

    /* 피벗 상세(입출고유형별 수량) */
    if (k.has('RowIDX') && k.has('ColIDX') && k.has('Qty') && k.size <= 8) return 2;

    /* 입출고유형 컬럼 헤더 행 */
    if (k.has('Title2') && k.has('TitleSeq2') && k.has('ColIDX') && !k.has('ItemName')) return 3;

    let sc = 0;
    if (k.has('SMAssetGrpName')) sc += 200;
    if (k.has('ItemName')) sc += 80;
    if (k.has('PrevQty') && k.has('StockQty')) sc += 40;
    if (k.has('PrevAmt') || k.has('StkPrice')) sc += 20;
    sc += Math.min(set.length, 50_000);
    return sc;
  };

  let best = sets[0]!;
  let bestSc = scoreSet(best);
  for (let i = 1; i < sets.length; i++) {
    const s = sets[i]!;
    const sc = scoreSet(s);
    if (sc > bestSc) {
      best = s;
      bestSc = sc;
    }
  }
  if (bestSc < 50 && fallbackRecordset?.length) return fallbackRecordset;
  return best;
}

function parseOptionalInt(config: ConfigService, key: string, min: number, max: number): number | null {
  const raw = config.get<string>(key)?.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    throw new BadRequestException(`${key}은(는) ${min}~${max} 정수이거나 비워야 합니다.`);
  }
  return n;
}

@Injectable()
export class ErpWhStockSumService {
  private readonly logger = new Logger(ErpWhStockSumService.name);
  private pool: mssql.ConnectionPool | null = null;
  private poolPromise: Promise<mssql.ConnectionPool> | null = null;
  /** `skkr_SWLGWHStockSumListQuery` 등 프로시저 전용 — `ERP_MSSQL_USER2`·`ERP_MSSQL_PASSWORD2` 권장 */
  private poolProc: mssql.ConnectionPool | null = null;
  private poolProcPromise: Promise<mssql.ConnectionPool> | null = null;
  /** 스키마 기반 직접 SELECT 캐시(프로시저 미사용 경로) */
  private whStockSumDirectSql: string | null = null;
  private whStockSumDirectSqlVer = -1;

  constructor(private readonly config: ConfigService) {}

  /**
   * 창고별수불 프로시저 배치 전용 연결.
   * `ERP_MSSQL_USER2`·`ERP_MSSQL_PASSWORD2`가 모두 있으면 이 계정으로 접속하고, 없으면 기본 `ERP_MSSQL_USER`로 폴백합니다.
   */
  private getPoolWhStockSumProc(): Promise<mssql.ConnectionPool> {
    if (this.poolProc?.connected) return Promise.resolve(this.poolProc);
    if (this.poolProcPromise) return this.poolProcPromise;

    const host = this.config.get<string>('ERP_MSSQL_HOST');
    const port = Number(this.config.get<string>('ERP_MSSQL_PORT') ?? 1433);
    const database = this.config.get<string>('ERP_MSSQL_DATABASE');
    const userPrimary = this.config.get<string>('ERP_MSSQL_USER');
    const passwordPrimary = this.config.get<string>('ERP_MSSQL_PASSWORD');
    const user2 = normalizeErpMssqlUser2Login(this.config.get<string>('ERP_MSSQL_USER2'));
    const password2 = this.config.get<string>('ERP_MSSQL_PASSWORD2')?.trim();
    const useSecondary = !!(user2 && password2);
    const user = useSecondary ? user2 : userPrimary;
    const password = useSecondary ? password2 : passwordPrimary;

    if (!host || !database || !user || !password) {
      return Promise.reject(
        new ServiceUnavailableException(
          useSecondary
            ? 'ERP 프로시저 조회용 MSSQL 설정이 없습니다. ERP_MSSQL_HOST·DATABASE 및 ERP_MSSQL_USER2·ERP_MSSQL_PASSWORD2를 확인하세요.'
            : 'ERP MSSQL 연결 설정이 없습니다. 프로시저 경로는 ERP_MSSQL_USER2·ERP_MSSQL_PASSWORD2 설정을 권장합니다.',
        ),
      );
    }

    if (!useSecondary) {
      this.logger.warn(
        '창고별수불 프로시저 경로: ERP_MSSQL_USER2·ERP_MSSQL_PASSWORD2가 비어 있어 ERP_MSSQL_USER로 접속합니다. EXECUTE 권한이 있는 계정은 USER2에 두는 것을 권장합니다.',
      );
    }

    const encrypt = this.config.get<string>('ERP_MSSQL_ENCRYPT') === 'true';
    const trustServerCertificate = this.config.get<string>('ERP_MSSQL_TRUST_SERVER_CERT') !== 'false';

    this.poolProcPromise = (async () => {
      const pool = new mssql.ConnectionPool({
        server: host,
        port,
        database,
        user,
        password,
        options: { encrypt, trustServerCertificate },
        connectionTimeout: 30_000,
        requestTimeout: 300_000,
      });
      await pool.connect();
      this.poolProc = pool;
      this.logger.log(
        `ERP MSSQL connected (WH stock sum — proc${useSecondary ? ' / USER2' : ''}) (${host}:${port}/${database})`,
      );
      return pool;
    })().catch((err) => {
      this.poolProcPromise = null;
      this.poolProc = null;
      this.logger.error('ERP MSSQL connection failed (WH stock sum proc)', err);
      throw new ServiceUnavailableException('ERP 데이터베이스(프로시저 전용 연결)에 연결할 수 없습니다.');
    });

    return this.poolProcPromise;
  }

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
        requestTimeout: 300_000,
      });
      await pool.connect();
      this.pool = pool;
      this.whStockSumDirectSql = null;
      this.whStockSumDirectSqlVer = -1;
      this.logger.log(`ERP MSSQL connected (WH stock sum) (${host}:${port}/${database})`);
      return pool;
    })().catch((err) => {
      this.poolPromise = null;
      this.pool = null;
      this.logger.error('ERP MSSQL connection failed (WH stock sum)', err);
      throw new ServiceUnavailableException('ERP 데이터베이스에 연결할 수 없습니다.');
    });

    return this.poolPromise;
  }

  private parseLocalYmd(s: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  }

  private fmtYmd(d: Date): string {
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  }

  private async getOrBuildDirectSql(pool: mssql.ConnectionPool): Promise<string> {
    if (this.whStockSumDirectSql && this.whStockSumDirectSqlVer === WH_STOCK_SUM_DIRECT_SQL_VER) {
      return this.whStockSumDirectSql;
    }
    try {
      this.whStockSumDirectSql = await buildWhStockSumDirectSql(pool, this.logger);
      this.whStockSumDirectSqlVer = WH_STOCK_SUM_DIRECT_SQL_VER;
      return this.whStockSumDirectSql;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`WH stock sum direct SQL build failed: ${msg}`);
      throw new BadRequestException(`창고별수불 직접조회 SQL을 만들 수 없습니다. (${msg.slice(0, 240)})`);
    }
  }

  private validateSqlParamIdent(raw: string, envKey: string): string {
    const t = (raw ?? '').trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) {
      throw new BadRequestException(`${envKey}은(는) 영문·숫자·밑줄로만 된 식별자여야 합니다.`);
    }
    return t;
  }

  /**
   * `Sp_StockSumListQuery_NQL @BegDate, @EndDate` (YYYYMMDD 8자) — SKKR SP는 `@DateFr`가 아니라 `@BegDate` 등을 씁니다.
   * 이름이 다르면 `ERP_WH_STOCK_SUM_SP_NQL_DATE_*_PARAM`으로 맞춥니다.
   * `ERP_WH_STOCK_SUM_USE_SP_STOCK_SUM_LIST_QUERY_NQL=false`이면 사용하지 않습니다.
   */
  private async listBySpStockSumListQueryNql(
    dateFr: string,
    dateTo: string,
    maxRows: number,
  ): Promise<{ items: WhStockSumGridRow[]; truncated: boolean }> {
    const procRaw = (this.config.get<string>('ERP_WH_STOCK_SUM_SP_STOCK_SUM_LIST_QUERY_NQL_PROC') ?? 'Sp_StockSumListQuery_NQL').trim();
    const procQ = qualifyListBatchProc(procRaw);
    const pFr = this.validateSqlParamIdent(
      this.config.get<string>('ERP_WH_STOCK_SUM_SP_NQL_DATE_FR_PARAM') ?? 'BegDate',
      'ERP_WH_STOCK_SUM_SP_NQL_DATE_FR_PARAM',
    );
    const pTo = this.validateSqlParamIdent(
      this.config.get<string>('ERP_WH_STOCK_SUM_SP_NQL_DATE_TO_PARAM') ?? 'EndDate',
      'ERP_WH_STOCK_SUM_SP_NQL_DATE_TO_PARAM',
    );

    const pool = await this.getPoolWhStockSumProc();
    const req = pool.request();
    req.input(pFr, mssql.Char(8), dateFr);
    req.input(pTo, mssql.Char(8), dateTo);

    const sql = `SET NOCOUNT ON; EXEC ${procQ} @${pFr} = @${pFr}, @${pTo} = @${pTo};`;

    let result: mssql.IResult<Record<string, unknown>>;
    try {
      result = await req.query<Record<string, unknown>>(sql);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`WH stock sum Sp_StockSumListQuery_NQL failed: ${msg}`);
      throw new BadRequestException(
        `창고별수불집계조회(Sp_StockSumListQuery_NQL)에 실패했습니다. (${procRaw}) (${msg.slice(0, 240)})`,
      );
    }

    const sets = (result as unknown as { recordsets?: Record<string, unknown>[][] }).recordsets;
    const nonEmptySets = Array.isArray(sets)
      ? sets.filter((s): s is Record<string, unknown>[] => Array.isArray(s) && s.length > 0)
      : [];

    const pivotRows = tryBuildWhStockSumFromNqlPivotSets(nonEmptySets);
    if (pivotRows && pivotRows.length > 0) {
      const dataRows = pivotRows.filter((r) => !r.isTotal);
      const truncated = dataRows.length > maxRows;
      const slice = truncated ? dataRows.slice(0, maxRows) : dataRows;
      return {
        items: slice.map((r, i) => ({ ...r, rowNo: i + 1 })),
        truncated,
      };
    }

    const rawSet = pickWhStockSumNqlMainRecordset(sets, result.recordset ?? []);
    const dataRows = rawSet.filter((r) => {
      const g = mapStockSumNqlRowToGrid(r as Record<string, unknown>, 0);
      return !g.isTotal;
    });
    const truncated = dataRows.length > maxRows;
    const slice = truncated ? dataRows.slice(0, maxRows) : dataRows;
    return {
      items: slice.map((r, i) => mapStockSumNqlRowToGrid(r as Record<string, unknown>, i + 1)),
      truncated,
    };
  }

  /** 레거시: `skkr_SWLGWHStockSumListQuery` + 임시테이블 배치(프로시저 EXECUTE 권한 필요) */
  private async listByStoredProc(
    dateFr: string,
    dateTo: string,
    maxRows: number,
    fetchCount: number,
    bizUnit: number,
    smQryType: string,
    smWhType: number,
    smUnitType: number,
    smStockAmtType: number,
    serviceSeq: number,
    methodSeq: number,
    pgmSeq: number,
    companySeq: number,
    languageSeq: number,
    userSeq: number,
  ): Promise<{ items: WhStockSumGridRow[]; truncated: boolean }> {
    const skipProcCheck = this.config.get<string>('ERP_WH_STOCK_SUM_RUN_PROC_CHECK') !== 'true';
    const sql = buildWhStockSumBatchSql({ skipProcCheck });

    const pool = await this.getPoolWhStockSumProc();
    const req = pool.request();
    req.input('DateFr', mssql.Char(8), dateFr);
    req.input('DateTo', mssql.Char(8), dateTo);
    req.input('BizUnit', mssql.Int, bizUnit);
    req.input('SMQryType', mssql.NChar(1), smQryType);
    req.input('SMWHType', mssql.Int, smWhType);
    req.input('SMUnitType', mssql.Int, smUnitType);
    req.input('SMStockAmtType', mssql.Int, smStockAmtType);
    req.input('ServiceSeq', mssql.Int, serviceSeq);
    req.input('MethodSeq', mssql.Int, methodSeq);
    req.input('PgmSeq', mssql.Int, pgmSeq);
    req.input('CompanySeq', mssql.Int, companySeq);
    req.input('LanguageSeq', mssql.Int, languageSeq);
    req.input('UserSeq', mssql.Int, userSeq);
    req.input('WorkingTag', mssql.NVarChar(10), '');
    req.input('IsTransaction', mssql.Bit, false);
    req.input('fetchCount', mssql.Int, fetchCount);

    let result: mssql.IResult<Record<string, unknown>>;
    try {
      result = await req.query<Record<string, unknown>>(sql);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`WH stock sum batch failed: ${msg}`);
      throw new BadRequestException(`창고별수불집계조회에 실패했습니다. (${msg.slice(0, 240)})`);
    }

    const sets = (result as unknown as { recordsets?: Record<string, unknown>[][] }).recordsets;
    const nonEmptySets = Array.isArray(sets)
      ? sets.filter((s): s is Record<string, unknown>[] => Array.isArray(s) && s.length > 0)
      : [];

    const pivotRows = tryBuildWhStockSumFromNqlPivotSets(nonEmptySets);
    if (pivotRows && pivotRows.length > 0) {
      const dataRows = pivotRows.filter((r) => !r.isTotal);
      const truncated = dataRows.length > maxRows;
      const slice = truncated ? dataRows.slice(0, maxRows) : dataRows;
      return {
        items: slice.map((r, i) => ({ ...r, rowNo: i + 1 })),
        truncated,
      };
    }

    const rawSet = pickWhStockProcRecordset(sets, result.recordset ?? []);

    const truncated = rawSet.length > maxRows;
    const slice = truncated ? rawSet.slice(0, maxRows) : rawSet;
    return {
      items: slice.map((r, i) => mapStockSumNqlRowToGrid(r as Record<string, unknown>, i + 1)),
      truncated,
    };
  }

  private async listByDirectTables(
    from: Date,
    dateFr: string,
    dateTo: string,
    maxRows: number,
    fetchCount: number,
    bizUnit: number,
    smQryType: string,
    smWhType: number,
    smUnitType: number,
    smStockAmtType: number,
    companySeq: number,
  ): Promise<{ items: WhStockSumGridRow[]; truncated: boolean }> {
    const lookbackRaw = this.config.get<string>('ERP_WH_STOCK_SUM_DIRECT_OPENING_LOOKBACK_DAYS')?.trim();
    const lookbackDays = lookbackRaw ? Math.min(3650, Math.max(30, Number(lookbackRaw) || 1460)) : 1460;
    const histAnchor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    histAnchor.setDate(histAnchor.getDate() - lookbackDays);
    const histFromYmd = this.fmtYmd(histAnchor);

    const pool = await this.getPool();
    const sql = await this.getOrBuildDirectSql(pool);

    const req = pool.request();
    req.input('DateFr', mssql.Char(8), dateFr);
    req.input('DateTo', mssql.Char(8), dateTo);
    req.input('histFromYmd', mssql.Char(8), histFromYmd);
    req.input('BizUnit', mssql.Int, bizUnit);
    req.input('companySeq', mssql.Int, companySeq);
    req.input('SMQryType', mssql.NChar(1), smQryType);
    req.input('SMWHType', mssql.Int, smWhType);
    req.input('SMUnitType', mssql.Int, smUnitType);
    req.input('SMStockAmtType', mssql.Int, smStockAmtType);
    req.input('fetchCount', mssql.Int, fetchCount);

    let result: mssql.IResult<Record<string, unknown>>;
    try {
      result = await req.query<Record<string, unknown>>(sql);
    } catch (err: unknown) {
      this.whStockSumDirectSql = null;
      this.whStockSumDirectSqlVer = -1;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`WH stock sum direct query failed: ${msg}`);
      throw new BadRequestException(
        `창고별수불집계조회(직접 SQL)에 실패했습니다. _TLGInoutDaily·Item·창고·품목 테이블 SELECT 권한과 컬럼명을 확인하세요. (${msg.slice(0, 240)})`,
      );
    }

    const rawSet = result.recordset ?? [];
    const truncated = rawSet.length > maxRows;
    const slice = truncated ? rawSet.slice(0, maxRows) : rawSet;
    return { items: slice.map((r, i) => mapDirectSqlRowToGrid(r as Record<string, unknown>, i + 1)), truncated };
  }

  async listByDateRange(
    fromIso: string,
    toIso: string,
    limit?: number,
    bizUnitArg?: number,
  ): Promise<{ items: WhStockSumGridRow[]; truncated: boolean }> {
    const from = this.parseLocalYmd(fromIso);
    const to = this.parseLocalYmd(toIso);
    if (!from || !to) throw new BadRequestException('유효하지 않은 날짜입니다.');
    if (from > to) throw new BadRequestException('시작일이 종료일보다 늦을 수 없습니다.');
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86400_000) {
      throw new BadRequestException(`조회 기간은 최대 ${MAX_RANGE_DAYS}일까지 가능합니다.`);
    }

    const dateFr = this.fmtYmd(from);
    const dateTo = this.fmtYmd(to);
    const maxRows = Math.min(limit ?? DEFAULT_LIMIT, 10_000);
    const fetchCount = maxRows + 1;

    const useStockSumNql = this.config.get<string>('ERP_WH_STOCK_SUM_USE_SP_STOCK_SUM_LIST_QUERY_NQL') === 'true';
    if (useStockSumNql) {
      return this.listBySpStockSumListQueryNql(dateFr, dateTo, maxRows);
    }

    const serviceSeq = parseOptionalInt(this.config, 'ERP_WH_STOCK_SUM_SERVICE_SEQ', 1, 2_000_000_000) ?? 152910054;
    const methodSeq = parseOptionalInt(this.config, 'ERP_WH_STOCK_SUM_METHOD_SEQ', 1, 999) ?? 2;
    const pgmSeq = parseOptionalInt(this.config, 'ERP_WH_STOCK_SUM_PGM_SEQ', 1, 2_000_000_000) ?? 152910062;
    const companySeq = parseOptionalInt(this.config, 'ERP_WH_STOCK_SUM_COMPANY_SEQ', 1, 2_000_000_000) ?? 1;
    const languageSeq = parseOptionalInt(this.config, 'ERP_WH_STOCK_SUM_LANGUAGE_SEQ', 1, 99) ?? 1;
    const userSeq = parseOptionalInt(this.config, 'ERP_WH_STOCK_SUM_USER_SEQ', 1, 2_000_000_000) ?? 5;
    const bizUnit = bizUnitArg ?? parseOptionalInt(this.config, 'ERP_WH_STOCK_SUM_BIZ_UNIT', 0, 999999) ?? 1;

    const smQryType = (this.config.get<string>('ERP_WH_STOCK_SUM_SM_QRY_TYPE') ?? 'S').trim().slice(0, 1) || 'S';
    const smWhType = parseOptionalInt(this.config, 'ERP_WH_STOCK_SUM_SMWH_TYPE', 0, 2_000_000_000) ?? 8_104_001;
    const smUnitType = parseOptionalInt(this.config, 'ERP_WH_STOCK_SUM_SM_UNIT_TYPE', 0, 2_000_000_000) ?? 8_103_001;
    const smStockAmtType = parseOptionalInt(this.config, 'ERP_WH_STOCK_SUM_SM_STOCK_AMT_TYPE', 0, 2_000_000_000) ?? 8_105_002;

    const useErpProc = this.config.get<string>('ERP_WH_STOCK_SUM_USE_ERP_PROC') === 'true';
    if (useErpProc) {
      return this.listByStoredProc(
        dateFr,
        dateTo,
        maxRows,
        fetchCount,
        bizUnit,
        smQryType,
        smWhType,
        smUnitType,
        smStockAmtType,
        serviceSeq,
        methodSeq,
        pgmSeq,
        companySeq,
        languageSeq,
        userSeq,
      );
    }

    return this.listByDirectTables(from, dateFr, dateTo, maxRows, fetchCount, bizUnit, smQryType, smWhType, smUnitType, smStockAmtType, companySeq);
  }
}
