import type { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MailSendLogStatus, Prisma, type PrismaClient } from '@prisma/client';

/** $transaction(tx) 또는 Prisma 루트 — 로그 create 만 사용 */
type LogCreateClient = {
  mailMenuSendLog: { create: (args: { data: Prisma.MailMenuSendLogUncheckedCreateInput }) => Promise<unknown> };
  mailSendLog: { create: (args: { data: Prisma.MailSendLogUncheckedCreateInput }) => Promise<unknown> };
};

type RawCapable = Pick<PrismaClient, '$executeRawUnsafe'>;

function getRawUnsafe(tx: LogCreateClient): RawCapable['$executeRawUnsafe'] | null {
  const fn = (tx as Partial<RawCapable>).$executeRawUnsafe;
  return typeof fn === 'function' ? fn.bind(tx) : null;
}

/** Prisma create 가 깨진 환경(클라이언트·DB 불일치 등)에서도 최소 컬럼만으로 INSERT */
async function insertMailMenuSendLogRaw(
  execUnsafe: RawCapable['$executeRawUnsafe'],
  row: {
    mailMenuId: string;
    status: MailSendLogStatus;
    errorMessage: string | null;
    smtpMessageId: string | null;
    toSnapshotJson: Prisma.InputJsonValue | null;
    openTrackingToken: string | null;
  },
  logger: Logger,
  menuId: string,
): Promise<void> {
  const id = randomUUID();
  await execUnsafe(
    `INSERT INTO "MailMenuSendLog" ("id", "mailMenuId", "sentAt", "status", "errorMessage", "smtpMessageId") VALUES ($1::text, $2::text, NOW(), $3::"MailSendLogStatus", $4::text, $5::text)`,
    id,
    row.mailMenuId,
    row.status,
    row.errorMessage,
    row.smtpMessageId,
  );
  logger.warn(`MailMenuSendLog: Prisma create 실패 후 Raw SQL로 기본 행 저장(menu=${menuId}, id=${id})`);

  if (row.toSnapshotJson != null) {
    try {
      const jsonStr = JSON.stringify(row.toSnapshotJson);
      await execUnsafe(
        `UPDATE "MailMenuSendLog" SET "toAddressesSnapshot" = $1::jsonb WHERE "id" = $2::text`,
        jsonStr,
        id,
      );
    } catch (e) {
      logger.warn(
        `MailMenuSendLog Raw: toAddressesSnapshot 갱신 생략 (${e instanceof Error ? e.message : String(e)})`,
      );
    }
  }
  if (row.openTrackingToken) {
    try {
      await execUnsafe(
        `UPDATE "MailMenuSendLog" SET "openTrackingToken" = $1::varchar(64) WHERE "id" = $2::text`,
        row.openTrackingToken,
        id,
      );
    } catch (e) {
      logger.warn(
        `MailMenuSendLog Raw: openTrackingToken 갱신 생략 (${e instanceof Error ? e.message : String(e)})`,
      );
    }
  }
}

async function insertMailSendLogRaw(
  execUnsafe: RawCapable['$executeRawUnsafe'],
  row: {
    ruleId: string;
    status: MailSendLogStatus;
    errorMessage: string | null;
    smtpMessageId: string | null;
    toSnapshotJson: Prisma.InputJsonValue | null;
    openTrackingToken: string | null;
  },
  logger: Logger,
  ruleId: string,
): Promise<void> {
  const id = randomUUID();
  await execUnsafe(
    `INSERT INTO "MailSendLog" ("id", "ruleId", "sentAt", "status", "errorMessage", "smtpMessageId") VALUES ($1::text, $2::text, NOW(), $3::"MailSendLogStatus", $4::text, $5::text)`,
    id,
    row.ruleId,
    row.status,
    row.errorMessage,
    row.smtpMessageId,
  );
  logger.warn(`MailSendLog: Prisma create 실패 후 Raw SQL로 기본 행 저장(rule=${ruleId}, id=${id})`);

  if (row.toSnapshotJson != null) {
    try {
      const jsonStr = JSON.stringify(row.toSnapshotJson);
      await execUnsafe(
        `UPDATE "MailSendLog" SET "toAddressesSnapshot" = $1::jsonb WHERE "id" = $2::text`,
        jsonStr,
        id,
      );
    } catch (e) {
      logger.warn(`MailSendLog Raw: toAddressesSnapshot 갱신 생략 (${e instanceof Error ? e.message : String(e)})`);
    }
  }
  if (row.openTrackingToken) {
    try {
      await execUnsafe(
        `UPDATE "MailSendLog" SET "openTrackingToken" = $1::varchar(64) WHERE "id" = $2::text`,
        row.openTrackingToken,
        id,
      );
    } catch (e) {
      logger.warn(`MailSendLog Raw: openTrackingToken 갱신 생략 (${e instanceof Error ? e.message : String(e)})`);
    }
  }
}

