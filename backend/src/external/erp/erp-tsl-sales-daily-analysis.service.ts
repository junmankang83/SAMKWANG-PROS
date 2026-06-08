import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mssql from 'mssql';

/**
 * 일자별판매실적분석 — `dbo._TSLInvoiceItem`(ii) 기준 + `dbo._TSLSalesItem`(si) + `dbo._TSLBillItem`(bi)
 * 업체일자 구간·마스터 조인은 스키마 감지. 조인 키는 테이블 쌍 공통 컬럼 후보로 자동 매칭.
 */
export type TslSalesDailyAnalysisRow = {
  rowNo: number;
  divisionKind: string | null;
  invoiceCompanyNo: string | null;
  invoiceCompanyDate: string;
  customerName: string | null;
  customerBizUnit: string | null;
  salesKind: string | null;
  itemAccount: string | null;
  deptName: string | null;
  empName: string | null;
  itemName: string | null;
  spec: string | null;
  unit: string | null;
  qty: number | null;
  unitPrice: number | null;
  supplyAmountForeignText: string | null;
  currency: string | null;
  exchangeRate: number | null;
  wonAmount: number | null;
  salesAmount: number | null;
  supplyAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  costUnitPriceForeign: number | null;
  costUnitPriceWon: number | null;
  costAmountWon: number | null;
  itemCode: string | null;
  itemClassName: string | null;
  itemGroupName: string | null;
  salesGroupName: string | null;
  orderNo: string | null;
  orderSerl: string | null;
  instructNo: string | null;
  instructSerl: string | null;
  shipNo: string | null;
  shipSerl: string | null;
};

type SqlRow = {
  DivisionKind: string | null;
  InvoiceCompanyNo: string | null;
  InvoiceCompanyDateRaw: string | null;
  CustomerName: string | null;
  CustomerBizUnit: string | null;
  SalesKind: string | null;
  ItemAccount: string | null;
  DeptName: string | null;
  EmpName: string | null;
  ItemName: string | null;
  Spec: string | null;
  UnitName: string | null;
  Qty: number | null;
  UnitPrice: number | null;
  SupplyAmtFc: number | null;
  CurrCode: string | null;
  SupplyAmountForeignText: string | null;
  ExchangeRate: number | null;
  WonAmount: number | null;
  SalesAmount: number | null;
  SupplyAmount: number | null;
  VatAmount: number | null;
  TotalAmount: number | null;
  CostUnitPriceFc: number | null;
  CostUnitPriceWon: number | null;
  CostAmountWon: number | null;
  ItemCode: string | null;
  ItemClassName: string | null;
  ItemGroupName: string | null;
  SalesGroupName: string | null;
  OrderNo: string | null;
  OrderSerl: string | null;
  InstructNo: string | null;
  InstructSerl: string | null;
  ShipNo: string | null;
  ShipSerl: string | null;
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
  return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
}

function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapRow(r: SqlRow): Omit<TslSalesDailyAnalysisRow, 'rowNo'> {
  const fc = toNumber(r.SupplyAmtFc);
  const cur = trimOrNull(r.CurrCode);
  let supplyForeignText = trimOrNull(r.SupplyAmountForeignText);
  if (!supplyForeignText && fc != null && cur) {
    supplyForeignText = `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(fc)} ${cur}`;
  } else if (!supplyForeignText && fc != null) {
    supplyForeignText = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(fc);
  }
  return {
    divisionKind: trimOrNull(r.DivisionKind),
    invoiceCompanyNo: trimOrNull(r.InvoiceCompanyNo),
    invoiceCompanyDate: yyyymmddToIso(r.InvoiceCompanyDateRaw),
    customerName: trimOrNull(r.CustomerName),
    customerBizUnit: trimOrNull(r.CustomerBizUnit),
    salesKind: trimOrNull(r.SalesKind),
    itemAccount: trimOrNull(r.ItemAccount),
    deptName: trimOrNull(r.DeptName),
    empName: trimOrNull(r.EmpName),
    itemName: trimOrNull(r.ItemName),
    spec: trimOrNull(r.Spec),
    unit: trimOrNull(r.UnitName),
    qty: toNumber(r.Qty),
    unitPrice: toNumber(r.UnitPrice),
    supplyAmountForeignText: supplyForeignText,
    currency: cur,
    exchangeRate: toNumber(r.ExchangeRate),
    wonAmount: toNumber(r.WonAmount),
    salesAmount: toNumber(r.SalesAmount),
    supplyAmount: toNumber(r.SupplyAmount),
    vatAmount: toNumber(r.VatAmount),
    totalAmount: toNumber(r.TotalAmount),
    costUnitPriceForeign: toNumber(r.CostUnitPriceFc),
    costUnitPriceWon: toNumber(r.CostUnitPriceWon),
    costAmountWon: toNumber(r.CostAmountWon),
    itemCode: trimOrNull(r.ItemCode),
    itemClassName: trimOrNull(r.ItemClassName),
    itemGroupName: trimOrNull(r.ItemGroupName),
    salesGroupName: trimOrNull(r.SalesGroupName),
    orderNo: trimOrNull(r.OrderNo),
    orderSerl: trimOrNull(r.OrderSerl),
    instructNo: trimOrNull(r.InstructNo),
    instructSerl: trimOrNull(r.InstructSerl),
    shipNo: trimOrNull(r.ShipNo),
    shipSerl: trimOrNull(r.ShipSerl),
  };
}

