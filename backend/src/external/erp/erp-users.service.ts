import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ErpUserRow } from '@samkwang/shared';
import * as mssql from 'mssql';

type ErpRow = {
  UserId: string;
  UserSeq: number;
  UserName: string;
  Empid: string;
  EmpSeq: number;
  DeptName: string | null;
};

function mapRow(row: ErpRow): ErpUserRow {
  return {
    userId: row.UserId?.trim() ?? '',
    userSeq: row.UserSeq,
    userName: row.UserName?.trim() ?? '',
    empid: row.Empid?.trim() ?? '',
    empSeq: row.EmpSeq,
    deptName: row.DeptName?.trim() || null,
  };
}

@Injectable()
export class ErpUsersService {
  private readonly logger = new Logger(ErpUsersService.name);
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

  async listUsers(q?: string): Promise<ErpUserRow[]> {
    const pool = await this.getPool();
    const term = q?.trim();
    const request = pool.request();
    if (term) {
      request.input('q', mssql.NVarChar, `%${term}%`);
    }

    const whereClause = term
      ? `WHERE u.UserId LIKE @q OR u.UserName LIKE @q OR u.Empid LIKE @q OR e.DeptName LIKE @q`
      : '';

    const result = await request.query<ErpRow>(`
      SELECT u.UserId, u.UserSeq, u.UserName, u.Empid, u.EmpSeq, e.DeptName
      FROM KN_View_TCAUser u
      LEFT JOIN KN_View_TDAEmp e ON u.EmpSeq = e.EmpSeq
      ${whereClause}
      ORDER BY u.UserId
    `);

    return (result.recordset ?? []).map(mapRow);
  }
}
