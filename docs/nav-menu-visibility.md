# 상단 메뉴 표시 설정 (`AppConfigEntry`)

`메뉴관리`(기준정보) 화면에서 기준정보·부품관리·설비관리·메일발송관리 탭 표시 여부를 저장합니다.

## DB 반영

Prisma 모델 `AppConfigEntry`가 추가되었습니다. 마이그레이션 권한이 없으면 다음 중 하나를 사용하세요.

```bash
cd backend
npx prisma db push
```

또는 PostgreSQL에서 직접:

```sql
CREATE TABLE "AppConfigEntry" (
  "key" VARCHAR(120) NOT NULL,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppConfigEntry_pkey" PRIMARY KEY ("key")
);
```

그 후:

```bash
npx prisma generate
```

## API

- `GET /api/app/nav-domains-visibility` — `{ "domains": { "master-data": true, "production": true, "mold": true, "mail": true } }`
- `PUT /api/app/nav-domains-visibility` — 본문 `{ "domains": { ... } }` (최소 하나는 `true`)
