import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mssql from 'mssql';

/**
 * 반품요청 품목 — `dbo._TSLDVReq` + `dbo._TSLDVReqItem`
 * `UMOutKind` = `_TDAUMinorValue` 에서 MajorSeq=8020, Serl=2002, ValueText='1' 인 MinorSeq 와 일치하는 건만.
 * 조인·일자·문서키 컬럼은 INFORMATION_SCHEMA 로 감지합니다.
 */
export type TslDvReqItemRow = {
  rowNo: number;
  bizUnit: number | null;
  reqSeq: number | null;
  reqNo: string | null;
  reqDate: string;
  umOutKind: number | null;
  customerCode: string | null;
  customerName: string | null;
  deptName: string | null;
  empName: string | null;
  lineSerl: number | null;
  itemNo: string | null;
  itemName: string | null;
  spec: string | null;
  unit: string | null;
  qty: number | null;
  unitPrice: number | null;
  supplyAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  remark: string | null;
};

type SqlRow = {
  BizUnit: number | null;
  ReqSeq: number | null;
  ReqNoFmt: string | null;
  ReqDateRaw: string | null;
  UMOutKind: number | null;
  CustNo: string | null;
  CustName: string | null;
  DeptName: string | null;
  EmpName: string | null;
  LineSerl: number | null;
  ItemNo: string | null;
  ItemName: string | null;
  Spec: string | null;
  UnitName: string | null;
  Qty: number | null;
  LineUnitPrice: number | null;
  DomAmt: number | null;
  DomVAT: number | null;
  LineTotal: number | null;
  LineRemark: string | null;
  LineMemo: string | null;
};

type ColMeta = { TABLE_NAME: string; COLUMN_NAME: string };

type DvReqSqlPlan = {
  joinSeq: string;
  dateCol: string;
  lineSerlCol: string;
  reqNoExpr: string;
  custJoin: string;
  custSelectNo: string;
  custSelectName: string;
  deptJoin: string;
  deptSelect: string;
  empJoin: string;
  empSelect: string;
  itemJoin: string;
  itemNoSelect: string;
  itemNameSelect: string;
  itemSpecSelect: string;
  unitJoin: string;
  unitSelect: string;
  lineRemarkSelect: string;
  lineMemoSelect: string;
  lineQtyExpr: string;
  linePriceExpr: string;
  domAmtExpr: string;
  domVatExpr: string;
  domAmtInner: string;
  domVatInner: string;
};

const DEFAULT_LIMIT = 8000;
const MAX_RANGE_DAYS = 400;

/** `_TDAUMinorValue` 매칭: 이 조건의 MinorSeq 와 헤더 `UMOutKind` 일치 */
const UM_MINOR_MAJOR = 8020;
const UM_MINOR_SERL = 2002;
const UM_MINOR_VALUE_TEXT = '1';

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

function mapRow(r: SqlRow): Omit<TslDvReqItemRow, 'rowNo'> {
  return {
    bizUnit: r.BizUnit == null ? null : Number(r.BizUnit),
    reqSeq: r.ReqSeq == null ? null : Number(r.ReqSeq),
    reqNo: trimOrNull(r.ReqNoFmt),
    reqDate: yyyymmddToIso(r.ReqDateRaw),
    umOutKind: r.UMOutKind == null ? null : Number(r.UMOutKind),
    customerCode: trimOrNull(r.CustNo),
    customerName: trimOrNull(r.CustName),
    deptName: trimOrNull(r.DeptName),
    empName: trimOrNull(r.EmpName),
    lineSerl: r.LineSerl == null ? null : Number(r.LineSerl),
    itemNo: trimOrNull(r.ItemNo),
    itemName: trimOrNull(r.ItemName),
    spec: trimOrNull(r.Spec),
    unit: trimOrNull(r.UnitName),
    qty: toNumber(r.Qty),
    unitPrice: toNumber(r.LineUnitPrice),
    supplyAmount: toNumber(r.DomAmt),
    vatAmount: toNumber(r.DomVAT),
    totalAmount: toNumber(r.LineTotal),
    remark: trimOrNull(r.LineRemark) ?? trimOrNull(r.LineMemo),
  };
}

function hasCol(set: Set<string>, table: string, col: string): boolean {
  return set.has(`${table.toUpperCase()}|${col.toUpperCase()}`);
}

