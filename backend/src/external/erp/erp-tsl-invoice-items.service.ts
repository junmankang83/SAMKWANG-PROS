import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mssql from 'mssql';

/**
 * 거래명세서 품목 조회 (엑셀/ERP 그리드 열 순서)
 */
export type TslInvoiceItemRow = {
  rowNo: number;
  bizUnit: number | null;
  invoiceNo: string | null;
  invoiceDate: string;
  customerCode: string | null;
  customerName: string | null;
  outboundWhCode: number | null;
  outboundWhName: string | null;
  chargePersonName: string | null;
  chargeDeptName: string | null;
  itemNo: string | null;
  itemName: string | null;
  spec: string | null;
  unit: string | null;
  managementUnit: string | null;
  qty: number | null;
  unitPrice: number | null;
  supplyAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  foreignUnitPrice: number | null;
  foreignAmount: number | null;
  exchangeRate: number | null;
  currencyName: string | null;
  remark: string | null;
  projectCode: string | null;
  projectName: string | null;
  inspectionKind: string | null;
  inboundWhCode: number | null;
  inboundWhName: string | null;
  lotNo: string | null;
  productionDate: string | null;
  expiryDate: string | null;
};

type SqlRow = {
  BizUnit: number | null;
  InvoiceNoFmt: string | null;
  InvoiceDateRaw: string | null;
  CustNo: string | null;
  CustName: string | null;
  OutWHSeq: number | null;
  OutWHName: string | null;
  InvEmpName: string | null;
  DeptName: string | null;
  ItemNo: string | null;
  ItemName: string | null;
  Spec: string | null;
  UnitName: string | null;
  StdUnitName: string | null;
  Qty: number | null;
  LineUnitPrice: number | null;
  DomAmt: number | null;
  DomVAT: number | null;
  LineTotal: number | null;
  ForeignUnitPrice: number | null;
  CurAmt: number | null;
  ExRate: number | null;
  CurrName: string | null;
  CurrNo: string | null;
  LineRemark: string | null;
  LineMemo: string | null;
  PJTNo: string | null;
  PJTName: string | null;
  IsInspection: string | null;
  InWHSeq: number | null;
  InWHName: string | null;
  LotNo: string | null;
  ProductionDate: string | null;
  ExpiryDate: string | null;
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

function mapRow(r: SqlRow): Omit<TslInvoiceItemRow, 'rowNo'> {
  return {
    bizUnit: r.BizUnit == null ? null : Number(r.BizUnit),
    invoiceNo: trimOrNull(r.InvoiceNoFmt),
    invoiceDate: yyyymmddToIso(r.InvoiceDateRaw),
    customerCode: trimOrNull(r.CustNo),
    customerName: trimOrNull(r.CustName),
    outboundWhCode: r.OutWHSeq == null ? null : Number(r.OutWHSeq),
    outboundWhName: trimOrNull(r.OutWHName),
    chargePersonName: trimOrNull(r.InvEmpName),
    chargeDeptName: trimOrNull(r.DeptName),
    itemNo: trimOrNull(r.ItemNo),
    itemName: trimOrNull(r.ItemName),
    spec: trimOrNull(r.Spec),
    unit: trimOrNull(r.UnitName),
    managementUnit: trimOrNull(r.StdUnitName),
    qty: toNumber(r.Qty),
    unitPrice: toNumber(r.LineUnitPrice),
    supplyAmount: toNumber(r.DomAmt),
    vatAmount: toNumber(r.DomVAT),
    totalAmount: toNumber(r.LineTotal),
    foreignUnitPrice: toNumber(r.ForeignUnitPrice),
    foreignAmount: toNumber(r.CurAmt),
    exchangeRate: toNumber(r.ExRate),
    currencyName: trimOrNull(r.CurrName) ?? trimOrNull(r.CurrNo),
    remark: trimOrNull(r.LineRemark) ?? trimOrNull(r.LineMemo),
    projectCode: trimOrNull(r.PJTNo),
    projectName: trimOrNull(r.PJTName),
    inspectionKind: trimOrNull(r.IsInspection),
    inboundWhCode: r.InWHSeq == null ? null : Number(r.InWHSeq),
    inboundWhName: trimOrNull(r.InWHName),
    lotNo: trimOrNull(r.LotNo),
    productionDate: trimOrNull(r.ProductionDate),
    expiryDate: trimOrNull(r.ExpiryDate),
  };
}

const DEFAULT_LIMIT = 8000;
const MAX_RANGE_DAYS = 400;

/** `_TSLInvoice.SMExpKind` 가 이 값이면 수출 등으로 조회 대상에서 제외 */
const EXCLUDED_SM_EXP_KIND = '8009004';

type TslInvoiceSqlFragments = {
  /** SELECT 절에 붙는 식(별칭 포함) */
  lineRemarkSelect: string;
  lineMemoSelect: string;
  inspectionSelect: string;
  /** SELECT: 단가 식(별칭 LineUnitPrice) */
  lineUnitPriceExpr: string;
  currNameSelect: string;
  currNoSelect: string;
  /** WHERE 절에 `AND (...)` 형태로 붙임(항상 참이 될 수 있음) */
  smExpKindPredicate: string;
};

@Injectable()
export class ErpTslInvoiceItemsService {
  private readonly logger = new Logger(ErpTslInvoiceItemsService.name);
  private pool: mssql.ConnectionPool | null = null;
  private poolPromise: Promise<mssql.ConnectionPool> | null = null;
  /** 첫 조회 시 ERP 스키마에 맞춘 SQL 조각(캐시) */
  private tslSqlFragments: TslInvoiceSqlFragments | null = null;

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
      this.logger.log(`ERP MSSQL connected (${host}:${port}/${database})`);
      return pool;
    })().catch((err) => {
      this.poolPromise = null;
      this.pool = null;
      this.tslSqlFragments = null;
      this.logger.error('ERP MSSQL connection failed', err);
      throw new ServiceUnavailableException(
        'ERP 데이터베이스에 연결할 수 없습니다. 네트워크 및 접속 정보를 확인하세요.',
      );
    });

    return this.poolPromise;
  }

  /**
   * ERP별로 `_TSLInvoice` / `_TSLInvoiceItem` 컬럼명이 다를 수 있어 INFORMATION_SCHEMA로 감지합니다.
   * 없는 컬럼을 참조하면 SQL Server가 500에 가까운 오류를 내는 경우가 많아, 안전한 대체 식을 씁니다.
   */
  private async resolveTslSqlFragments(pool: mssql.ConnectionPool): Promise<TslInvoiceSqlFragments> {
    if (this.tslSqlFragments) {
      return this.tslSqlFragments;
    }
    const meta = await pool.request().query<{ TABLE_NAME: string; COLUMN_NAME: string }>(`
      SELECT UPPER(c.TABLE_NAME) AS TABLE_NAME, UPPER(c.COLUMN_NAME) AS COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_SCHEMA = N'dbo'
        AND c.TABLE_NAME IN (N'_TSLInvoice', N'_TSLInvoiceItem', N'_TDACurr')
    `);
    const set = new Set<string>();
    for (const r of meta.recordset ?? []) {
      set.add(`${r.TABLE_NAME}|${r.COLUMN_NAME}`);
    }
    const has = (table: string, col: string): boolean =>
      set.has(`${table.toUpperCase()}|${col.toUpperCase()}`);

    const lineRemarkSelect = has('_TSLInvoiceItem', 'Remark')
      ? 'i.Remark AS LineRemark'
      : has('_TSLInvoiceItem', 'LineRemark')
        ? 'i.LineRemark AS LineRemark'
        : 'CAST(NULL AS nvarchar(max)) AS LineRemark';
    const lineMemoSelect = has('_TSLInvoiceItem', 'Memo')
      ? 'i.Memo AS LineMemo'
      : 'CAST(NULL AS nvarchar(max)) AS LineMemo';

    let inspectionSelect: string;
    if (has('_TSLInvoiceItem', 'IsInspection')) {
      inspectionSelect = 'i.IsInspection AS IsInspection';
    } else if (has('_TSLInvoice', 'IsInspection')) {
      inspectionSelect = 'h.IsInspection AS IsInspection';
    } else {
      inspectionSelect = 'CAST(NULL AS nvarchar(50)) AS IsInspection';
    }

    const smHdr = has('_TSLInvoice', 'SMExpKind');
    const smLn = has('_TSLInvoiceItem', 'SMExpKind');
    const hOk = !smHdr
      ? '1=1'
      : '(h.SMExpKind IS NULL OR LTRIM(RTRIM(CAST(h.SMExpKind AS NVARCHAR(50)))) <> @excludeSmExpKind)';
    const iOk = !smLn
      ? '1=1'
      : '(i.SMExpKind IS NULL OR LTRIM(RTRIM(CAST(i.SMExpKind AS NVARCHAR(50)))) <> @excludeSmExpKind)';
    const smExpKindPredicate = `(${hOk} AND ${iOk})`;

    const priceBits: string[] = [];
    if (has('_TSLInvoiceItem', 'CustPrice')) {
      priceBits.push('NULLIF(i.CustPrice, 0)');
    }
    if (has('_TSLInvoiceItem', 'ItemPrice')) {
      priceBits.push('NULLIF(i.ItemPrice, 0)');
    }
    if (has('_TSLInvoiceItem', 'Price')) {
      priceBits.push('i.Price');
    }
    let lineUnitPriceExpr: string;
    if (priceBits.length === 0) {
      lineUnitPriceExpr = 'CAST(NULL AS decimal(18, 4))';
    } else if (priceBits.length === 1) {
      lineUnitPriceExpr = priceBits[0];
    } else {
      lineUnitPriceExpr = `COALESCE(${priceBits.join(', ')})`;
    }

    const currNameSelect = has('_TDACurr', 'CurrName')
      ? 'curr.CurrName AS CurrName'
      : 'CAST(NULL AS nvarchar(100)) AS CurrName';
    const currNoSelect = has('_TDACurr', 'CurrNo')
      ? 'curr.CurrNo AS CurrNo'
      : 'CAST(NULL AS nvarchar(50)) AS CurrNo';

    this.tslSqlFragments = {
      lineRemarkSelect,
      lineMemoSelect,
      inspectionSelect,
      smExpKindPredicate,
      lineUnitPriceExpr,
      currNameSelect,
      currNoSelect,
    };
    this.logger.log(
      `TSL invoice SQL: Remark=${has('_TSLInvoiceItem', 'Remark')} Memo=${has('_TSLInvoiceItem', 'Memo')} ` +
        `IsInspection=${has('_TSLInvoiceItem', 'IsInspection') ? 'item' : has('_TSLInvoice', 'IsInspection') ? 'hdr' : 'none'} ` +
        `SMExpKind hdr=${smHdr} line=${smLn} priceCols=${priceBits.length}`,
    );
    return this.tslSqlFragments;
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

  /**
   * 거래명세서 일자 구간 품목 라인 (엑셀 양식 컬럼).
   * 입고창고: 라인 `DVPlaceSeq`를 `_TDAWH`와 매칭(현장 DB가 다르면 조인 조정).
   * 생산일자·유효일자: 별도 LOT 테이블 미연동 시 빈 값.
   * 헤더·품목라인 `SMExpKind` 중 **어느 한쪽이라도** 수출 코드 `8009004`이면 해당 라인은 제외합니다.
   */
  async listByInvoiceDateRange(
    fromIso: string,
    toIso: string,
    limit?: number,
  ): Promise<{ items: TslInvoiceItemRow[]; truncated: boolean }> {
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
      'ERP_TSL_INVOICE_COMPANY_SEQ',
      'ERP_TSL_INVOICE_COMPANY_SEQ',
    );
    const bizUnitFilter = this.parseOptionalPositiveInt('ERP_TSL_INVOICE_BIZ_UNIT', 'ERP_TSL_INVOICE_BIZ_UNIT');

    const pool = await this.getPool();
    const frag = await this.resolveTslSqlFragments(pool);
    const request = pool.request();
    request.input('fromYmd', mssql.Char(8), fromYmd);
    request.input('toYmd', mssql.Char(8), toYmd);
    request.input('fetchCount', mssql.Int, fetchCount);
    request.input('excludeSmExpKind', mssql.NVarChar(32), EXCLUDED_SM_EXP_KIND);
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

    let result: mssql.IResult<SqlRow>;
    try {
      result = await request.query<SqlRow>(`
      SELECT TOP (@fetchCount)
        h.BizUnit AS BizUnit,
        CASE
          WHEN LEN(LTRIM(RTRIM(h.InvoiceNo))) = 10 AND LTRIM(RTRIM(h.InvoiceNo)) NOT LIKE N'%-%'
            THEN LEFT(LTRIM(RTRIM(h.InvoiceNo)), 6) + N'-' + SUBSTRING(LTRIM(RTRIM(h.InvoiceNo)), 7, 20)
          ELSE LTRIM(RTRIM(h.InvoiceNo))
        END AS InvoiceNoFmt,
        LTRIM(RTRIM(h.InvoiceDate)) AS InvoiceDateRaw,
        c.CustNo AS CustNo,
        c.CustName AS CustName,
        i.WHSeq AS OutWHSeq,
        whOut.WHName AS OutWHName,
        invEmp.EmpName AS InvEmpName,
        dp.DeptName AS DeptName,
        it.ItemNo AS ItemNo,
        it.ItemName AS ItemName,
        it.Spec AS Spec,
        u.UnitName AS UnitName,
        uStd.UnitName AS StdUnitName,
        i.Qty AS Qty,
        ${frag.lineUnitPriceExpr} AS LineUnitPrice,
        i.DomAmt AS DomAmt,
        i.DomVAT AS DomVAT,
        CAST(ISNULL(i.DomAmt, 0) + ISNULL(i.DomVAT, 0) AS decimal(18, 4)) AS LineTotal,
        CASE
          WHEN NULLIF(i.Qty, 0) IS NULL THEN NULL
          ELSE CAST(i.CurAmt AS decimal(18, 6)) / CAST(i.Qty AS decimal(18, 6))
        END AS ForeignUnitPrice,
        i.CurAmt AS CurAmt,
        h.ExRate AS ExRate,
        ${frag.currNameSelect},
        ${frag.currNoSelect},
        ${frag.lineRemarkSelect},
        ${frag.lineMemoSelect},
        pjt.PJTNo AS PJTNo,
        pjt.PJTName AS PJTName,
        ${frag.inspectionSelect},
        i.DVPlaceSeq AS InWHSeq,
        whIn.WHName AS InWHName,
        i.LotNo AS LotNo,
        CAST(NULL AS nvarchar(30)) AS ProductionDate,
        CAST(NULL AS nvarchar(30)) AS ExpiryDate
      FROM dbo.[_TSLInvoice] h
      INNER JOIN dbo.[_TSLInvoiceItem] i
        ON h.CompanySeq = i.CompanySeq AND h.InvoiceSeq = i.InvoiceSeq
      LEFT JOIN dbo.[_TDACust] c
        ON h.CompanySeq = c.CompanySeq AND h.CustSeq = c.CustSeq
      LEFT JOIN dbo.[_TDAItem] it
        ON h.CompanySeq = it.CompanySeq AND i.ItemSeq = it.ItemSeq
      LEFT JOIN dbo.[_TDAUnit] u
        ON h.CompanySeq = u.CompanySeq
        AND u.UnitSeq = COALESCE(NULLIF(i.UnitSeq, 0), it.UnitSeq)
      LEFT JOIN dbo.[_TDAUnit] uStd
        ON h.CompanySeq = uStd.CompanySeq AND uStd.UnitSeq = NULLIF(i.STDUnitSeq, 0)
      LEFT JOIN dbo.[_TDAWH] whOut
        ON h.CompanySeq = whOut.CompanySeq AND i.WHSeq = whOut.WHSeq
      LEFT JOIN dbo.[_TDAWH] whIn
        ON h.CompanySeq = whIn.CompanySeq AND i.DVPlaceSeq = whIn.WHSeq
      LEFT JOIN dbo.[_TDADept] dp
        ON h.CompanySeq = dp.CompanySeq AND h.DeptSeq = dp.DeptSeq
      LEFT JOIN dbo.[_TDAEmp] invEmp
        ON h.CompanySeq = invEmp.CompanySeq AND h.EmpSeq = invEmp.EmpSeq
      LEFT JOIN dbo.[_TPJTProject] pjt
        ON h.CompanySeq = pjt.CompanySeq AND i.PJTSeq = pjt.PJTSeq
      LEFT JOIN dbo.[_TDACurr] curr
        ON h.CompanySeq = curr.CompanySeq AND h.CurrSeq = curr.CurrSeq
      WHERE LTRIM(RTRIM(h.InvoiceDate)) >= @fromYmd
        AND LTRIM(RTRIM(h.InvoiceDate)) <= @toYmd
        AND ${frag.smExpKindPredicate}
        ${whereTail}
      ORDER BY LTRIM(RTRIM(h.InvoiceDate)) ASC, h.CompanySeq ASC, h.InvoiceSeq ASC, i.InvoiceSerl ASC
    `);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`TSL invoice items query failed: ${msg}`);
      throw new BadRequestException(`ERP 거래명세 품목 조회에 실패했습니다. (${msg})`);
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
