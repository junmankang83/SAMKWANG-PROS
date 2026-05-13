# SAMKWANG-PROS

생산관리시스템(Production Management System) 모노레포.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Backend | NestJS 11 (Node.js 22, TypeScript 5.7) + Prisma 6 |
| Frontend | Next.js 15 (App Router) + React 19 + Tailwind CSS 3 |
| Database | PostgreSQL 16 (alpine) |
| 패키지 매니저 | pnpm 10 (workspaces) |
| 컨테이너 | Docker / Docker Compose |

## 디렉토리 구조

```
SAMKWANG-PROS/
├── backend/             # NestJS (Prisma + PostgreSQL)
├── frontend/            # Next.js 15 (App Router, Tailwind)
├── packages/shared/     # 백/프론트 공유 TypeScript 타입
├── db/init/             # PostgreSQL 최초 기동 시 실행 SQL
├── docker/
│   ├── backend/Dockerfile
│   └── frontend/Dockerfile
├── docs/                # 설계·기획·보고서 문서
├── scripts/             # 운영·배포 스크립트
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

## 빠른 시작 (Docker 만으로)

이 머신에 Node가 설치되어 있지 않아도, **Docker만 있으면 즉시 기동** 가능합니다.

```bash
cp .env.example .env             # (필요 시 비밀값 수정)
docker compose up --build        # 처음 빌드는 5~10분 소요될 수 있음
```

기동 후 접속:

| 서비스 | URL |
|--------|-----|
| Frontend (Next.js) | http://localhost:3000 |
| Backend (NestJS) | http://localhost:4000/api/health |
| PostgreSQL | localhost:5432 (계정은 `.env` 참고) |

종료:

```bash
docker compose down              # 컨테이너 중지·제거 (볼륨 유지)
docker compose down -v           # 볼륨까지 제거 (데이터 초기화)
```

## 로컬 개발 (Node + pnpm 직접 사용)

Node 22 / pnpm 10 을 호스트에 설치한 경우:

```bash
pnpm install
pnpm build:shared                # 공유 타입 한 번 빌드 (이후 watch 가능)

# 별도 터미널에서
pnpm dev:backend                 # http://localhost:4000
pnpm dev:frontend                # http://localhost:3000
```

DB만 Docker 로 띄우고 백/프론트는 호스트에서 실행하려면:

```bash
docker compose up -d db
DATABASE_URL=postgresql://samkwang:samkwang_dev@localhost:5432/samkwang_pros?schema=public \
  pnpm dev:backend
```

## Prisma 마이그레이션

스키마 변경 흐름:

1. `backend/prisma/schema.prisma` 편집
2. 마이그레이션 생성·적용:

   ```bash
   pnpm prisma:migrate          # docker compose 내부에서 prisma migrate dev 실행
   ```

3. 운영 환경에는 `prisma migrate deploy` 가 컨테이너 시작 시 자동 적용됩니다.

## 주요 스크립트

| 명령 | 설명 |
|------|------|
| `pnpm compose:up` | `docker compose up --build` 별칭 |
| `pnpm compose:down` | 컨테이너 중지·제거 |
| `pnpm compose:logs` | 로그 팔로우 |
| `pnpm prisma:studio` | Prisma Studio (5555 포트) 기동 |
| `pnpm build` | shared → backend → frontend 순으로 전체 빌드 |
| `pnpm dev:backend` | NestJS watch 모드 |
| `pnpm dev:frontend` | Next.js dev 서버 |

## 환경 변수

`.env.example` 을 `.env` 로 복사한 뒤 운영 값으로 교체합니다. 주요 변수:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `BACKEND_PORT`, `APP_WEB_PORT` (nginx 게이트웨이), `POSTGRES_PORT`, `PUBLIC_APP_BASE`
- `CORS_ORIGIN` (다중 origin 은 콤마 구분)

`DATABASE_URL` 은 `docker-compose.yml` 에서 위 값을 사용해 자동 조립됩니다.

## 다음 단계

- 도메인 모델 정의 (예: `User`, `WorkOrder`, `Equipment`, `Material`, `ProductionRecord`)
- 인증/인가 (`@nestjs/jwt`, `next-auth` 등)
- shadcn/ui 도입으로 UI 컴포넌트 표준화
- 관측성(OpenTelemetry, Loki/Grafana) 추가
- CI/CD 파이프라인 (GitHub Actions → 레지스트리)
