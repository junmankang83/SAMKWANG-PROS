# 구매납품품목조회(pu-delv-items) 검증 가이드

## 1. 브라우저 Network (메뉴 라우팅)

1. 메일발송메뉴현황에서 **구매납품품목조회** 메뉴를 연다. (**외주납품품목조회**는 별도 API `GET /api/erp/osp-delv-items` — 메뉴 라벨·코드가 `osp_delv_items` 등으로 등록되어 있어야 한다.)
2. **개발자 도구 → Network**에서 조회 버튼 후 나타나는 XHR/fetch URL을 확인한다.
3. **기대(구매납품)**: `GET /api/erp/pu-delv-items?from=YYYY-MM-DD&to=YYYY-MM-DD`
4. **기대(외주납품)**: `GET /api/erp/osp-delv-items?from=YYYY-MM-DD&to=YYYY-MM-DD`
5. 만약 `GET /api/erp/tsl-export-invoice-items?...`이면, 예전에는 DB `MailMenu.code`가 `menu_code_007`로 잘못 붙은 경우에 외주 라벨도 수출 화면으로 갔을 수 있습니다. **현재는 외주 라벨이 우선**이며, 수출 매처가 외주·구매납품 라벨을 제외합니다. 그래도 수출 URL이면 `code`·라벨을 `mail-menu-pu-export-audit.sql`로 점검하세요.

**코드 변경(2026-06)**: 메일발송메뉴현황·메일 본문에서 **외주납품(`isOspDelvItemsMailMenu`)을 수출 Invoice(`menu_code_007`)보다 먼저** 평가합니다. 라벨이 `외주납품품목조회`인데 DB `code`가 `menu_code_007`로 잘못돼 있어도 외주 API(`osp-delv-items`)가 호출됩니다. 수출 Invoice 매처는 동일 라벨을 명시적으로 제외합니다.

**반품요청품목조회(2026-06)**: DB에 `code`가 `menu_code_004`/`pu_delv_items`로 잘못 들어가 있어도, 라벨이 `반품요청품목조회`이면 `isPuDelvItemsMailMenu`는 **false**이고 `isTslDvReqItemsMailMenu`가 먼저 매칭되어 `GET /api/erp/tsl-dv-req-items`가 호출된다. 메일 본문 조립(`mail-menu-report.service`)도 동일하게 반품요청 분기를 구매납품보다 앞에 둔다.

## 2. PostgreSQL MailMenu 점검

[scripts/sql/mail-menu-pu-export-audit.sql](../scripts/sql/mail-menu-pu-export-audit.sql)를 실행해, 라벨과 코드 불일치 행이 없는지 본다.

## 3. ERP `SMExpKind` 컬럼 유무

동일 세션으로 조회:

```http
GET /api/erp/pu-delv-items?from=2026-06-01&to=2026-06-08&schemaMeta=true
```

응답의 `schemaMeta`:

| 필드 | 의미 |
|------|------|
| `smExpKindOnHeader` | `dbo._TPUDelv`에 `SMExpKind` 컬럼 존재 |
| `smExpKindOnLine` | 품목 라인 테이블에 `SMExpKind` 존재 |
| `smExpKindFilterApplied` | 위 둘 중 하나라도 true면 `8009004` 제외 WHERE 적용 |

`smExpKindFilterApplied`가 **false**이면, 현재 백엔드는 수출 코드 필터를 SQL에 넣지 못한다. SSMS에서 `INFORMATION_SCHEMA.COLUMNS`로 실제 컬럼명을 확인한 뒤, 필요 시 백엔드 `pickColumn` 후보를 ERP 스키마에 맞게 확장한다.

## 4. 엑셀과 행 집합 비교

[docs/samples/README.md](samples/README.md) 절차에 따라 CSV와 API JSON을 맞춘 뒤 `scripts/compare-pu-delv-to-csv.mjs`로 키(납품번호+품번) diff를 본다.

## 5. 백엔드 로그

첫 `pu-delv-items` 조회 시 로그에 다음 형태가 한 번 찍힌다.

`PU Delv schema: ... SMExpKind h=true|false i=true|false`

`h`/`i`가 모두 false면 위 `schemaMeta`와 동일하게 필터 미적용 상태다.
