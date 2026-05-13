import type { HealthCheckResponse } from '@samkwang/shared';

async function fetchBackendHealth(): Promise<HealthCheckResponse | null> {
  const url = `${process.env.BACKEND_INTERNAL_URL ?? 'http://backend:4000'}/api/health`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as HealthCheckResponse;
  } catch {
    return null;
  }
}

function StatusBadge({ state }: { state: 'ok' | 'degraded' | 'down' | 'unknown' }) {
  const styles: Record<string, string> = {
    ok: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    degraded: 'bg-amber-100 text-amber-700 ring-amber-200',
    down: 'bg-rose-100 text-rose-700 ring-rose-200',
    unknown: 'bg-slate-100 text-slate-600 ring-slate-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[state]}`}
    >
      {state.toUpperCase()}
    </span>
  );
}

export default async function HomePage() {
  const health = await fetchBackendHealth();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">SAMKWANG-PROS</h1>
        <p className="mt-1 text-sm text-slate-600">
          생산관리시스템 · NestJS + Next.js + PostgreSQL 모노레포 골격ㄹㄹㄹㄹㄹㅇㅇㅇ
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">백엔드 상태</h2>
          <StatusBadge state={health?.status ?? 'unknown'} />
        </div>

        {health ? (
          <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-sm">
            <dt className="text-slate-500">서비스</dt>
            <dd className="font-mono">{health.service}</dd>
            <dt className="text-slate-500">버전</dt>
            <dd className="font-mono">{health.version}</dd>
            <dt className="text-slate-500">DB</dt>
            <dd>
              <StatusBadge state={health.dependencies.database} />
            </dd>
            <dt className="text-slate-500">타임스탬프</dt>
            <dd className="font-mono">{health.timestamp}</dd>
          </dl>
        ) : (
          <p className="mt-4 text-sm text-rose-600">
            백엔드에 연결할 수 없습니다. <code className="font-mono">docker compose up</code> 으로
            backend 서비스가 기동되었는지 확인하세요.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
        <h3 className="font-semibold text-slate-700">다음 단계</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <code className="font-mono">backend/prisma/schema.prisma</code> 에 도메인 모델(WorkOrder, Equipment 등)을 추가합니다.
          </li>
          <li>
            <code className="font-mono">pnpm prisma:migrate</code> 으로 마이그레이션을 적용합니다.
          </li>
          <li>
            <code className="font-mono">backend/src</code>, <code className="font-mono">frontend/app</code> 에 비즈니스 로직과 화면을 추가합니다.
          </li>
        </ul>
      </section>
    </main>
  );
}
