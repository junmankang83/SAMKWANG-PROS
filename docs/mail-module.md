# 메일 발송 모듈 (SAMKWANG-PROS)

## 개요

- **메일설정** (`MailSmtpProfile`): SMTP 프로필을 **여러 건** 등록(이름·호스트·포트·TLS·계정·암호화된 비밀번호·발신자·정렬 순서). 기존 단일 `MailSmtpSettings` 데이터는 마이그레이션 시 첫 프로필로 이관됩니다.
- **메일발송메뉴** (`MailMenu`): 종류별 기본 제목·본문·메뉴 기준 자동 발송 수신·요일·시각·선택적 `mailSmtpProfileId`, **`scheduleAutoSendEnabled`**(기본 `true`; `false`이면 저장된 시각이 와도 스케줄러가 이 메뉴를 건너뜀).
- **메일발송정보** (`MailSendRule`): 스케줄(DAILY 또는 CRON), 수신자(JSON 배열), 제목·본문, 선택적 `mailMenuId`, **필수** `mailSmtpProfileId`(어떤 SMTP로 보낼지). UI **「메일발송정보」** 화면은 규칙 편집이 아니라 **통합 발송 이력**(`GET /mail/send-logs`)을 표시합니다.
- **발송 이력**: `MailSendLog`(규칙 발송)·`MailMenuSendLog`(메뉴 자동·즉시 발송). 새 이력에는 발송 시점 수신자 **`toAddressesSnapshot`**(JSON 배열)이 저장됩니다.
- **제목 형식**: 실제 SMTP 발송 시 제목은 Asia/Seoul 기준 발신 달력일 + `_` + 확정된 제목 문자열입니다(예: `2025-06-01_일일보고`). SMTP 연결 테스트 메일은 제외됩니다.
- **HTML 본문 상단(EIS 형식)**: 발송 HTML에는 **좌측 SAMKWANG 로고**(빌드 산출물 `dist/mail/assets/samkwang-mail-logo.png`를 CID로 첨부, 파일 없으면 텍스트 대체), **가운데 메뉴명(또는 규칙 제목)·검은 밑줄**, **우측 EIS 브랜딩**(이미지 3과 동일 문구·색 구성의 테이블 마크업), 그 아래 **조회일(서울 `○년 ○월 ○일`)** 한 줄이 붙습니다. 가운데 제목은 메뉴가 있으면 `MailMenu.label`, 없으면 규칙 제목 등으로 채웁니다. 이후 기존 본문·표 HTML이 이어집니다.
- **열람(개봉) 추적**: 공개 API 베이스가 잡히면 발송 시 **텍스트 + HTML**(multipart)로 보내고, HTML 하단에 **1×1 픽셀**(`GET /api/mail/open?t=…`, **인증 없음**)을 넣습니다. 베이스 우선순위는 `MAIL_TRACKING_PUBLIC_URL` → `PUBLIC_APP_BASE` → `FRONTEND_PUBLIC_URL` → `BACKEND_PUBLIC_URL` → `CORS_ORIGIN` 첫 Origin에 `/api`입니다. 수신 클라이언트가 해당 URL을 요청하면 `firstOpenedAt`·`openCount`가 갱신됩니다. **수신 확인 팝업용 `Disposition-Notification-To` 헤더는 넣지 않습니다**(픽셀만 사용). 발송 이력 API의 열람 표기는 **확인** / **미확인**(픽셀 미포함·실패 건은 **—**). 이미지 차단·텍스트만 보기에서는 픽셀 기록이 되지 않을 수 있습니다.
- **본문 동적 현황(ERP 연동 메뉴)**: 아래에 해당하는 메뉴는 **스케줄·수동 발송** 모두, 발송 시점(스케줄러는 해당 **슬롯 시각 `slot`**, 즉시 발송은 **요청 시각**)을 기준으로 Asia/Seoul **달력일**을 시작일·종료일(`from`=`to`)로 ERP를 조회하고, 메뉴/규칙에 저장된 기본 본문 **아래**에 결과를 붙입니다.
  - **거래명세 품목**: 라벨「거래명세서품목조회」또는 코드 `menu_001`·`menu_code_001`·`tsl_invoice_items` → `GET` 거래명세 품목 API와 동일 데이터. 라벨·코드가 수출 Invoice 규칙에 해당하면 제외됩니다.
  - **수출 Invoice 품목**: 라벨「수출Invoice품목조회」또는(`수출`+`품목조회`+`invoice`/`인보이스`, 단 이름에 `반품`·**`외주납품품목조회`·`구매납품품목조회` 라벨 제외**) 또는 코드 `tsl_export_invoice_items`·`menu_code_007` → `GET /api/erp/tsl-export-invoice-items`와 동일. **내수용 코드로 잘못 등록돼 있어도** 위 라벨이면 수출 API를 씁니다. `SMExpKind` = `8009004`는 `_TSLInvoice`·`_TSLInvoiceItem` 중 존재하는 컬럼으로 판별(둘 다 있으면 헤더 또는 라인 일치). **외주납품 품목 분기가 수출 Invoice보다 앞서므로**, 라벨이 외주인데 `menu_code_007`이 붙어 있어도 외주 API가 우선합니다. **반품요청(`menu_code_005`)이 잘못 붙은 경우에도** 위 수출 Invoice 라벨이면 반품요청 API로 가지 않도록 **수출 Invoice 분기를 반품요청보다 먼저** 적용합니다.
  - **수출 반품 품목**: 라벨「수출반품품목조회」또는 코드 `tsl_export_return_invoice_items`·`menu_code_008` → `GET /api/erp/tsl-export-return-invoice-items`와 동일. **라벨에「외주입고」가 있으면 `menu_code_008`이 붙어 있어도 수출 반품으로 처리하지 않음**(외주입고/반품 품목조회 오등록 방지). 일자+음수 반품+**헤더 `SMExpKind` = `8009019`**+**`UMOutKind` ↔ MinorSeq**(8020·2002·ValueText `1`).
  - **반품요청 품목**: 라벨「반품요청품목조회」또는 코드 `tsl_dv_req_items`·`menu_code_005`(단, 라벨이 위 **수출 Invoice 품목** 규칙과 같으면 제외) → `GET /api/erp/tsl-dv-req-items`와 동일(`_TSLDVReq`·`_TSLDVReqItem`, `UMOutKind` ∈ `_TDAUMinorValue` 의 MinorSeq — `MajorSeq=8020`·`Serl=2002`·`ValueText` trim `'1'`).
  - **구매입고/반품 품목**: 라벨「구매입고/반품품목조회」또는 코드 `pu_delv_in_items`·`menu_code_003` → 구매입고 품목 API와 동일(29열, `_TPUDelvIn`). **외주입고/반품** 라벨·`osp_delv_in_items` 등은 제외.
  - **일자별판매실적분석**: 라벨에「일자별판매실적」또는「판매실적분석」포함 또는 코드 `tsl_sales_daily_analysis`·`menu_code_tsl_sales_daily`·`menu_code_012` → `GET /api/erp/tsl-sales-daily-analysis`와 동일. **라벨이 판매실적 성격이면 `menu_code_010` 등이 붙어 있어도 외주입고 API로 붙지 않습니다**(코드 오등록 방지).
  - **외주입고/반품 품목**: 라벨「외주입고/반품품목조회」또는(라벨이 위 **일자별판매실적** 규칙과 겹치지 않을 때) 코드 `osp_delv_in_items`·`menu_code_osp_delv_in`·`menu_code_010` → `GET /api/erp/osp-delv-in-items`와 동일(`_TPDOSPDelvIn`·`_TPDOSPDelvInItem` 우선). 메일·화면 분기는 **구매입고/반품보다 앞**에 두어 `menu_code_003` 오등록 시에도 외주 라벨이 우선합니다.
  - **구매납품 품목**: 라벨「구매납품품목조회」또는 코드 `pu_delv_items`·`menu_code_004` → `GET /api/erp/pu-delv-items`와 동일(엑셀 50열 순, `_TPUDelv`·`_TPUDelvItem`).
  - **외주납품 품목**: 라벨「외주납품품목조회」(단, 「구매납품품목조회」와 동시에 매칭되지 않도록 라벨을 구분) 또는 코드 `osp_delv_items`·`menu_code_osp_delv`·`menu_code_009` → `GET /api/erp/osp-delv-items`와 동일. DB는 **`_TPDOSPDelv`**(없으면 `TPDOSPDelv`)·**`_TPDOSPDelvItem`**(없으면 `TPDOSPDelvItem`) 우선.
  - **이동품목조회**: 라벨에 `이동품목`·`조회` 포함 또는 코드 `lg_inout_move_items`·`menu_code_011` → `GET /api/erp/lg-inout-move-items`와 동일(`_TLGInoutDaily`·`_TLGInoutDailyItem`, 헤더 **`InOutDate`** 기간, 헤더·라인 **`InOutType=80`**).
  - `text/plain`에는 탭 구분 텍스트(행 상한 2000, **숫자 열은 천 단위 쉼표**), `text/html`에는 **발송메뉴현황과 동일한 EIS 그리드 스타일**(`#E7E6E6` 헤더·검은 테두리·흰 배경, 품명/품목명 등은 왼쪽, 숫자는 우측·`tabular-nums`)의 `<table>`(인라인 스타일)입니다. 추적 URL이 없어도 HTML 파트는 표가 있으면 함께 전송됩니다. ERP 조회 실패 시에도 메일은 발송되며 본문에 오류 안내가 붙습니다. **그 외 메뉴**는 저장된 본문만 전송됩니다(추가 ERP 메뉴는 `MailMenuReportService`에 동일 패턴으로 연결).
  - **첨부(xlsx)**: 위 ERP 연동·그 외 메뉴를 포함해 **모든 발송 메일**에 조회·본문과 동일 내용의 **Excel(.xlsx)** 1개를 붙입니다. **파일명은 실제 SMTP 제목과 동일**(Windows 금지 문자는 `_` 등으로 치환, 비어 있으면 `mail-data.xlsx`). ERP 메뉴는 메일 본문 표와 **동일 열·동일 포맷**의 시트 1개입니다.

