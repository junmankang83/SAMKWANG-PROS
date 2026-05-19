import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mssql from 'mssql';

export interface ErpToolRecord {
  toolSeq: number;
  toolName: string;
  toolNo: string;
  spec: string | null;
  smStatus: number | null;
  smStatusNm: string | null;
  umToolKind: number | null;
  umToolKindName: string | null;
  assetSeq: number | null;
  asstName: string | null;
  asstNo: string | null;
  deptSeq: number | null;
  deptName: string | null;
  empSeq: number | null;
  empName: string | null;
  empid: string | null;
  lastUserName: string | null;
  lastDateTime: string | null;
}

type ErpRow = {
  ToolName: string;
  ToolNo: string;
  Spec: string | null;
  ToolSeq: number;
  SMStatusNm: string | null;
  SMStatus: number | null;
  UMToolKindName: string | null;
  UMToolKind: number | null;
  AsstName: string | null;
  AsstNo: string | null;
  AssetSeq: number | null;
  EmpName: string | null;
  EmpSeq: number | null;
  DeptName: string | null;
  DeptSeq: number | null;
  LastUserName: string | null;
  Empid: string | null;
  LastDateTime: Date | null;
};

function toIsoOrNull(d: Date | null | undefined): string | null {
  if (!d) {
    return null;
  }
  const t = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(t.getTime())) {
    return null;
  }
  return t.toISOString();
}

function mapRow(row: ErpRow): ErpToolRecord {
  return {
    toolSeq: row.ToolSeq,
    toolName: row.ToolName?.trim() ?? '',
    toolNo: row.ToolNo?.trim() ?? '',
    spec: row.Spec?.trim() || null,
    smStatus: row.SMStatus ?? null,
    smStatusNm: row.SMStatusNm?.trim() || null,
    umToolKind: row.UMToolKind ?? null,
    umToolKindName: row.UMToolKindName?.trim() || null,
    assetSeq: row.AssetSeq ?? null,
    asstName: row.AsstName?.trim() || null,
    asstNo: row.AsstNo?.trim() || null,
    deptSeq: row.DeptSeq ?? null,
    deptName: row.DeptName?.trim() || null,
    empSeq: row.EmpSeq ?? null,
    empName: row.EmpName?.trim() || null,
    empid: row.Empid?.trim() || null,
    lastUserName: row.LastUserName?.trim() || null,
    lastDateTime: toIsoOrNull(row.LastDateTime),
  };
}

@Injectable()
export class ErpToolsService {
  private readonly logger = new Logger(ErpToolsService.name);
  private pool: mssql.ConnectionPool | null = null;
  private poolPromise: Promise<mssql.ConnectionPool> | null = null;

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
      this.logger.error('ERP MSSQL connection failed', err);
      throw new ServiceUnavailableException(
        'ERP 데이터베이스에 연결할 수 없습니다. 네트워크 및 접속 정보를 확인하세요.',
      );
    });

    return this.poolPromise;
  }

  async listTools(q?: string): Promise<ErpToolRecord[]> {
    const pool = await this.getPool();
    const term = q?.trim();
    const request = pool.request();
    if (term) {
      request.input('q', mssql.NVarChar, `%${term}%`);
    }

    const whereClause = term
      ? `WHERE ToolName LIKE @q OR ToolNo LIKE @q OR AsstName LIKE @q`
      : '';

    const result = await request.query<ErpRow>(`
      SELECT ToolName, ToolNo, Spec, ToolSeq, SMStatusNm, SMStatus,
             UMToolKindName, UMToolKind, AsstName, AsstNo, AssetSeq,
             EmpName, EmpSeq, DeptName, DeptSeq, LastUserName, Empid, LastDateTime
      FROM KN_View_TPDTool
      ${whereClause}
      ORDER BY ToolSeq
    `);

    return (result.recordset ?? []).map(mapRow);
  }
}