function pickCol(cols: ColMeta[], table: string, candidates: string[]): string | null {
  const t = table.toUpperCase();
  for (const cand of candidates) {
    const hit = cols.find((c) => c.TABLE_NAME.toUpperCase() === t && c.COLUMN_NAME.toUpperCase() === cand.toUpperCase());
    if (hit) {
      return hit.COLUMN_NAME;
    }
  }
  return null;
}

function buildPlan(cols: ColMeta[]): DvReqSqlPlan {
  const set = new Set(cols.map((c) => `${c.TABLE_NAME.toUpperCase()}|${c.COLUMN_NAME.toUpperCase()}`));

  const joinCandidates = ['DVReqSeq', 'ReqSeq', 'SlipSeq', 'ReturnReqSeq', 'HdrSeq'];
  let joinSeq: string | null = null;
  for (const c of joinCandidates) {
    if (hasCol(set, '_TSLDVReq', c) && hasCol(set, '_TSLDVReqItem', c)) {
      joinSeq = pickCol(cols, '_TSLDVReq', [c]);
      break;
    }
  }
  if (!joinSeq) {
    throw new BadRequestException(
      '_TSLDVReq / _TSLDVReqItem 에 공통 문서키 컬럼(DVReqSeq·ReqSeq 등)을 찾지 못했습니다.',
    );
  }

  const dateCol =
    pickCol(cols, '_TSLDVReq', ['ReqDate', 'DVReqDate', 'RegDate', 'SlipDate', 'IssueDate', 'OutDate', 'WorkDate']) ??
    pickCol(cols, '_TSLDVReq', ['ReqYMD', 'DVReqYMD']);
  if (!dateCol) {
    throw new BadRequestException('_TSLDVReq 에서 일자 컬럼(ReqDate·DVReqDate 등)을 찾지 못했습니다.');
  }

  const lineSerlCol = pickCol(cols, '_TSLDVReqItem', [
    'DVReqSerl',
    'ReqSerl',
    'ItemSerl',
    'Serl',
    'LineSerl',
    'InvoiceSerl',
  ]);
  if (!lineSerlCol) {
    throw new BadRequestException('_TSLDVReqItem 에서 라인 순번 컬럼을 찾지 못했습니다.');
  }

  const reqNoCol = pickCol(cols, '_TSLDVReq', ['ReqNo', 'DVReqNo', 'SlipNo', 'ReturnReqNo', 'DocNo']);
  const reqNoExpr = reqNoCol
    ? `LTRIM(RTRIM(h.[${reqNoCol}])) AS ReqNoFmt`
    : `CAST(NULL AS nvarchar(64)) AS ReqNoFmt`;

  const hasCust = hasCol(set, '_TSLDVReq', 'CustSeq');
  const custJoin = hasCust
    ? `LEFT JOIN dbo.[_TDACust] c ON h.CompanySeq = c.CompanySeq AND h.CustSeq = c.CustSeq`
    : '';
  const custSelectNo = hasCust ? 'c.CustNo AS CustNo' : 'CAST(NULL AS nvarchar(64)) AS CustNo';
  const custSelectName = hasCust ? 'c.CustName AS CustName' : 'CAST(NULL AS nvarchar(200)) AS CustName';

  const hasDept = hasCol(set, '_TSLDVReq', 'DeptSeq');
  const deptJoin = hasDept
    ? `LEFT JOIN dbo.[_TDADept] dp ON h.CompanySeq = dp.CompanySeq AND h.DeptSeq = dp.DeptSeq`
    : '';
  const deptSelect = hasDept ? 'dp.DeptName AS DeptName' : 'CAST(NULL AS nvarchar(200)) AS DeptName';

  const hasEmp = hasCol(set, '_TSLDVReq', 'EmpSeq');
  const empJoin = hasEmp
    ? `LEFT JOIN dbo.[_TDAEmp] emp ON h.CompanySeq = emp.CompanySeq AND h.EmpSeq = emp.EmpSeq`
    : '';
  const empSelect = hasEmp ? 'emp.EmpName AS EmpName' : 'CAST(NULL AS nvarchar(100)) AS EmpName';

  const hasItemSeq = hasCol(set, '_TSLDVReqItem', 'ItemSeq');
  const itemJoin = hasItemSeq
    ? `LEFT JOIN dbo.[_TDAItem] it ON h.CompanySeq = it.CompanySeq AND i.ItemSeq = it.ItemSeq`
    : '';
  const itemNoSelect = hasItemSeq ? 'it.ItemNo AS ItemNo' : 'CAST(NULL AS nvarchar(80)) AS ItemNo';
  const itemNameSelect = hasItemSeq ? 'it.ItemName AS ItemName' : 'CAST(NULL AS nvarchar(200)) AS ItemName';
  const itemSpecSelect = hasItemSeq ? 'it.Spec AS Spec' : 'CAST(NULL AS nvarchar(200)) AS Spec';

  const hasUnitSeq = hasCol(set, '_TSLDVReqItem', 'UnitSeq');
  const hasItemUnitOnItem = hasItemSeq && hasCol(set, '_TDAItem', 'UnitSeq');
  const unitJoin =
    hasUnitSeq && hasItemSeq
      ? `LEFT JOIN dbo.[_TDAUnit] u ON h.CompanySeq = u.CompanySeq AND u.UnitSeq = COALESCE(NULLIF(i.UnitSeq, 0), it.UnitSeq)`
      : hasItemUnitOnItem
        ? `LEFT JOIN dbo.[_TDAUnit] u ON h.CompanySeq = u.CompanySeq AND u.UnitSeq = it.UnitSeq`
        : '';
  const unitSelect =
    unitJoin.trim().length > 0 ? 'u.UnitName AS UnitName' : 'CAST(NULL AS nvarchar(80)) AS UnitName';

  const lineRemarkSelect = hasCol(set, '_TSLDVReqItem', 'Remark')
    ? 'i.Remark AS LineRemark'
    : hasCol(set, '_TSLDVReqItem', 'LineRemark')
      ? 'i.LineRemark AS LineRemark'
      : 'CAST(NULL AS nvarchar(max)) AS LineRemark';
  const lineMemoSelect = hasCol(set, '_TSLDVReqItem', 'Memo')
    ? 'i.Memo AS LineMemo'
    : 'CAST(NULL AS nvarchar(max)) AS LineMemo';

  const priceBits: string[] = [];
  if (hasCol(set, '_TSLDVReqItem', 'CustPrice')) {
    priceBits.push('NULLIF(i.CustPrice, 0)');
  }
  if (hasCol(set, '_TSLDVReqItem', 'ItemPrice')) {
    priceBits.push('NULLIF(i.ItemPrice, 0)');
  }
  if (hasCol(set, '_TSLDVReqItem', 'Price')) {
    priceBits.push('i.Price');
  }
  let linePriceExpr: string;
  if (priceBits.length === 0) {
    linePriceExpr = 'CAST(NULL AS decimal(18, 4))';
  } else if (priceBits.length === 1) {
    linePriceExpr = priceBits[0];
  } else {
    linePriceExpr = `COALESCE(${priceBits.join(', ')})`;
  }

  const lineQtyExpr = hasCol(set, '_TSLDVReqItem', 'Qty') ? 'i.Qty AS Qty' : 'CAST(NULL AS decimal(18, 6)) AS Qty';
  const domAmtInner = hasCol(set, '_TSLDVReqItem', 'DomAmt') ? 'i.DomAmt' : 'CAST(NULL AS decimal(18, 4))';
  const domVatInner = hasCol(set, '_TSLDVReqItem', 'DomVAT') ? 'i.DomVAT' : 'CAST(NULL AS decimal(18, 4))';
  const domAmtExpr = `${domAmtInner} AS DomAmt`;
  const domVatExpr = `${domVatInner} AS DomVAT`;

  if (!hasCol(set, '_TSLDVReq', 'UMOutKind')) {
    throw new BadRequestException('_TSLDVReq 테이블에 UMOutKind 컬럼이 없습니다.');
  }

  return {
    joinSeq,
    dateCol,
    lineSerlCol,
    reqNoExpr,
    custJoin,
    custSelectNo,
    custSelectName,
    deptJoin,
    deptSelect,
    empJoin,
    empSelect,
    itemJoin,
    itemNoSelect,
    itemNameSelect,
    itemSpecSelect,
    unitJoin,
    unitSelect,
    lineRemarkSelect,
    lineMemoSelect,
    lineQtyExpr,
    linePriceExpr,
    domAmtExpr,
    domVatExpr,
    domAmtInner,
    domVatInner,
  };
}