## API (인증 필요, `/api` 접두사)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/mail/smtp` | SMTP 프로필 목록(비밀번호 제외) |
| POST | `/mail/smtp` | 프로필 생성 |
| GET | `/mail/smtp/:id` | 프로필 단건 |
| PUT | `/mail/smtp/:id` | 프로필 수정 |
| DELETE | `/mail/smtp/:id` | 프로필 삭제(마지막 1건·규칙 참조 중이면 불가) |
| POST | `/mail/smtp/:id/test` | 해당 프로필로 테스트 메일 `{ "toAddresses": ["a@x.com","b@x.com"] }` (최대 50건) |
| CRUD | `/mail/rules` | 발송 규칙(`mailSmtpProfileId` 포함) |
| GET | `/mail/rules/:id/logs` | 규칙별 로그 |
| GET | `/mail/send-logs?take=100` | 메뉴·규칙 발송 이력 통합(최근 `take`건, 최대 500), 발송 시각·구분·SMTP·수신자 스냅샷·성공/실패·열람(픽셀) 상태 |
| GET | `/mail/open?t=…` | **공개**(세션 불필요) 추적 GIF 응답 + 해당 토큰 로그의 열람 시각 기록 |
| CRUD | `/mail/menus` | 발송 메뉴(템플릿) |
| POST | `/mail/menus/:id/send-now` | 메뉴 기본 제목·본문으로 즉시 발송 `{ "toAddresses": [...], "mailSmtpProfileId?": "...", "sendDaysMask?": 127, "sendTimes?": ["09:00"] }` — 성공/실패는 `MailMenuSendLog` |

