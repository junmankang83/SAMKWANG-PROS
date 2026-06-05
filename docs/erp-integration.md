# ERP(MSSQL) 연동

SAMKWANG-PROS 백엔드는 `ERP_MSSQL_*` 환경 변수로 ERP SQL Server에 접속합니다. (예: `.env.example` 참고)

## 거래명세서 품목 조회

- **화면**: **메일발송관리 → 메일발송메뉴현황**에서 메뉴명이 `거래명세서품목조회`(공백 무시)이거나 메뉴코드가 `menu_001` / `tsl_invoice_items` 인 항목 상세.
- **API**: `GET /api/erp/tsl-invoice-items?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  선택 쿼리: `limit` (1~10000, 기본 8000). 로그인 세션 필요.
- **데이터**: `dbo._TSLInvoice`·`dbo._TSLInvoiceItem` 조인. 표시용으로 `_TDACust`(거래처코드·명), `_TDAItem`, `_TDAUnit`(단위·관리단위), `_TDAWH`(출고·입고), `_TDADept`, `_TDAEmp`(담당자), `_TPJTProject`, `_TDACurr`(통화) 등 LEFT JOIN.
- **스키마 호환**: 첫 조회 시 `INFORMATION_SCHEMA`로 `_TSLInvoice` / `_TSLInvoiceItem`(및 `_TDACurr`) 컬럼을 읽어, `Remark`·`LineRemark`·`Memo`·`IsInspection`(라인 우선, 없으면 헤더)·`SMExpKind`·단가(`CustPrice`/`ItemPrice`/`Price`)·`CurrName`/`CurrNo` 등 **없는 컬럼은 SELECT/WHERE에서 제외**하고 NULL·항상 참 조건으로 대체합니다. 그래도 SQL이 실패하면 **400**과 함께 ERP 오류 메시지를 반환합니다.
- **응답 컬럼(엑셀 순)**: 순번(조회 결과 표시 순서 1부터), 사업장, 거래명세서번호(10자리 시 `YYMMDD-####` 형식), 거래명세서일자, 거래처코드, 거래처명, 출고창고·출고창고명, 담당자, 담당부서, 품번, 품명, 규격, 단위, 관리단위, 수량, 단가, 공급가액, 부가세, 합계금액, 외화단가(`CurAmt/Qty`), 외화금액(`CurAmt`), 환율, 통화, 비고, 프로젝트·프로젝트명, 검사구분(`IsInspection`), 입고창고(라인 `DVPlaceSeq`→`_TDAWH`, DB 정의가 다르면 조정), Lot No., 생산일자·유효일자(미연동 시 빈 값).
- **필터**: 헤더 `InvoiceDate`(nchar `YYYYMMDD`)가 `from`~`to`(포함)인 라인만 반환합니다. 기간은 최대 약 400일로 제한됩니다. `_TSLInvoice.SMExpKind`가 수출 구분 `8009004`와 일치하는 명세(및 그 품목 라인)는 **제외**합니다(`NULL`은 포함).
- **ERP와 동일 데이터**: `.env`의 `ERP_TSL_INVOICE_COMPANY_SEQ`(필요 시 `ERP_TSL_INVOICE_BIZ_UNIT`)로 법인·사업장을 ERP와 맞추세요. 단가는 `CustPrice` → `ItemPrice` → `Price` 우선입니다.
- **상한**: 기본 최대 8,000행; 초과 시 `truncated: true`와 함께 앞부분만 반환합니다.

## 수출 Invoice 품목 조회

