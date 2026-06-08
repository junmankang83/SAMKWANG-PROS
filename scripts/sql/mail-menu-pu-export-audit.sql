-- PostgreSQL (SAMKWANG-PROS MailMenu) — 외주/구매 납품 품목 라벨인데 수출 Invoice 코드가 붙은 행 점검
-- 잘못된 경우 UI·메일 본문이 수출 Invoice API(tsl-export-invoice-items)로 붙습니다.
-- 실행: psql $DATABASE_URL -f scripts/sql/mail-menu-pu-export-audit.sql

-- 1) 문제 후보: 라벨은 납품 품목, 코드는 수출 Invoice
SELECT id, code, label, "sortOrder"
FROM "MailMenu"
WHERE regexp_replace(trim(label), '\s+', '', 'g') IN ('외주납품품목조회', '구매납품품목조회')
  AND lower(trim(code)) IN ('tsl_export_invoice_items', 'menu_code_007');

-- 2) 기대 조합: 동일 라벨 + pu_delv_items / menu_code_004
SELECT id, code, label, "sortOrder"
FROM "MailMenu"
WHERE regexp_replace(trim(label), '\s+', '', 'g') IN ('외주납품품목조회', '구매납품품목조회')
  AND lower(trim(code)) IN ('pu_delv_items', 'menu_code_004');