## 스케줄·타임존

- **발송 시각·열람 시각·중복 방지 슬롯**(`MailMenuSendLog.sentAt`, `MailSendLog.sentAt`, `firstOpenedAt`, `lastMenuSendSlotUtc`, `lastRunSlotUtc`)은 DB에 **`TIMESTAMPTZ`(절대 시각)** 로 저장됩니다. API의 `sentAt`은 ISO 8601(UTC 오프셋/Z), 목록 표시용 `sentAtDisplay`는 **Asia/Seoul** 기준 문자열입니다. 예전 `TIMESTAMP`(naive)만 쓰던 경우 Node가 naive를 UTC로 해석해 **화면에 약 +9시간** 어긋날 수 있어 `20260608100000_mail_send_log_timestamptz` 마이그레이션으로 보정합니다.
- **DAILY**: `dailyTime`은 `HH:mm`, 요일은 `dailyDaysMask` 비트(일=bit0 … 토=bit6). **Asia/Seoul** 기준으로 매분 평가합니다.
- **CRON**: [cron-parser](https://github.com/harrisiirak/cron-parser) v5 형식. **6필드**(초 분 시 일 월 요일)를 사용하며, **5필드** 입력 시 앞에 `0`(초)을 붙입니다.

## 스케줄러

- Nest `@nestjs/schedule`: 매분 `0 * * * * *`에 활성 규칙·메뉴 기준 자동 발송을 평가합니다.
- **규칙 발송**: 해당 규칙의 `mailSmtpProfileId`로 SMTP를 조회합니다.
- **메뉴 자동 발송**: `MailMenu.scheduleAutoSendEnabled`이 `true`일 때만 스케줄러가 해당 메뉴를 평가합니다(발송관리 화면에서 「해제」/「자동설정」으로 전환). SMTP는 `mailSmtpProfileId`가 있으면 해당 SMTP로, 없으면 같은 메뉴를 참조하는 활성 규칙 중 최근 수정분의 프로필을 사용하고, 그것도 없으면 등록된 첫 SMTP 프로필을 사용합니다.
- 동일 **UTC 분 슬롯**에 대해 `lastRunSlotUtc` / `lastMenuSendSlotUtc`로 중복 발송을 방지합니다.

## 암호화

- 환경 변수 `MAIL_ENCRYPTION_KEY`(임의 긴 문자열 권장). 비어 있으면 개발용 기본 문자열이 사용됩니다.
- SMTP 비밀번호는 **AES-256-GCM** 후 `passwordCipher`에 저장합니다.

## 운영 참고

- 프로덕션에서는 `MAIL_ENCRYPTION_KEY`를 반드시 설정하고, SMTP 자격 증명을 `.env`에 두지 말고 UI로만 저장하는 것을 권장합니다.
- 마이그레이션 `20260608100000_mail_send_log_timestamptz`는 발송·열람·슬롯 시각 컬럼을 **`TIMESTAMPTZ`** 로 바꿉니다. 적용 전 백엔드를 종료한 뒤 `pnpm exec prisma migrate deploy` 및 `pnpm exec prisma generate`(Windows에서 DLL 잠금 시 동일)을 실행하세요.
- 마이그레이션 `20260607130000_mail_log_columns_idempotent`는 `toAddressesSnapshot`·열람 추적 컬럼이 누락된 DB를 `IF NOT EXISTS`로 보강합니다(메일발송정보·이력 저장 500 방지). 적용 후 `pnpm exec prisma generate`로 클라이언트를 갱신하세요(Windows에서 DLL 잠금 시 백엔드 프로세스 종료 후 실행).
