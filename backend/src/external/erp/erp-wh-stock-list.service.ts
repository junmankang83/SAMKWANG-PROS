import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mssql from 'mssql';

import { normalizeErpMssqlUser2Login } from './erp-mssql-user2-normalize';
import {
  buildExcelLayoutFromOutDataBlock3,
  deriveWarehouseHeadersFromRows,
  legacyNineColRowsToBlock3Like,
  parseWarehouseHeadersJson,
  pickBestOutDataBlock3Set,
  pickBestPivotFriendlyRecordset,
  pickLastOutDataBlock4Set,
} from './erp-wh-stock-list-excel';
import { tryBuildWhStockListFromNqlAbcSets } from './erp-wh-stock-list-nql-abc';
import { buildWhStockListBatchSql, qualifyListBatchProc } from './erp-wh-stock-list-batch';
import type { WhStockListExcelDataRow, WhStockListExcelListResponse } from './wh-stock-list-grid.columns';
import { WH_STOCK_LIST_DEFAULT_WAREHOUSE_HEADERS } from './wh-stock-list-grid.columns';

const DEFAULT_LIMIT = 8000;

/**
 * 프로시저가 여러 결과 집합을 반환할 수 있음 — 스펙 9컬럼(BizUnitName·STDStockQty 등)이 있는 집합 선택.
 */
