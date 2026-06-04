# ERP(MSSQL) 연동

SAMKWANG-PROS 백엔드는 `ERP_MSSQL_*` 환경 변수로 ERP SQL Server에 접속합니다. (예: `.env.example` 참고)

## 거래명세서 품목 조회

- **화면**: **메일발송관리 → 메일발송메뉴현황**에서 메뉴명이 `거래명세서품목조회`(공백 무시)이거나 메뉴코드가 `menu_001` / `tsl_invoice_items` 인 항목 상세.
- **API**: `GET /api/erp/tsl-invoice-items?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  선택 쿼리: `limit` (1~10000, 기본 8000). 로그인 세션 필요.
- **데이터**: `dbo._TSLInvoice`·`dbo._TSLInvoiceItem` 조인. 표시용으로 `_TDACust`(거래처코드·명), `_TDAItem`, `_TDAUnit`(단위·관리단위), `_TDAWH`(출고·입고), `_TDADept`, `_TDAEmp`(담당자), `_TPJTProject`, `_TDACurr`(통화) 등 LEFT JOIN.
- **응답 컬럼(엑셀 순)**: 순번, 사업장, 거래명세서번호(10자리 시 `YYMMDD-####` 형식), 거래명세서일자, 거래처코드, 거래처명, 출고창고·출고창고명, 담당자, 담당부서, 품번, 품명, 규격, 단위, 관리단위, 수량, 단가, 공급가액, 부가세, 합계금액, 외화단가(`CurAmt/Qty`), 외화금액(`CurAmt`), 환율, 통화, 비고, 프로젝트·프로젝트명, 검사구분(`IsInspection`), 입고창고(라인 `DVPlaceSeq`→`_TDAWH`, DB 정의가 다르면 조정), Lot No., 생산일자·유효일자(미연동 시 빈 값).
- **필터**: 헤더 `InvoiceDate`(nchar `YYYYMMDD`)가 `from`~`to`(포함)인 라인만 반환합니다. 기간은 최대 약 400일로 제한됩니다. `_TSLInvoice.SMExpKind`가 수출 구분 `8009004`와 일치하는 명세(및 그 품목 라인)는 **제외**합니다(`NULL`은 포함).
- **ERP와 동일 데이터**: `.env`의 `ERP_TSL_INVOICE_COMPANY_SEQ`(필요 시 `ERP_TSL_INVOICE_BIZ_UNIT`)로 법인·사업장을 ERP와 맞추세요. 단가는 `CustPrice` → `ItemPrice` → `Price` 우선입니다.
- **상한**: 기본 최대 8,000행; 초과 시 `truncated: true`와 함께 앞부분만 반환합니다.

## 구매입고/반품 품목 조회

- **화면**: **메일발송관리 → 메일발송메뉴현황** 아코디언에서 해당 메뉴(예: 메뉴관리에 등록한 `구매입고/반품품목조회`)를 선택하면 `/app/mail/sending-menu/view/{메뉴ID}` 로 열립니다. 메뉴명이 `구매입고/반품품목조회`(공백 무시)이거나 메뉴코드가 `pu_delv_in_items` 이면 ERP 구매입고 그리드가 표시됩니다.
- **API**: `GET /api/erp/pu-delv-in-items?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  선택 쿼리: `limit` (1~10000, 기본 8000). 로그인 세션 필요.
- **데이터**: `dbo._TPUDelvIn` + 라인 테이블(`dbo._TPUDelvInItem` 우선, 없으면 `dbo.TPUDelvInItem`). 입고일·문서키·순번·비고 등 컬럼명은 실행 시 `INFORMATION_SCHEMA`로 감지합니다. 발주 헤더 `[_TPUPurOrder]` / `[TPUPurOrder]`는 있을 때만 조인합니다.
- **응답 컬럼(엑셀 29열 순)**: 사업장, 입고일, 입고번호, 순번, 거래처·거래처명, 입고구분, 창고·창고명, 품목코드·명, 규격, 단위, 관리단위, 수량, 단가(라인에 존재하는 단가 컬럼만 `COALESCE` — `CustPrice`·`Price`·`PurPrice` 등 후보, **`ItemPrice` 없음**에도 대응), 외화단가, 공급가액·부가세·합계·외화금액( `DomAmt`/`SupplyAmt` 등·`DomVAT`/`VAT` 등·`CurAmt` 등 스키마 감지), 프로젝트·발주·검사·비고·자산구분.
- **필터**: 헤더의 입고일 컬럼(감지된 `DelvInDate`·`InDate` 등, nchar `YYYYMMDD`)이 `from`~`to`(포함)인 라인만 반환합니다. 기간은 최대 약 400일로 제한됩니다.
- **ERP와 동일 범위**: `.env`의 `ERP_PU_DELV_IN_COMPANY_SEQ`(필요 시 `ERP_PU_DELV_IN_BIZ_UNIT`)로 법인·사업장을 맞추세요.
- **상한**: 기본 최대 8,000행; 초과 시 `truncated: true`와 함께 앞부분만 반환합니다. `Invalid column name` 오류 시 동일 파일에서 컬럼명을 ERP 실제 스키마에 맞게 수정하면 됩니다.

설비정보 동기 등 기타 ERP 뷰는 `backend/src/external/erp/erp-tools.service.ts` 등을 참고하세요.