async function runMenuAttempts(
  tx: LogCreateClient,
  attempts: Prisma.MailMenuSendLogUncheckedCreateInput[],
  logger: Logger,
  menuId: string,
): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts.length; i++) {
    const data = attempts[i]!;
    try {
      await tx.mailMenuSendLog.create({ data });
      if (i > 0) {
        logger.warn(`MailMenuSendLog: 축약 컬럼으로 저장(menu=${menuId}, 단계=${i + 1}/${attempts.length})`);
      }
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/** DB에 스냅샷·추적 컬럼이 없을 때 단계적으로 INSERT 재시도, 전부 실패 시 Raw SQL 폴백 */
export async function createMailMenuSendLogWithColumnFallback(
  tx: LogCreateClient,
  logger: Logger,
  row: {
    mailMenuId: string;
    status: MailSendLogStatus;
    errorMessage: string | null;
    smtpMessageId: string | null;
    toSnapshotJson: Prisma.InputJsonValue | null;
    openTrackingToken: string | null;
  },
): Promise<void> {
  const minimal: Prisma.MailMenuSendLogUncheckedCreateInput = {
    mailMenuId: row.mailMenuId,
    status: row.status,
    errorMessage: row.errorMessage,
    smtpMessageId: row.smtpMessageId,
  };
  const attempts: Prisma.MailMenuSendLogUncheckedCreateInput[] = [];
  if (row.toSnapshotJson != null) {
    const withSnap: Prisma.MailMenuSendLogUncheckedCreateInput = {
      ...minimal,
      toAddressesSnapshot: row.toSnapshotJson,
    };
    if (row.openTrackingToken) {
      attempts.push({ ...withSnap, openTrackingToken: row.openTrackingToken });
    }
    attempts.push(withSnap);
  } else if (row.openTrackingToken) {
    attempts.push({ ...minimal, openTrackingToken: row.openTrackingToken });
  }
  attempts.push(minimal);
  try {
    await runMenuAttempts(tx, attempts, logger, row.mailMenuId);
  } catch (prismaErr) {
    const execUnsafe = getRawUnsafe(tx);
    if (!execUnsafe) {
      throw prismaErr;
    }
    try {
      await insertMailMenuSendLogRaw(execUnsafe, row, logger, row.mailMenuId);
    } catch (rawErr) {
      const p = prismaErr instanceof Error ? prismaErr.message : String(prismaErr);
      const r = rawErr instanceof Error ? rawErr.message : String(rawErr);
      logger.error(`MailMenuSendLog: Prisma·Raw 모두 실패(menu=${row.mailMenuId}). prisma=${p}; raw=${r}`);
      throw rawErr;
    }
  }
}

async function runRuleAttempts(
  tx: LogCreateClient,
  attempts: Prisma.MailSendLogUncheckedCreateInput[],
  logger: Logger,
  ruleId: string,
): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts.length; i++) {
    const data = attempts[i]!;
    try {
      await tx.mailSendLog.create({ data });
      if (i > 0) {
        logger.warn(`MailSendLog: 축약 컬럼으로 저장(rule=${ruleId}, 단계=${i + 1}/${attempts.length})`);
      }
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export async function createMailSendLogWithColumnFallback(
  tx: LogCreateClient,
  logger: Logger,
  row: {
    ruleId: string;
    status: MailSendLogStatus;
    errorMessage: string | null;
    smtpMessageId: string | null;
    toSnapshotJson: Prisma.InputJsonValue | null;
    openTrackingToken: string | null;
  },
): Promise<void> {
  const minimal: Prisma.MailSendLogUncheckedCreateInput = {
    ruleId: row.ruleId,
    status: row.status,
    errorMessage: row.errorMessage,
    smtpMessageId: row.smtpMessageId,
  };
  const attempts: Prisma.MailSendLogUncheckedCreateInput[] = [];
  if (row.toSnapshotJson != null) {
    const withSnap: Prisma.MailSendLogUncheckedCreateInput = {
      ...minimal,
      toAddressesSnapshot: row.toSnapshotJson,
    };
    if (row.openTrackingToken) {
      attempts.push({ ...withSnap, openTrackingToken: row.openTrackingToken });
    }
    attempts.push(withSnap);
  } else if (row.openTrackingToken) {
    attempts.push({ ...minimal, openTrackingToken: row.openTrackingToken });
  }
  attempts.push(minimal);
  try {
    await runRuleAttempts(tx, attempts, logger, row.ruleId);
  } catch (prismaErr) {
    const execUnsafe = getRawUnsafe(tx);
    if (!execUnsafe) {
      throw prismaErr;
    }
    try {
      await insertMailSendLogRaw(execUnsafe, row, logger, row.ruleId);
    } catch (rawErr) {
      const p = prismaErr instanceof Error ? prismaErr.message : String(prismaErr);
      const r = rawErr instanceof Error ? rawErr.message : String(rawErr);
      logger.error(`MailSendLog: Prisma·Raw 모두 실패(rule=${row.ruleId}). prisma=${p}; raw=${r}`);
      throw rawErr;
    }
  }
}