function pickWhStockListMainRecordset(
  recordsets: Record<string, unknown>[][] | undefined,
  fallback: Record<string, unknown>[] | undefined,
): Record<string, unknown>[] {
  const sets = Array.isArray(recordsets) ? recordsets.filter((s) => Array.isArray(s) && s.length > 0) : [];
  if (sets.length === 0) return fallback ?? [];

  const keysOf = (row: Record<string, unknown> | undefined): Set<string> => {
    if (!row || typeof row !== 'object') return new Set();
    return new Set(Object.keys(row).map((x) => x.toLowerCase()));
  };

  const scoreSet = (set: Record<string, unknown>[]): number => {
    const k = keysOf(set[0]);
    if (k.size === 0) return -1;
    const has = (name: string) => k.has(name.toLowerCase());
    let sc = 0;
    if (has('stdstockqty') || has('stockqty')) sc += 80;
    if (has('gooditemseq') || has('gooditemno') || has('itemseq') || has('itemno')) sc += 40;
    if (has('subitemseq') || has('subitemno')) sc += 30;
    if (has('bizunitname') || has('bizunit')) sc += 25;
    if (has('subwhseq') || has('subwhname') || has('whseq') || has('whname')) sc += 20;
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
  if (bestSc < 40 && fallback?.length) return fallback;
  return best;
}

/** 연결 오류 메시지에 비밀번호·긴 토큰이 새지 않도록 축약 */
function sanitizeMssqlConnectMessage(err: unknown): string {
  let msg = err instanceof Error ? err.message : String(err);
  msg = msg.replace(/\b(password|pwd)\b\s*[:=]\s*\S+/gi, 'password=***');
  msg = msg.replace(/pwd\s*=\s*\S+/gi, 'pwd=***');
  return msg.trim().slice(0, 220);
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
export class ErpWhStockListService {
  private readonly logger = new Logger(ErpWhStockListService.name);
  /** `#BIZ_*` + `_SWLGWHStockListQuery` — `ERP_MSSQL_USER2`·`ERP_MSSQL_PASSWORD2` */
  private poolProc: mssql.ConnectionPool | null = null;
  private poolProcPromise: Promise<mssql.ConnectionPool> | null = null;

  constructor(private readonly config: ConfigService) {}

  private getPoolStockListProc(): Promise<mssql.ConnectionPool> {
    if (this.poolProc?.connected) return Promise.resolve(this.poolProc);
    if (this.poolProcPromise) return this.poolProcPromise;

    const host = this.config.get<string>('ERP_MSSQL_HOST');
    const port = Number(this.config.get<string>('ERP_MSSQL_PORT') ?? 1433);
    const database = this.config.get<string>('ERP_MSSQL_DATABASE');
    const user2 = normalizeErpMssqlUser2Login(this.config.get<string>('ERP_MSSQL_USER2'));
    const password2 = this.config.get<string>('ERP_MSSQL_PASSWORD2')?.trim();

    if (!host || !database) {
      return Promise.reject(new ServiceUnavailableException('ERP MSSQL HOST·DATABASE 설정이 없습니다.'));
    }
    if (!user2 || !password2) {
      return Promise.reject(
        new ServiceUnavailableException(
          '창고별 재고조회는 ERP_MSSQL_USER2·ERP_MSSQL_PASSWORD2가 필요합니다. 프로시저 실행 계정을 설정하세요.',
        ),
      );
    }

    const encrypt = this.config.get<string>('ERP_MSSQL_ENCRYPT') === 'true';
    const trustServerCertificate = this.config.get<string>('ERP_MSSQL_TRUST_SERVER_CERT') !== 'false';

    this.poolProcPromise = (async () => {
      const pool = new mssql.ConnectionPool({
        server: host,
        port,
        database,
        user: user2,
        password: password2,
        options: { encrypt, trustServerCertificate },
        connectionTimeout: 30_000,
        requestTimeout: 300_000,
      });
      await pool.connect();
      this.poolProc = pool;
      this.logger.log(`ERP MSSQL connected (WH stock list — USER2 / proc) (${host}:${port}/${database})`);
      return pool;
    })().catch((err) => {
      this.poolProcPromise = null;
      this.poolProc = null;
      const detail = sanitizeMssqlConnectMessage(err);
      this.logger.error(`ERP MSSQL connection failed (WH stock list USER2): ${detail}`, err);
      throw new ServiceUnavailableException(
        `ERP 데이터베이스(USER2)에 연결할 수 없습니다. ${detail ? `(${detail})` : ''}`.trim(),
      );
    });

    return this.poolProcPromise;
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

  private resolveWarehouseHeaders(): string[] {
    const parsed = parseWarehouseHeadersJson(
      this.config.get<string>('ERP_WH_STOCK_LIST_EXCEL_WH_HEADERS'),
      this.logger,
    );
    if (parsed?.length) return [...parsed];
    return [...WH_STOCK_LIST_DEFAULT_WAREHOUSE_HEADERS];
  }

  /** 미설정·`true`면 `Sp_Inventory_NQL`(조회일만). `false`/`0`/`no`/`legacy`면 기존 `#BIZ_*`+`_SWLGWHStockListQuery` 배치 */
  private useSpInventoryNqlPath(): boolean {
    const raw = this.config.get<string>('ERP_WH_STOCK_LIST_USE_SP_INVENTORY_NQL')?.trim().toLowerCase();
    if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'legacy') return false;
    return true;
  }

  private validateSqlParamIdent(raw: string, envKey: string): string {
    const t = raw.replace(/^@/, '').trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,126}$/.test(t)) {
      throw new BadRequestException(
        `${envKey}은(는) T-SQL 매개 변수 이름 형식이어야 합니다(영문·숫자·밑줄, 최대 127자).`,
      );
    }
    return t;
  }

  private finalizeWhStockListResponse(
    asOfIso: string,
    maxRows: number,
    warehouseHeaders: string[],
    summaryIn: WhStockListExcelDataRow,
    allItems: WhStockListExcelDataRow[],
  ): WhStockListExcelListResponse {
    let summary = summaryIn;
    if (allItems.length === 0) {
      return {
        asOf: asOfIso.trim().slice(0, 10),
        truncated: false,
        warehouseHeaders,
        summary: null,
        items: [],
      };
    }

    const truncated = allItems.length > maxRows;
    const items = truncated ? allItems.slice(0, maxRows) : allItems;

    if (truncated) {
      this.logger.warn(`WH stock list: ${allItems.length} rows, truncated to ${maxRows}`);
    }

    if (items.length < allItems.length) {
      let anyQ = false;
      let sq = 0;
      let anyA = false;
      let sa = 0;
      for (const r of items) {
        if (r.totalQty != null) {
          sq += r.totalQty;
          anyQ = true;
        }
        if (r.totalAmt != null) {
          sa += r.totalAmt;
          anyA = true;
        }
      }
      const wh = warehouseHeaders.map((_, i) => {
        let q = 0;
        let a = 0;
        let hq = false;
        let ha = false;
        for (const it of items) {
          const c = it.warehouses[i]!;
          if (c.qty != null) {
            q += c.qty;
            hq = true;
          }
          if (c.amt != null) {
            a += c.amt;
            ha = true;
          }
        }
        return { qty: hq ? q : null, amt: ha ? a : null };
      });
      summary = {
        rowKind: 'TOTAL',
        assetClass: 'TOTAL',
        classL: null,
        classM: null,
        classS: null,
        importance: null,
        itemName: null,
        itemNo: null,
        spec: null,
        unit: null,
        itemStatus: null,
        totalQty: anyQ ? sq : null,
        totalAmt: anyA ? sa : null,
        warehouses: wh,
      };
    }

    return {
      asOf: asOfIso.trim().slice(0, 10),
      truncated,
      warehouseHeaders,
      summary,
      items,
    };
  }

  /**
   * `Sp_Inventory_NQL` — 조회일(YYYYMMDD) 단일 매개 변수만 전달.
   * **A·B·C 3 recordset**(열 메타·품목+합계·RowIDX/ColIDX 피벗)이면 A+C로 창고 셀을 채우고 B의 `StockQtyTot` 등으로 합계 열을 씁니다.
   * 그렇지 않으면 기존 단일 피벗 친화 recordset 경로로 조립합니다.
   */
  private async listAsOfViaSpInventoryNql(
    asOfIso: string,
    maxRows: number,
    dateToYmd: string,
  ): Promise<WhStockListExcelListResponse> {
    const procRaw = (this.config.get<string>('ERP_WH_STOCK_LIST_SP_INVENTORY_NQL_PROC') ?? 'Sp_Inventory_NQL').trim();
    const procQ = qualifyListBatchProc(procRaw);
    const paramIdent = this.validateSqlParamIdent(
      this.config.get<string>('ERP_WH_STOCK_LIST_SP_INVENTORY_NQL_DATE_PARAM') ?? 'Date',
      'ERP_WH_STOCK_LIST_SP_INVENTORY_NQL_DATE_PARAM',
    );
    const dateSqlType = (this.config.get<string>('ERP_WH_STOCK_LIST_SP_INVENTORY_NQL_DATE_SQL_TYPE') ?? 'char8')
      .trim()
      .toLowerCase();

    const pool = await this.getPoolStockListProc();
    const req = pool.request();
    if (dateSqlType === 'date' || dateSqlType === 'datetime') {
      const asOf = this.parseLocalYmd(asOfIso);
      if (!asOf) throw new BadRequestException('유효하지 않은 조회일입니다.');
      req.input(paramIdent, mssql.Date, asOf);
    } else {
      req.input(paramIdent, mssql.Char(8), dateToYmd);
    }

    const sql = `SET NOCOUNT ON; EXEC ${procQ} @${paramIdent} = @${paramIdent};`;

    let result: mssql.IResult<Record<string, unknown>>;
    try {
      result = await req.query<Record<string, unknown>>(sql);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`WH stock list Sp_Inventory_NQL failed: ${msg}`);
      throw new BadRequestException(
        `창고별 재고조회(Sp_Inventory_NQL)에 실패했습니다. (${procRaw}) (${msg.slice(0, 240)})`,
      );
    }

    const sets = (result as unknown as { recordsets?: Record<string, unknown>[][] }).recordsets;
    const nonEmpty = Array.isArray(sets) ? sets.filter((s) => Array.isArray(s) && s.length > 0) : [];

    const nqlAbc = tryBuildWhStockListFromNqlAbcSets(nonEmpty);
    if (nqlAbc) {
      const base = this.finalizeWhStockListResponse(
        asOfIso,
        maxRows,
        nqlAbc.warehouseHeaders,
        nqlAbc.summary ?? ({} as WhStockListExcelDataRow),
        nqlAbc.items,
      );
      return nqlAbc.warehouseColumns.length > 0 ? { ...base, warehouseColumns: nqlAbc.warehouseColumns } : base;
    }

    let pivotRows =
      pickBestPivotFriendlyRecordset(nonEmpty) ??
      (nonEmpty.length ? pickWhStockListMainRecordset(sets, result.recordset ?? []) : []);

    if (!pivotRows.length && nonEmpty.length) {
      pivotRows = legacyNineColRowsToBlock3Like(pickWhStockListMainRecordset(sets, result.recordset ?? []));
    }

    const derived = deriveWarehouseHeadersFromRows(pivotRows);
    const envHeaders = this.resolveWarehouseHeaders();
    const warehouseHeaders = derived.length > 0 ? derived : envHeaders;

    const { summary, items: allItems } = buildExcelLayoutFromOutDataBlock3(pivotRows, warehouseHeaders, []);
    return this.finalizeWhStockListResponse(asOfIso, maxRows, warehouseHeaders, summary, allItems);
  }

  /**
   * `#BIZ_IN_DataBlock1`에 `DateTo`=조회일(YYYYMMDD), `DateFr`=NULL, 나머지는 기본·`ERP_WH_STOCK_LIST_*` 후
   * `_SWCOMBisProcCheck`(선택) → `_SWLGWHStockListQuery` 실행. `#BIZ_OUT_DataBlock3` 스냅샷으로 엑셀 동일 42열 의미 조립.
   */
  /**
   * @param bizUnitQuery — 쿼리 `bizUnit`(사업단위). 생략 시 `ERP_WH_STOCK_LIST_BIZ_UNIT`·기본 1. (`Sp_Inventory_NQL` 경로에서는 미사용)
   */
  async listAsOf(asOfIso: string, limit?: number, bizUnitQuery?: number): Promise<WhStockListExcelListResponse> {
    const asOf = this.parseLocalYmd(asOfIso);
    if (!asOf) throw new BadRequestException('유효하지 않은 조회일입니다. YYYY-MM-DD 형식으로 지정하세요.');

    const maxRows = Math.min(limit ?? DEFAULT_LIMIT, 10_000);
    const dateToYmd = `${asOf.getFullYear()}${String(asOf.getMonth() + 1).padStart(2, '0')}${String(asOf.getDate()).padStart(2, '0')}`;

    if (this.useSpInventoryNqlPath()) {
      void bizUnitQuery;
      return this.listAsOfViaSpInventoryNql(asOfIso, maxRows, dateToYmd);
    }

    const skipProcCheck = this.config.get<string>('ERP_WH_STOCK_LIST_RUN_PROC_CHECK') === 'false';
    const listProcRaw = (this.config.get<string>('ERP_WH_STOCK_LIST_BATCH_PROC') ?? '_SWLGWHStockListQuery').trim();
    const listProcQualified = qualifyListBatchProc(listProcRaw);
    const sql = buildWhStockListBatchSql({ skipProcCheck, listProcQualified });

    const serviceSeq = parseOptionalInt(this.config, 'ERP_WH_STOCK_LIST_SERVICE_SEQ', 1, 2_000_000_000) ?? 501_534;
    const methodSeq = parseOptionalInt(this.config, 'ERP_WH_STOCK_LIST_METHOD_SEQ', 1, 999) ?? 1;
    const pgmSeq = parseOptionalInt(this.config, 'ERP_WH_STOCK_LIST_PGM_SEQ', 1, 2_000_000_000) ?? 501_179;
    const companySeq = parseOptionalInt(this.config, 'ERP_WH_STOCK_LIST_COMPANY_SEQ', 1, 2_000_000_000) ?? 1;
    const languageSeq = parseOptionalInt(this.config, 'ERP_WH_STOCK_LIST_LANGUAGE_SEQ', 1, 99) ?? 1;
    const userSeq = parseOptionalInt(this.config, 'ERP_WH_STOCK_LIST_USER_SEQ', 1, 2_000_000_000) ?? 5;
    const bizUnitFromEnv = parseOptionalInt(this.config, 'ERP_WH_STOCK_LIST_BIZ_UNIT', 0, 999_999) ?? 1;
    let bizUnit = bizUnitFromEnv;
    if (bizUnitQuery != null && Number.isFinite(bizUnitQuery)) {
      const b = Math.trunc(bizUnitQuery);
      if (b < 0 || b > 999_999) {
        throw new BadRequestException('bizUnit은 0~999999 정수여야 합니다.');
      }
      bizUnit = b;
    }
    const whSeq = parseOptionalInt(this.config, 'ERP_WH_STOCK_LIST_WH_SEQ', 0, 2_000_000_000);
    const smWhKind = parseOptionalInt(this.config, 'ERP_WH_STOCK_LIST_SMWH_KIND', 0, 2_000_000_000);
    const smQryType = (this.config.get<string>('ERP_WH_STOCK_LIST_SM_QRY_TYPE') ?? 'S').trim().slice(0, 1) || 'S';
    const smWhType = parseOptionalInt(this.config, 'ERP_WH_STOCK_LIST_SMWH_TYPE', 0, 2_000_000_000) ?? 8_104_001;
    const smUnitType = parseOptionalInt(this.config, 'ERP_WH_STOCK_LIST_SM_UNIT_TYPE', 0, 2_000_000_000) ?? 8_103_001;
    const smStockAmtType = parseOptionalInt(this.config, 'ERP_WH_STOCK_LIST_SM_STOCK_AMT_TYPE', 0, 2_000_000_000) ?? 8_105_002;
    const isStockAmt = (this.config.get<string>('ERP_WH_STOCK_LIST_IS_STOCK_AMT') ?? '1').trim().slice(0, 1) || '1';

    const pool = await this.getPoolStockListProc();
    const req = pool.request();
    req.input('DateTo', mssql.Char(8), dateToYmd);
    req.input('BizUnit', mssql.Int, bizUnit);
    req.input('SMQryType', mssql.NChar(1), smQryType);
    req.input('SMWHType', mssql.Int, smWhType);
    req.input('WHSeq', mssql.Int, whSeq ?? null);
    req.input('SMWHKind', mssql.Int, smWhKind ?? null);
    req.input('SMUnitType', mssql.Int, smUnitType);
    req.input('SMStockAmtType', mssql.Int, smStockAmtType);
    req.input('IsStockAmt', mssql.NChar(1), isStockAmt);
    req.input('ServiceSeq', mssql.Int, serviceSeq);
    req.input('MethodSeq', mssql.Int, methodSeq);
    req.input('PgmSeq', mssql.Int, pgmSeq);
    req.input('CompanySeq', mssql.Int, companySeq);
    req.input('LanguageSeq', mssql.Int, languageSeq);
    req.input('UserSeq', mssql.Int, userSeq);
    req.input('WorkingTag', mssql.NVarChar(10), '');
    req.input('IsTransaction', mssql.Bit, true);
    req.input('fetchCount', mssql.Int, maxRows);

    let result: mssql.IResult<Record<string, unknown>>;
    try {
      result = await req.query<Record<string, unknown>>(sql);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`WH stock list batch failed: ${msg}`);
      throw new BadRequestException(`창고별 재고조회에 실패했습니다. (${listProcRaw}) (${msg.slice(0, 240)})`);
    }

    const sets = (result as unknown as { recordsets?: Record<string, unknown>[][] }).recordsets;
    const nonEmpty = Array.isArray(sets) ? sets.filter((s) => Array.isArray(s) && s.length > 0) : [];

    const warehouseHeaders = this.resolveWarehouseHeaders();

    const block3Snap = pickBestOutDataBlock3Set(nonEmpty);
    const block4Snap = pickLastOutDataBlock4Set(nonEmpty);

    let { summary, items: allItems } =
      block3Snap && block3Snap.length > 0
        ? buildExcelLayoutFromOutDataBlock3(block3Snap, warehouseHeaders, block4Snap)
        : buildExcelLayoutFromOutDataBlock3(
            legacyNineColRowsToBlock3Like(pickWhStockListMainRecordset(sets, result.recordset ?? [])),
            warehouseHeaders,
            [],
          );

    return this.finalizeWhStockListResponse(asOfIso, maxRows, warehouseHeaders, summary, allItems);
  }
}
