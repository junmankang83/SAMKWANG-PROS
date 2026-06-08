# ERP 조회 샘플·검증용 파일

## 외주납품품목조회 엑셀

1. ERP에서 보낸 `외주납품품목조회_*.xlsx`를 이 폴더에 복사하거나, UTF-8 **CSV**로 저장합니다. (민감·개인정보가 없을 때만 커밋하세요.)
2. 동일 기간으로 **외주납품** API 응답을 저장합니다. (`TPDOSPDelv` 계열 — 구매납품 `pu-delv-items`와 다릅니다.)

   ```bash
   curl -sS -b "세션쿠키" "http://localhost:4000/api/erp/osp-delv-items?from=2026-06-01&to=2026-06-08&schemaMeta=true" -o osp-delv-api.json
   ```

3. 비교 스크립트(구매납품용 스크립트명이 남아 있으면, 외주용으로 복제·열 매핑을 맞춥니다):

   ```bash
   node scripts/compare-pu-delv-to-csv.mjs pu-delv-api.json docs/samples/외주납품.csv
   ```

## 구매납품품목조회 엑셀(참고)

구매납품(`_TPUDelv`)과 비교할 때는 다음 URL을 사용합니다.

```bash
curl -sS -b "세션쿠키" "http://localhost:4000/api/erp/pu-delv-items?from=2026-06-01&to=2026-06-08&schemaMeta=true" -o pu-delv-api.json
```

## 브라우저에서 호출 URL 확인

메일발송메뉴현황에서 해당 메뉴를 연 뒤 **개발자 도구 → Network**에서 조회 요청이 다음 중 무엇인지 확인합니다.

- **외주납품**: `.../api/erp/osp-delv-items?from=...`
- **구매납품**: `.../api/erp/pu-delv-items?from=...`
- 수출 Invoice와 동일하면: `.../api/erp/tsl-export-invoice-items?...` (메뉴 `code`가 `menu_code_007` 등으로 잘못 등록됐을 수 있음 → `scripts/sql/mail-menu-pu-export-audit.sql` 참고)

## SMExpKind 스키마(구매납품 pu-delv-items)

`schemaMeta=true`를 붙이면 응답에 `schemaMeta.smExpKindOnHeader` / `smExpKindOnLine` / `smExpKindFilterApplied`가 포함됩니다. 둘 다 `false`이면 ERP `_TPUDelv`(또는 라인 테이블)에 `SMExpKind` 컬럼이 없어 **8009004 제외 WHERE가 적용되지 않습니다.**

자세한 절차는 [docs/erp-pu-delv-verification.md](../erp-pu-delv-verification.md)를 참고하세요.