- **화면**: **메일발송관리 → 메일발송메뉴현황**에서 메뉴명이 `수출Invoice품목조회`(공백 무시·영문 대소문자 무시)이거나 메뉴코드가 `tsl_export_invoice_items`·`menu_code_007` 인 항목 상세.
- **API**: `GET /api/erp/tsl-export-invoice-items?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  선택 쿼리: `limit` (1~10000, 기본 8000). 로그인 세션 필요.
- **데이터**: `dbo._TSLInvoice`·`dbo._TSLInvoiceItem`(국내 거래명세 조회와 동일 베이스). 거래처 `_TDACust`, 품목 `_TDAItem`, 단위 `_TDAUnit`, 프로젝트 `_TPJTProject`, 통화 `_TDACurr` 등 LEFT JOIN.
- **필터**: 헤더 `InvoiceDate`(nchar `YYYYMMDD`)가 `from`~`to`(포함)이고, **`SMExpKind`가 문자열 `8009004`와 일치**하는 명세(및 품목 라인)만 반환합니다. `SMExpKind` 컬럼이 없으면 결과는 비웁니다. 국내용 거래명세 API는 동일 코드를 **제외**합니다.
- **수출 부가 컬럼**: 선적·B/L·HS·중량·신고·면장·포장 등은 DB에 존재하는 컬럼명을 `INFORMATION_SCHEMA`로 후보 매칭해 SELECT 합니다. 실제 스키마에 없으면 `null`·빈 문자열에 가깝게 표시됩니다.
- **응답 컬럼(엑셀 그리드 순)**: 순번(조회 결과 표시 순서 1부터), 구분, Invoice No., Invoice일자, 거래처, 품목코드·품명·규격·단위, 수량·단가·금액·외화금액·비고, 수출구분(`SMExpKind` 표시), 선적일자·선적지·도착지, 인코텀즈·결제조건, 통화·환율, HS Code·원산지, Net/Gross Weight, Measurement, Carton No., 수출신고번호·일자, 면장번호·일자, L/C·B/L, 선명·항차, ETD·ETA, 운송수단, 포장방법·수량·단위, 프로젝트, 사업장.
- **ERP 범위**: 국내 거래명세와 동일하게 `ERP_TSL_INVOICE_COMPANY_SEQ`·`ERP_TSL_INVOICE_BIZ_UNIT`로 법인·사업장을 제한합니다.
- **상한**: 기본 최대 8,000행; 초과 시 `truncated: true`와 함께 앞부분만 반환합니다.

## 반품요청 품목 조회

- **화면**: **메일발송관리 → 메일발송메뉴현황**에서 메뉴명이 `반품요청품목조회`(공백 무시)이거나 메뉴코드가 `tsl_dv_req_items`·`menu_code_005` 인 항목 상세.
- **API**: `GET /api/erp/tsl-dv-req-items?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  선택 쿼리: `limit` (1~10000, 기본 8000). 로그인 세션 필요.
- **데이터**: `dbo._TSLDVReq` + `dbo._TSLDVReqItem`. 문서키·일자·라인순번·비고 등은 `INFORMATION_SCHEMA`로 감지합니다. 거래처 `_TDACust`, 품목 `_TDAItem`, 단위 `_TDAUnit`, 부서 `_TDADept`, 담당자 `_TDAEmp` 등은 해당 컬럼이 있을 때만 LEFT JOIN 합니다.
- **필터**: 헤더 `UMOutKind`가 `_TDAUMinorValue`에서 `MajorSeq = 8020`, `Serl = 2002`, `ValueText = '1'`(trim 비교)인 행의 `MinorSeq`와 일치하는 건만 포함합니다. 헤더의 감지된 요청일 컬럼(nchar `YYYYMMDD`)이 `from`~`to`(포함)인 라인만 반환합니다. 기간은 최대 약 400일로 제한됩니다.
- **응답 컬럼**: 순번(조회 결과 표시 순서 1부터), 사업장, 요청Seq, 요청번호, 요청일, UM출고구분, 거래처코드·명, 부서, 담당자, 라인순번(ERP 라인 순번), 품번·품명·규격·단위, 수량, 단가, 공급가액·부가세·합계(DomAmt+DomVAT 등 스키마 감지), 비고(라인 Remark/Memo).
- **ERP와 동일 범위**: `.env`의 `ERP_TSL_DV_REQ_COMPANY_SEQ`(필요 시 `ERP_TSL_DV_REQ_BIZ_UNIT`)로 법인·사업장을 맞추세요.
- **상한**: 기본 최대 8,000행; 초과 시 `truncated: true`와 함께 앞부분만 반환합니다.

## 구매입고/반품 품목 조회