@Injectable()
export class ErpTslDvReqItemsService {
  private readonly logger = new Logger(ErpTslDvReqItemsService.name);
  private pool: mssql.ConnectionPool | null = null;
  private poolPromise: Promise<mssql.ConnectionPool> | null = null;
  private sqlPlan: DvReqSqlPlan | null = null;

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

  private async ensureSqlPlan(pool: mssql.ConnectionPool): Promise<DvReqSqlPlan> {
    if (this.sqlPlan) {
      return this.sqlPlan;
    }
    const meta = await pool.request().query<ColMeta>(`
      SELECT c.TABLE_NAME AS TABLE_NAME, c.COLUMN_NAME AS COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_SCHEMA = N'dbo'
        AND c.TABLE_NAME IN (N'_TSLDVReq', N'_TSLDVReqItem', N'_TDAItem', N'_TDAUnit')
    `);
    const rows = meta.recordset ?? [];
    this.sqlPlan = buildPlan(rows);
    this.logger.log(
      `TSL DV Req SQL plan: join=${this.sqlPlan.joinSeq} date=${this.sqlPlan.dateCol} lineSerl=${this.sqlPlan.lineSerlCol}`,
    );
    return this.sqlPlan;
  }

  /**
   * 반품요청일(헤더) 구간 + UMOutKind = MinorSeq(MajorSeq=8020, Serl=2002, ValueText='1')
   */
  async listByReqDateRange(
    fromIso: string,
    toIso: string,
    limit?: number,
  ): Promise<{ items: TslDvReqItemRow[]; truncated: boolean }> {
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

    const companySeq = this.parseOptionalPositiveInt('ERP_TSL_DV_REQ_COMPANY_SEQ', 'ERP_TSL_DV_REQ_COMPANY_SEQ');
    const bizUnitFilter = this.parseOptionalPositiveInt('ERP_TSL_DV_REQ_BIZ_UNIT', 'ERP_TSL_DV_REQ_BIZ_UNIT');

    const pool = await this.getPool();
    const plan = await this.ensureSqlPlan(pool);

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

    const umMatchSql = `(SELECT TOP 1 m.MinorSeq FROM dbo.[_TDAUMinorValue] m
      WHERE m.MajorSeq = ${UM_MINOR_MAJOR} AND m.Serl = ${UM_MINOR_SERL}
        AND LTRIM(RTRIM(CAST(m.ValueText AS NVARCHAR(200)))) = N'${UM_MINOR_VALUE_TEXT.replace(/'/g, "''")}')`;

    const sql = `
      SELECT TOP (@fetchCount)
        h.BizUnit AS BizUnit,
        h.[${plan.joinSeq}] AS ReqSeq,
        ${plan.reqNoExpr},
        LTRIM(RTRIM(h.[${plan.dateCol}])) AS ReqDateRaw,
        h.UMOutKind AS UMOutKind,
        ${plan.custSelectNo},
        ${plan.custSelectName},
        ${plan.deptSelect},
        ${plan.empSelect},
        CAST(i.[${plan.lineSerlCol}] AS int) AS LineSerl,
        ${plan.itemNoSelect},
        ${plan.itemNameSelect},
        ${plan.itemSpecSelect},
        ${plan.unitSelect},
        ${plan.lineQtyExpr},
        ${plan.linePriceExpr} AS LineUnitPrice,
        ${plan.domAmtExpr},
        ${plan.domVatExpr},
        CAST(ISNULL(${plan.domAmtInner}, 0) + ISNULL(${plan.domVatInner}, 0) AS decimal(18, 4)) AS LineTotal,
        ${plan.lineRemarkSelect},
        ${plan.lineMemoSelect}
      FROM dbo.[_TSLDVReq] h
      INNER JOIN dbo.[_TSLDVReqItem] i
        ON h.CompanySeq = i.CompanySeq AND h.[${plan.joinSeq}] = i.[${plan.joinSeq}]
      ${plan.custJoin}
      ${plan.deptJoin}
      ${plan.empJoin}
      ${plan.itemJoin}
      ${plan.unitJoin}
      WHERE LTRIM(RTRIM(h.[${plan.dateCol}])) >= @fromYmd
        AND LTRIM(RTRIM(h.[${plan.dateCol}])) <= @toYmd
        AND h.UMOutKind = ${umMatchSql}
        ${whereTail}
      ORDER BY LTRIM(RTRIM(h.[${plan.dateCol}])) ASC, h.CompanySeq ASC, h.[${plan.joinSeq}] ASC, i.[${plan.lineSerlCol}] ASC
    `;

    let result: mssql.IResult<SqlRow>;
    try {
      result = await request.query<SqlRow>(sql);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`TSL DV Req items query failed: ${msg}`);
      throw new BadRequestException(`ERP 반품요청 품목 조회에 실패했습니다. (${msg})`);
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