async function listColumns(pool: mssql.ConnectionPool, table: string): Promise<Set<string>> {
  const r = await pool
    .request()
    .input('tn', mssql.NVarChar(128), table)
    .query<{ COLUMN_NAME: string }>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = @tn`,
    );
  return new Set((r.recordset ?? []).map((x) => x.COLUMN_NAME.toUpperCase()));
}

function pickCol(cols: Set<string>, candidates: string[]): string | null {
  for (const c of candidates) {
    if (cols.has(c.toUpperCase())) return c;
  }
  return null;
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

function buildJoinOn(
  leftAlias: string,
  rightAlias: string,
  leftCols: Set<string>,
  rightCols: Set<string>,
  strategies: string[][],
): string | null {
  for (const group of strategies) {
    const parts: string[] = [];
    let ok = true;
    for (const col of group) {
      const u = col.toUpperCase();
      if (!leftCols.has(u) || !rightCols.has(u)) {
        ok = false;
        break;
      }
      parts.push(
        `${leftAlias}.${bracketIdent(col)} = ${rightAlias}.${bracketIdent(col)}`,
      );
    }
    if (ok && parts.length) {
      return parts.join(' AND ');
    }
  }
  return null;
}

function coalesce3Expr(
  ii: string,
  si: string,
  bi: string,
  iiCol: string | null,
  siCol: string | null,
  biCol: string | null,
  sqlType: string,
): string {
  const a = iiCol ? `${ii}.${bracketIdent(iiCol)}` : `CAST(NULL AS ${sqlType})`;
  const b = siCol ? `${si}.${bracketIdent(siCol)}` : `CAST(NULL AS ${sqlType})`;
  const c = biCol ? `${bi}.${bracketIdent(biCol)}` : `CAST(NULL AS ${sqlType})`;
  return `COALESCE(${a}, ${b}, ${c})`;
}

type AnalysisPlan = {
  iiTable: string;
  siTable: string;
  biTable: string;
  siJoinOn: string | null;
  biJoinOn: string | null;
  companyCol: string;
  dateYmdExpr: string;
  invoiceNoExpr: string;
  custSeqExpr: string;
  itemSeqExpr: string;
  deptSeqExpr: string;
  empSeqExpr: string;
  bizUnitExpr: string;
  qtyExpr: string;
  unitPriceExpr: string;
  curAmtExpr: string;
  domAmtExpr: string;
  domVatExpr: string;
  exRateExpr: string;
  currSeqExpr: string;
  costPriceFcExpr: string;
  costPriceWonExpr: string;
  costAmtWonExpr: string;
  orderNoExpr: string;
  orderSerlExpr: string;
  instNoExpr: string;
  instSerlExpr: string;
  shipNoExpr: string;
  shipSerlExpr: string;
  divisionExpr: string;
  salesKindExpr: string;
  itemAccountExpr: string;
  salesGroupExpr: string;
  unitJoinSql: string;
};

@Injectable()
export class ErpTslSalesDailyAnalysisService {
  private readonly logger = new Logger(ErpTslSalesDailyAnalysisService.name);
  private pool: mssql.ConnectionPool | null = null;
  private poolPromise: Promise<mssql.ConnectionPool> | null = null;
  private plan: AnalysisPlan | null = null;

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
      this.logger.log(`ERP MSSQL connected (TSL sales daily analysis) (${host}:${port}/${database})`);
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

  private parseOptionalPositiveInt(envKey: string, label: string): number | null {
    const raw = this.config.get<string>(envKey)?.trim();
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      throw new BadRequestException(`${label}은(는) 0 이상의 정수여야 합니다.`);
    }
    return n;
  }

  private async resolvePlan(pool: mssql.ConnectionPool): Promise<AnalysisPlan> {
    if (this.plan) return this.plan;

    let iiTable = '_TSLInvoiceItem';
    if (!(await tableExists(pool, iiTable))) iiTable = 'TSLInvoiceItem';
    let siTable = '_TSLSalesItem';
    if (!(await tableExists(pool, siTable))) siTable = 'TSLSalesItem';
    let biTable = '_TSLBillItem';
    if (!(await tableExists(pool, biTable))) biTable = 'TSLBillItem';

    if (!(await tableExists(pool, iiTable))) {
      throw new ServiceUnavailableException('dbo._TSLInvoiceItem(또는 TSLInvoiceItem) 테이블이 없습니다.');
    }
    if (!(await tableExists(pool, siTable))) {
      throw new ServiceUnavailableException('dbo._TSLSalesItem(또는 TSLSalesItem) 테이블이 없습니다.');
    }
    if (!(await tableExists(pool, biTable))) {
      throw new ServiceUnavailableException('dbo._TSLBillItem(또는 TSLBillItem) 테이블이 없습니다.');
    }

    const ii = await listColumns(pool, iiTable);
    const si = await listColumns(pool, siTable);
    const bi = await listColumns(pool, biTable);

    const companyCol =
      pickCol(ii, ['CompanySeq', 'COMPANYSEQ']) ??
      (() => {
        throw new ServiceUnavailableException(`${iiTable}에 CompanySeq가 없습니다.`);
      })();

    const siJoinStrategies: string[][] = [
      ['InvoiceSeq', 'InvoiceSerl'],
      ['SalesSeq', 'SalesSerl'],
      ['SOSeq', 'SOSerl'],
      ['TslSalesSeq', 'TslSalesSerl'],
      ['RefSalesSeq', 'RefSalesSerl'],
      ['PUSOSeq', 'PUSOSerl'],
    ];
    const siJoinOn =
      buildJoinOn(
        'ii',
        'si',
        ii,
        si,
        siJoinStrategies.map((s) => ['CompanySeq', ...s]),
      ) ?? null;

    const biJoinOn =
      buildJoinOn('ii', 'bi', ii, bi, [
        ['CompanySeq', 'InvoiceSeq', 'InvoiceSerl'],
        ['CompanySeq', 'InvoiceSeq'],
      ]) ?? null;

    const dateColIi = pickCol(ii, [
      'InvoiceDate',
      'BillDate',
      'SalesDate',
      'SlipDate',
      'RegDate',
      'OutDate',
    ]);
    const dateColSi = pickCol(si, ['SalesDate', 'InvoiceDate', 'SlipDate', 'BillDate', 'RegDate']);
    const dateColBi = pickCol(bi, ['BillDate', 'InvoiceDate', 'SalesDate', 'SlipDate']);
    const dIi = dateColIi ? `LTRIM(RTRIM(CAST(ii.${bracketIdent(dateColIi)} AS NVARCHAR(20))))` : `CAST(NULL AS NVARCHAR(20))`;
    const dSi = dateColSi ? `LTRIM(RTRIM(CAST(si.${bracketIdent(dateColSi)} AS NVARCHAR(20))))` : `CAST(NULL AS NVARCHAR(20))`;
    const dBi = dateColBi ? `LTRIM(RTRIM(CAST(bi.${bracketIdent(dateColBi)} AS NVARCHAR(20))))` : `CAST(NULL AS NVARCHAR(20))`;
    const dateYmdExpr = `CASE
      WHEN TRY_CONVERT(datetime, COALESCE(${dIi}, ${dSi}, ${dBi}), 112) IS NOT NULL
        THEN CONVERT(CHAR(8), TRY_CONVERT(datetime, COALESCE(${dIi}, ${dSi}, ${dBi}), 112), 112)
      WHEN TRY_CONVERT(datetime, COALESCE(${dIi}, ${dSi}, ${dBi})) IS NOT NULL
        THEN CONVERT(CHAR(8), TRY_CONVERT(datetime, COALESCE(${dIi}, ${dSi}, ${dBi})), 112)
      ELSE RIGHT(N'00000000' + LTRIM(RTRIM(COALESCE(${dIi}, ${dSi}, ${dBi}))), 8)
    END`;

    const invNoIi = pickCol(ii, ['InvoiceNo', 'BillNo', 'SlipNo', 'DocNo', 'OutNo']);
    const invNoSi = pickCol(si, ['InvoiceNo', 'SalesNo', 'SlipNo', 'DocNo']);
    const invNoBi = pickCol(bi, ['InvoiceNo', 'BillNo', 'SlipNo']);
    const invoiceNoExpr = `LTRIM(RTRIM(CAST(${coalesce3Expr('ii', 'si', 'bi', invNoIi, invNoSi, invNoBi, 'NVARCHAR(80)')} AS NVARCHAR(80))))`;

    const custIi = pickCol(ii, ['CustSeq', 'CUSTSEQ', 'BillCustSeq']);
    const custSi = pickCol(si, ['CustSeq', 'CUSTSEQ']);
    const custBi = pickCol(bi, ['CustSeq', 'CUSTSEQ', 'BillCustSeq']);
    const custSeqExpr = `NULLIF(TRY_CAST(${coalesce3Expr('ii', 'si', 'bi', custIi, custSi, custBi, 'INT')} AS INT), 0)`;

    const itemIi = pickCol(ii, ['ItemSeq', 'ITEMSEQ']);
    const itemSi = pickCol(si, ['ItemSeq', 'ITEMSEQ']);
    const itemBi = pickCol(bi, ['ItemSeq', 'ITEMSEQ']);
    const itemSeqExpr = `NULLIF(TRY_CAST(${coalesce3Expr('ii', 'si', 'bi', itemIi, itemSi, itemBi, 'INT')} AS INT), 0)`;

    const deptIi = pickCol(ii, ['DeptSeq', 'DEPTSEQ', 'PicDeptSeq']);
    const deptSi = pickCol(si, ['DeptSeq', 'DEPTSEQ', 'SalesDeptSeq']);
    const deptBi = pickCol(bi, ['DeptSeq', 'DEPTSEQ']);
    const deptSeqExpr = `NULLIF(TRY_CAST(${coalesce3Expr('ii', 'si', 'bi', deptIi, deptSi, deptBi, 'INT')} AS INT), 0)`;

    const empIi = pickCol(ii, ['EmpSeq', 'EMPSEQ', 'PicEmpSeq']);
    const empSi = pickCol(si, ['EmpSeq', 'EMPSEQ', 'SalesEmpSeq']);
    const empBi = pickCol(bi, ['EmpSeq', 'EMPSEQ']);
    const empSeqExpr = `NULLIF(TRY_CAST(${coalesce3Expr('ii', 'si', 'bi', empIi, empSi, empBi, 'INT')} AS INT), 0)`;

    const bizIi = pickCol(ii, ['BizUnit', 'BizUnitSeq', 'SiteSeq']);
    const bizSi = pickCol(si, ['BizUnit', 'BizUnitSeq', 'SiteSeq']);
    const bizBi = pickCol(bi, ['BizUnit', 'BizUnitSeq', 'SiteSeq']);
    const bizUnitExpr = `LTRIM(RTRIM(CAST(${coalesce3Expr('ii', 'si', 'bi', bizIi, bizSi, bizBi, 'NVARCHAR(80)')} AS NVARCHAR(80))))`;

    const qtyIi = pickCol(ii, ['Qty', 'QTY', 'SalesQty', 'BillQty']);
    const qtySi = pickCol(si, ['Qty', 'QTY', 'SalesQty']);
    const qtyBi = pickCol(bi, ['Qty', 'QTY', 'BillQty']);
    const qtyExpr = `TRY_CAST(${coalesce3Expr('ii', 'si', 'bi', qtyIi, qtySi, qtyBi, 'decimal(18,6)')} AS decimal(18, 6))`;

    const priceCandidates = ['CustPrice', 'ItemPrice', 'Price', 'UnitPrice', 'SalesPrice', 'BillPrice'];
    const pickPrice = (s: Set<string>) => pickCol(s, priceCandidates);
    const pIi = pickPrice(ii);
    const pSi = pickPrice(si);
    const pBi = pickPrice(bi);
    const unitPriceExpr = `TRY_CAST(${coalesce3Expr('ii', 'si', 'bi', pIi, pSi, pBi, 'decimal(18,6)')} AS decimal(18, 6))`;

    const curIi = pickCol(ii, ['CurAmt', 'CURAMT', 'ForeignAmt', 'FcurAmt']);
    const curSi = pickCol(si, ['CurAmt', 'CURAMT', 'ForeignAmt']);
    const curBi = pickCol(bi, ['CurAmt', 'CURAMT', 'ForeignAmt']);
    const curAmtExpr = `TRY_CAST(${coalesce3Expr('ii', 'si', 'bi', curIi, curSi, curBi, 'decimal(18,6)')} AS decimal(18, 6))`;

    const domIi = pickCol(ii, ['DomAmt', 'DOMAMT', 'SupplyAmt', 'Amt']);
    const domSi = pickCol(si, ['DomAmt', 'DOMAMT', 'SupplyAmt']);
    const domBi = pickCol(bi, ['DomAmt', 'DOMAMT', 'SupplyAmt', 'BillAmt']);
    const domAmtExpr = `TRY_CAST(${coalesce3Expr('ii', 'si', 'bi', domIi, domSi, domBi, 'decimal(18,6)')} AS decimal(18, 6))`;

    const vatIi = pickCol(ii, ['DomVAT', 'DOMVAT', 'VATAmt', 'VAT']);
    const vatSi = pickCol(si, ['DomVAT', 'DOMVAT', 'VATAmt']);
    const vatBi = pickCol(bi, ['DomVAT', 'DOMVAT', 'VATAmt', 'BillVAT']);
    const domVatExpr = `TRY_CAST(${coalesce3Expr('ii', 'si', 'bi', vatIi, vatSi, vatBi, 'decimal(18,6)')} AS decimal(18, 6))`;

    const exIi = pickCol(ii, ['ExRate', 'EXRATE', 'ExchangeRate', 'CurrRate']);
    const exSi = pickCol(si, ['ExRate', 'EXRATE', 'ExchangeRate']);
    const exBi = pickCol(bi, ['ExRate', 'EXRATE', 'ExchangeRate']);
    const exRateExpr = `TRY_CAST(${coalesce3Expr('ii', 'si', 'bi', exIi, exSi, exBi, 'decimal(18,6)')} AS decimal(18, 6))`;

    const currSeqIi = pickCol(ii, ['CurrSeq', 'CURRSEQ']);
    const currSeqSi = pickCol(si, ['CurrSeq', 'CURRSEQ']);
    const currSeqBi = pickCol(bi, ['CurrSeq', 'CURRSEQ']);
    const currSeqExpr = `NULLIF(TRY_CAST(${coalesce3Expr('ii', 'si', 'bi', currSeqIi, currSeqSi, currSeqBi, 'INT')} AS INT), 0)`;

    const cpfIi = pickCol(ii, ['CostPriceFC', 'StdCostFC', 'UnitCostFC', 'EvalPriceFC']);
    const cpfSi = pickCol(si, ['CostPriceFC', 'StdCostFC', 'UnitCostFC']);
    const cpfBi = pickCol(bi, ['CostPriceFC', 'StdCostFC', 'UnitCostFC']);
    const costPriceFcExpr = `TRY_CAST(${coalesce3Expr('ii', 'si', 'bi', cpfIi, cpfSi, cpfBi, 'decimal(18,6)')} AS decimal(18, 6))`;

    const cpwIi = pickCol(ii, ['CostPrice', 'StdCostPrice', 'UnitCost', 'EvalPrice']);
    const cpwSi = pickCol(si, ['CostPrice', 'StdCostPrice', 'UnitCost']);
    const cpwBi = pickCol(bi, ['CostPrice', 'StdCostPrice', 'UnitCost']);
    const costPriceWonExpr = `TRY_CAST(${coalesce3Expr('ii', 'si', 'bi', cpwIi, cpwSi, cpwBi, 'decimal(18,6)')} AS decimal(18, 6))`;

    const camIi = pickCol(ii, ['CostAmt', 'CostAmount', 'StdCostAmt']);
    const camSi = pickCol(si, ['CostAmt', 'CostAmount']);
    const camBi = pickCol(bi, ['CostAmt', 'CostAmount', 'BillCostAmt']);
    const costAmtWonExpr = `TRY_CAST(${coalesce3Expr('ii', 'si', 'bi', camIi, camSi, camBi, 'decimal(18,6)')} AS decimal(18, 6))`;

    const onIi = pickCol(ii, ['SOOrdNo', 'PUSONo', 'OrderNo', 'SOrderNo', 'RecvOrderNo']);
    const onSi = pickCol(si, ['SOOrdNo', 'PUSONo', 'OrderNo', 'SOrderNo']);
    const onBi = pickCol(bi, ['SOOrdNo', 'OrderNo', 'SOrderNo']);
    const orderNoExpr = `LTRIM(RTRIM(CAST(${coalesce3Expr('ii', 'si', 'bi', onIi, onSi, onBi, 'NVARCHAR(60)')} AS NVARCHAR(60))))`;

    const osIi = pickCol(ii, ['SOSerl', 'POSerl', 'OrderSerl', 'SOOrdSerl']);
    const osSi = pickCol(si, ['SOSerl', 'POSerl', 'OrderSerl']);
    const osBi = pickCol(bi, ['SOSerl', 'OrderSerl']);
    const orderSerlExpr = `LTRIM(RTRIM(CAST(${coalesce3Expr('ii', 'si', 'bi', osIi, osSi, osBi, 'NVARCHAR(40)')} AS NVARCHAR(40))))`;

    const inIi = pickCol(ii, ['ShipInstNo', 'DVInstNo', 'OutInstNo', 'InstNo', 'WorkInstNo']);
    const inSi = pickCol(si, ['ShipInstNo', 'DVInstNo', 'OutInstNo', 'InstNo']);
    const inBi = pickCol(bi, ['ShipInstNo', 'DVInstNo', 'OutInstNo', 'InstNo']);
    const instNoExpr = `LTRIM(RTRIM(CAST(${coalesce3Expr('ii', 'si', 'bi', inIi, inSi, inBi, 'NVARCHAR(60)')} AS NVARCHAR(60))))`;

    const isIi = pickCol(ii, ['ShipInstSerl', 'DVInstSerl', 'OutInstSerl', 'InstSerl']);
    const isSi = pickCol(si, ['ShipInstSerl', 'DVInstSerl', 'OutInstSerl', 'InstSerl']);
    const isBi = pickCol(bi, ['ShipInstSerl', 'DVInstSerl', 'OutInstSerl', 'InstSerl']);
    const instSerlExpr = `LTRIM(RTRIM(CAST(${coalesce3Expr('ii', 'si', 'bi', isIi, isSi, isBi, 'NVARCHAR(40)')} AS NVARCHAR(40))))`;

    const shIi = pickCol(ii, ['ShipNo', 'OutNo', 'DVNo', 'LGOutNo', 'ShipDocNo']);
    const shSi = pickCol(si, ['ShipNo', 'OutNo', 'DVNo', 'LGOutNo']);
    const shBi = pickCol(bi, ['ShipNo', 'OutNo', 'DVNo']);
    const shipNoExpr = `LTRIM(RTRIM(CAST(${coalesce3Expr('ii', 'si', 'bi', shIi, shSi, shBi, 'NVARCHAR(60)')} AS NVARCHAR(60))))`;

    const shsIi = pickCol(ii, ['ShipSerl', 'OutSerl', 'DVSerl', 'LGOutSerl']);
    const shsSi = pickCol(si, ['ShipSerl', 'OutSerl', 'DVSerl']);
    const shsBi = pickCol(bi, ['ShipSerl', 'OutSerl', 'DVSerl']);
    const shipSerlExpr = `LTRIM(RTRIM(CAST(${coalesce3Expr('ii', 'si', 'bi', shsIi, shsSi, shsBi, 'NVARCHAR(40)')} AS NVARCHAR(40))))`;

    const divIi = pickCol(ii, ['UMSalesKind', 'SMSalesKind', 'SMExpKind', 'DivisionKind', 'SalesKindName']);
    const divSi = pickCol(si, ['UMSalesKind', 'SMSalesKind', 'SMExpKind', 'DivisionKind']);
    const divBi = pickCol(bi, ['UMSalesKind', 'SMSalesKind', 'DivisionKind']);
    const divisionExpr = `LTRIM(RTRIM(CAST(${coalesce3Expr('ii', 'si', 'bi', divIi, divSi, divBi, 'NVARCHAR(200)')} AS NVARCHAR(200))))`;

    const skIi = pickCol(ii, ['SalesKindName', 'SaleKindName', 'UMSaleKind', 'InOutKindName']);
    const skSi = pickCol(si, ['SalesKindName', 'SaleKindName', 'UMSaleKind']);
    const skBi = pickCol(bi, ['SalesKindName', 'SaleKindName']);
    const salesKindExpr = `LTRIM(RTRIM(CAST(${coalesce3Expr('ii', 'si', 'bi', skIi, skSi, skBi, 'NVARCHAR(120)')} AS NVARCHAR(120))))`;

    const acIi = pickCol(ii, ['ItemAccountName', 'AcctKindName', 'UMAcctKind', 'MatAcctName']);
    const acSi = pickCol(si, ['ItemAccountName', 'AcctKindName', 'UMAcctKind']);
    const acBi = pickCol(bi, ['ItemAccountName', 'AcctKindName']);
    const itemAccountExpr = `LTRIM(RTRIM(CAST(${coalesce3Expr('ii', 'si', 'bi', acIi, acSi, acBi, 'NVARCHAR(120)')} AS NVARCHAR(120))))`;

    const sgIi = pickCol(ii, ['SalesGroupName', 'UMSalesGroup', 'TeamName']);
    const sgSi = pickCol(si, ['SalesGroupName', 'UMSalesGroup', 'TeamName']);
    const sgBi = pickCol(bi, ['SalesGroupName', 'UMSalesGroup']);
    const salesGroupExpr = `LTRIM(RTRIM(CAST(${coalesce3Expr('ii', 'si', 'bi', sgIi, sgSi, sgBi, 'NVARCHAR(120)')} AS NVARCHAR(120))))`;

    const unitIi = pickCol(ii, ['UnitSeq', 'UNITSEQ']);
    const unitJoinSql = unitIi
      ? `LEFT JOIN dbo.[_TDAUnit] u ON ii.CompanySeq = u.CompanySeq AND u.UnitSeq = COALESCE(NULLIF(ii.${bracketIdent(unitIi)}, 0), NULLIF(it.UnitSeq, 0))`
      : `LEFT JOIN dbo.[_TDAUnit] u ON ii.CompanySeq = u.CompanySeq AND u.UnitSeq = NULLIF(it.UnitSeq, 0)`;

    this.plan = {
      iiTable,
      siTable,
      biTable,
      siJoinOn,
      biJoinOn,
      companyCol,
      dateYmdExpr,
      invoiceNoExpr,
      custSeqExpr,
      itemSeqExpr,
      deptSeqExpr,
      empSeqExpr,
      bizUnitExpr,
      qtyExpr,
      unitPriceExpr,
      curAmtExpr,
      domAmtExpr,
      domVatExpr,
      exRateExpr,
      currSeqExpr,
      costPriceFcExpr,
      costPriceWonExpr,
      costAmtWonExpr,
      orderNoExpr,
      orderSerlExpr,
      instNoExpr,
      instSerlExpr,
      shipNoExpr,
      shipSerlExpr,
      divisionExpr,
      salesKindExpr,
      itemAccountExpr,
      salesGroupExpr,
      unitJoinSql,
    };

    this.logger.log(
      `TSL sales daily analysis: ii=${iiTable} si=${siTable}(${siJoinOn ? 'join' : 'no-join'}) bi=${biTable}(${biJoinOn ? 'join' : 'no-join'})`,
    );
    return this.plan;
  }

  async listByDateRange(
    fromIso: string,
    toIso: string,
    limit?: number,
  ): Promise<{ items: TslSalesDailyAnalysisRow[]; truncated: boolean }> {
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

    let companySeq = this.parseOptionalPositiveInt('ERP_TSL_SALES_ANALYSIS_COMPANY_SEQ', 'ERP_TSL_SALES_ANALYSIS_COMPANY_SEQ');
    if (companySeq == null) {
      companySeq = this.parseOptionalPositiveInt('ERP_TSL_INVOICE_COMPANY_SEQ', 'ERP_TSL_INVOICE_COMPANY_SEQ');
    }

    const pool = await this.getPool();
    const p = await this.resolvePlan(pool);

    const iiTbl = bracketIdent(p.iiTable);
    const siTbl = bracketIdent(p.siTable);
    const biTbl = bracketIdent(p.biTable);

    const siJoinSql = p.siJoinOn ? `LEFT JOIN dbo.${siTbl} si ON ${p.siJoinOn}` : `LEFT JOIN dbo.${siTbl} si ON 1 = 0`;
    const biJoinSql = p.biJoinOn ? `LEFT JOIN dbo.${biTbl} bi ON ${p.biJoinOn}` : `LEFT JOIN dbo.${biTbl} bi ON 1 = 0`;

    const custJoin =
      'LEFT JOIN dbo.[_TDACust] c ON ii.CompanySeq = c.CompanySeq AND c.CustSeq = ' + p.custSeqExpr;
    const itemJoin =
      'LEFT JOIN dbo.[_TDAItem] it ON ii.CompanySeq = it.CompanySeq AND it.ItemSeq = ' + p.itemSeqExpr;
    const deptJoin =
      'LEFT JOIN dbo.[_TDADept] dp ON ii.CompanySeq = dp.CompanySeq AND dp.DeptSeq = ' + p.deptSeqExpr;
    const empJoin =
      'LEFT JOIN dbo.[_TDAEmp] e ON ii.CompanySeq = e.CompanySeq AND e.EmpSeq = ' + p.empSeqExpr;
    const currJoin =
      'LEFT JOIN dbo.[_TDACurr] cr ON ii.CompanySeq = cr.CompanySeq AND cr.CurrSeq = ' + p.currSeqExpr;

    const sql = `
      SELECT TOP (@fetchCount)
        ${p.divisionExpr} AS DivisionKind,
        ${p.invoiceNoExpr} AS InvoiceCompanyNo,
        ${p.dateYmdExpr} AS InvoiceCompanyDateRaw,
        c.CustName AS CustomerName,
        ${p.bizUnitExpr} AS CustomerBizUnit,
        ${p.salesKindExpr} AS SalesKind,
        ${p.itemAccountExpr} AS ItemAccount,
        dp.DeptName AS DeptName,
        e.EmpName AS EmpName,
        it.ItemName AS ItemName,
        it.Spec AS Spec,
        u.UnitName AS UnitName,
        ${p.qtyExpr} AS Qty,
        ${p.unitPriceExpr} AS UnitPrice,
        ${p.curAmtExpr} AS SupplyAmtFc,
        LTRIM(RTRIM(CAST(cr.CurrNo AS NVARCHAR(20)))) AS CurrCode,
        CASE
          WHEN ${p.curAmtExpr} IS NOT NULL AND cr.CurrNo IS NOT NULL THEN
            CONCAT(FORMAT(TRY_CAST(${p.curAmtExpr} AS decimal(18,2)), 'N', 'ko-KR'), N' ', LTRIM(RTRIM(CAST(cr.CurrNo AS NVARCHAR(20)))))
          WHEN ${p.curAmtExpr} IS NOT NULL THEN FORMAT(TRY_CAST(${p.curAmtExpr} AS decimal(18,2)), 'N', 'ko-KR')
          ELSE NULL
        END AS SupplyAmountForeignText,
        ${p.exRateExpr} AS ExchangeRate,
        ${p.domAmtExpr} AS WonAmount,
        CAST(ISNULL(${p.domAmtExpr}, 0) + ISNULL(${p.domVatExpr}, 0) AS decimal(18, 4)) AS SalesAmount,
        ${p.domAmtExpr} AS SupplyAmount,
        ${p.domVatExpr} AS VatAmount,
        CAST(ISNULL(${p.domAmtExpr}, 0) + ISNULL(${p.domVatExpr}, 0) AS decimal(18, 4)) AS TotalAmount,
        ${p.costPriceFcExpr} AS CostUnitPriceFc,
        ${p.costPriceWonExpr} AS CostUnitPriceWon,
        ${p.costAmtWonExpr} AS CostAmountWon,
        it.ItemNo AS ItemCode,
        CAST(NULL AS NVARCHAR(200)) AS ItemClassName,
        CAST(NULL AS NVARCHAR(200)) AS ItemGroupName,
        ${p.salesGroupExpr} AS SalesGroupName,
        ${p.orderNoExpr} AS OrderNo,
        ${p.orderSerlExpr} AS OrderSerl,
        ${p.instNoExpr} AS InstructNo,
        ${p.instSerlExpr} AS InstructSerl,
        ${p.shipNoExpr} AS ShipNo,
        ${p.shipSerlExpr} AS ShipSerl
      FROM dbo.${iiTbl} ii
      ${siJoinSql}
      ${biJoinSql}
      ${itemJoin}
      ${p.unitJoinSql}
      ${custJoin}
      ${deptJoin}
      ${empJoin}
      ${currJoin}
      WHERE ${p.dateYmdExpr} >= @fromYmd AND ${p.dateYmdExpr} <= @toYmd
        ${companySeq != null ? `AND ii.${bracketIdent(p.companyCol)} = @companySeq` : ''}
      ORDER BY ${p.dateYmdExpr} ASC, ii.${bracketIdent(p.companyCol)} ASC
    `;

    const request = pool.request();
    request.input('fromYmd', mssql.Char(8), fromYmd);
    request.input('toYmd', mssql.Char(8), toYmd);
    request.input('fetchCount', mssql.Int, fetchCount);
    if (companySeq != null) request.input('companySeq', mssql.Int, companySeq);

    let result: mssql.IResult<SqlRow>;
    try {
      result = await request.query<SqlRow>(sql);
    } catch (err: unknown) {
      this.plan = null;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`TSL sales daily analysis query failed: ${msg}`);
      throw new BadRequestException(
        `일자별판매실적분석 조회에 실패했습니다. _TSLInvoiceItem·_TSLSalesItem·_TSLBillItem 조인 키·컬럼명을 확인하세요. (${msg.slice(0, 220)})`,
      );
    }

    const raw = result.recordset ?? [];
    const truncated = raw.length > maxRows;
    const slice = truncated ? raw.slice(0, maxRows) : raw;
    return { items: slice.map((r, i) => ({ ...mapRow(r), rowNo: i + 1 })), truncated };
  }
}
