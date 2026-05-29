import { CronExpressionParser } from 'cron-parser';
import { MailScheduleType } from '@prisma/client';

const SEOUL = 'Asia/Seoul';

const WD_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function seoulWeekdaySun0(d: Date): number {
  const w = new Intl.DateTimeFormat('en-US', { timeZone: SEOUL, weekday: 'short' }).format(d);
  return WD_SHORT.indexOf(w as (typeof WD_SHORT)[number]);
}

function seoulHHmm(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SEOUL,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

/** 두 시각이 Asia/Seoul 기준 동일 분인지 */
function sameSeoulMinute(a: Date, b: Date): boolean {
  return seoulHHmm(a) === seoulHHmm(b) && seoulYmd(a) === seoulYmd(b);
}

function seoulYmd(d: Date): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: SEOUL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const mo = parts.find((p) => p.type === 'month')?.value;
  const da = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${mo}-${da}`;
}

/** 현재 시각을 초·ms 0으로 맞춘 Date (로컬 Date 객체, “이번 분” 판별용) */
export function truncateToMinute(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), 0, 0);
}

/** UTC 기준 분 단위 슬롯 (중복 방지 저장용) */
export function utcMinuteSlot(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), 0, 0),
  );
}

/** cron-parser v5는 초 필드를 포함한 6필드 표현을 사용. 5필드면 앞에 `0 ` 부여 */
export function normalizeCronToSixFields(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length === 5) {
    return `0 ${parts.join(' ')}`;
  }
  return expr.trim();
}

export function shouldFireRule(
  scheduleType: MailScheduleType,
  cronExpression: string | null,
  dailyTime: string | null,
  dailyDaysMask: number,
  at: Date,
): boolean {
  const atMin = truncateToMinute(at);
  if (scheduleType === 'DAILY') {
    const t = (dailyTime ?? '').trim();
    if (!/^\d{1,2}:\d{2}$/.test(t)) {
      return false;
    }
    const [hh, mm] = t.split(':').map((x) => parseInt(x, 10));
    const normalized = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    if (seoulHHmm(atMin) !== normalized) {
      return false;
    }
    const wd = seoulWeekdaySun0(atMin);
    if (wd < 0) {
      return false;
    }
    const bit = 1 << wd;
    return (dailyDaysMask & bit) !== 0;
  }
  if (scheduleType === 'CRON') {
    const expr = (cronExpression ?? '').trim();
    if (!expr) {
      return false;
    }
    try {
      const probe = new Date(atMin.getTime() + 30_000);
      const expression = normalizeCronToSixFields(expr);
      const interval = CronExpressionParser.parse(expression, { tz: SEOUL, currentDate: probe });
      const prevDate = interval.prev().toDate();
      return sameSeoulMinute(prevDate, atMin);
    } catch {
      return false;
    }
  }
  return false;
}