- **화면**: **메일발송관리 → 메일발송메뉴현황** 아코디언에서 해당 메뉴(예: 메뉴관리에 등록한 `구매입고/반품품목조회`)를 선택하면 `/app/mail/sending-menu/view/{메뉴ID}` 로 열립니다. 메뉴명이 `구매입고/반품품목조회`(공백 무시)이거나 메뉴코드가 `pu_delv_in_items` 이면 ERP 구매입고 그리드가 표시됩니다.
- **API**: `GET /api/erp/pu-delv-in-items?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  선택 쿼리: `limit` (1~10000, 기본 8000). 로그인 세션 필요.
- **데이터**: `dbo._TPUDelvIn` + 라인 테이블(`dbo._TPUDelvInItem` 우선, 없으면 `dbo.TPUDelvInItem`). 입고일·문서키·순번·비고 등 컬럼명은 실행 시 `INFORMATION_SCHEMA`로 감지합니다. 발주 헤더 `[_TPUPurOrder]` / `[TPUPurOrder]`는 있을 때만 조인합니다.
- **응답 컬럼(엑셀 29열 순)**: 순번(조회 결과 표시 순서 1부터·`rowNo`), 사업장, 입고일, 입고번호, 거래처·거래처명, 입고구분, 창고·창고명, 품목코드·명, 규격, 단위, 관리단위, 수량, 단가(라인에 존재하는 단가 컬럼만 `COALESCE` — `CustPrice`·`Price`·`PurPrice` 등 후보, **`ItemPrice` 없음**에도 대응), 외화단가, 공급가액·부가세·합계·외화금액( `DomAmt`/`SupplyAmt` 등·`DomVAT`/`VAT` 등·`CurAmt` 등 스키마 감지), 프로젝트·발주·검사·비고·자산구분. (문서 라인 순번은 JSON의 `lineSerl`에 별도 포함.)
- **필터**: 헤더의 입고일 컬럼(감지된 `DelvInDate`·`InDate` 등, nchar `YYYYMMDD`)이 `from`~`to`(포함)인 라인만 반환합니다. 기간은 최대 약 400일로 제한됩니다.
- **ERP와 동일 범위**: `.env`의 `ERP_PU_DELV_IN_COMPANY_SEQ`(필요 시 `ERP_PU_DELV_IN_BIZ_UNIT`)로 법인·사업장을 맞추세요.
- **상한**: 기본 최대 8,000행; 초과 시 `truncated: true`와 함께 앞부분만 반환합니다. `Invalid column name` 오류 시 동일 파일에서 컬럼명을 ERP 실제 스키마에 맞게 수정하면 됩니다.

## 구매납품 품목 조회

- **화면**: **메일발송관리 → 메일발송메뉴현황**에서 메뉴명이 `구매납품품목조회`(공백 무시)이거나 메뉴코드가 `pu_delv_items`·`menu_code_004` 인 항목 상세.
- **API**: `GET /api/erp/pu-delv-items?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  선택 쿼리: `limit` (1~10000, 기본 8000). 로그인 세션 필요.
- **데이터**: `dbo._TPUDelv` + 라인 테이블(`dbo._TPUDelvItem` 우선, 없으면 `dbo.TPUDelvItem`). 납품일·문서키·순번·금액·납품처 등 컬럼명은 실행 시 `INFORMATION_SCHEMA`로 감지합니다. 거래처 `_TDACust`, 품목 `_TDAItem`, 단위 `_TDAUnit`, 창고 `_TDAWH`, 프로젝트 `_TPJTProject`, 담당자 `_TDAEmp`, 부서 `_TDADept`, 통화 `_TDACurr` 등은 존재할 때 LEFT JOIN 합니다.
- **응답 컬럼(엑셀「구매납품품목조회」50열·선택 열 제외 순)**: 순번(조회 결과 표시 순서 1부터·`rowNo`), 사업단위, 납품일·번호, 발주일·번호, 구매거래처·구매처번호, 납품구분, 입고진행상태, 납품부서·담당자, 검사구분, 품명·품번·규격·단위, 납품단가·수량, 부가세포함여부·율, 금액·부가세·금액계, 통화·환율, 원화 금액·부가세·금액계, 입고수량·입고금액·입고원화금액, 내외자구분, 창고, 제조사, 품목자산분류, 유효일자, 합격·불합격·불합격반품수량, 특이사항·비고, 원천·진행조회(예약), 원천관리번호·원천번호, 고객 Lot, 최종작업일시, 품목 대·중·소분류. 실제 값은 `_TPUDelv`·`_TPUDelvItem`·`_TDAItem` 등에 존재하는 컬럼만 채워지며, 나머지는 `null`입니다.
- **필터**: 헤더의 납품일 컬럼(감지된 `DelvDate`·`PUDelvDate` 등, nchar `YYYYMMDD`)이 `from`~`to`(포함)인 라인만 반환합니다. 기간은 최대 약 400일로 제한됩니다.
- **ERP와 동일 범위**: `.env`의 `ERP_PU_DELV_COMPANY_SEQ`(필요 시 `ERP_PU_DELV_BIZ_UNIT`)로 법인·사업장을 맞추세요(구매입고용 `ERP_PU_DELV_IN_*`와 별도).
- **상한**: 기본 최대 8,000행; 초과 시 `truncated: true`와 함께 앞부분만 반환합니다.

설비정보 동기 등 기타 ERP 뷰는 `backend/src/external/erp/erp-tools.service.ts` 등을 참고하세요.
