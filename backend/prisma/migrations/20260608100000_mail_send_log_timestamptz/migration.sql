-- Mail 발송·슬롯 시각: TIMESTAMP(3)(naive) → TIMESTAMPTZ(3)
-- 기존 값은 운영 DB가 Asia/Seoul 기준으로 적재된 시각으로 간주하고 절대시각으로 변환합니다.
-- (naive를 UTC로 잘못 읽어 화면에 +9h 되던 문제 수정)

ALTER TABLE "MailMenuSendLog"
  ALTER COLUMN "sentAt" TYPE TIMESTAMPTZ(3) USING ("sentAt" AT TIME ZONE 'Asia/Seoul'),
  ALTER COLUMN "firstOpenedAt" TYPE TIMESTAMPTZ(3) USING ("firstOpenedAt" AT TIME ZONE 'Asia/Seoul');

ALTER TABLE "MailSendLog"
  ALTER COLUMN "sentAt" TYPE TIMESTAMPTZ(3) USING ("sentAt" AT TIME ZONE 'Asia/Seoul'),
  ALTER COLUMN "firstOpenedAt" TYPE TIMESTAMPTZ(3) USING ("firstOpenedAt" AT TIME ZONE 'Asia/Seoul');

ALTER TABLE "MailMenu"
  ALTER COLUMN "lastMenuSendSlotUtc" TYPE TIMESTAMPTZ(3) USING ("lastMenuSendSlotUtc" AT TIME ZONE 'Asia/Seoul');

ALTER TABLE "MailSendRule"
  ALTER COLUMN "lastRunSlotUtc" TYPE TIMESTAMPTZ(3) USING ("lastRunSlotUtc" AT TIME ZONE 'Asia/Seoul');
