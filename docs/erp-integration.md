# ERP(MSSQL) 연동

SAMKWANG-PROS 백엔드는 `ERP_MSSQL_*` 환경 변수로 ERP SQL Server에 접속합니다. (예: `.env.example` 참고)

## 거래명세서 품목 조회

- **화면**: **메일발송관리 → 메일발송메뉴현황**에서 메뉴명이 `거래명세서품목조회`(공백 무시)이거나 메뉴코드가 `menu_001` / `tsl_invoice_items` 인 항목 상세.
- **API**: `GET /api/erp/tsl-invoice-items?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  선택 쿼리: `limit` (1~10000, 기본 8000). 로그인 세션 필요.
- **데이터**: `dbo._TSLInvoice`·`dbo._TSLInvoiceItem` 조인. 표시용으로 `_TDACust`(거래처코드·명), `_TDAItem`, `_TDAUnit`(단위·관리단위), `_TDAWH`(출고·입고), `_TDADept`, `_TDAEmp`(담당자), `_TPJTProject`, `_TDACurr`(통화) 등 LEFT JOIN.
- **스키마 호환**: 첫 조회 시 `INFORMATION_SCHEMA`로 `_TSLInvoice` / `_TSLInvoiceItem`(및 `_TDACurr`) 컬럼을 읽어, `Remark`·`LineRemark`·`Memo`·`IsInspection`(라인 우선, 없으면 헤더)·`SMExpKind`·단가(`CustPrice`/`ItemPrice`/`Price`)·`CurrName`/`CurrNo` 등 **없는 컬럼은 SELECT/WHERE에서 제외**하고 NULL·항상 참 조건으로 대체합니다. 그래도 SQL이 실패하면 **400**과 함께 ERP 오류 메시지를 반환합니다.
- **응답 컬럼(엑셀 순)**: 순번(조회 결과 표시 순서 1부터), 사업장, 거래명세서번호(10자리 시 `YYMMDD-####` 형식), 거래명세서일자, 거래처코드, 거래처명, 출고창고·출고창고명, 담당자, 담당부서, 품번, 품명, 규격, 단위, 관리단위, 수량, 단가, 공급가액, 부가세, 합계금액, 외화단가(`CurAmt/Qty`), 외화금액(`CurAmt`), 환율, 통화, 비고, 프로젝트·프로젝트명, 검사구분(`IsInspection`), 입고창고(라인 `DVPlaceSeq`→`_TDAWH`, DB 정의가 다르면 조정), Lot No., 생산일자·유효일자(미연동 시 빈 값).
- **필터**: 헤더 `InvoiceDate`(nchar `YYYYMMDD`)가 `from`~`to`(포함)인 라인만 반환합니다. 기간은 최대 약 400일로 제한됩니다. **`SMExpKind`가 수출 구분 `8009004`와 일치하면 해당 라인은 제외**합니다. 컬럼이 `_TSLInvoice`에만 있으면 헤더 값만, `_TSLInvoiceItem`에만 있으면 라인 값만, **둘 다 있으면** 헤더·라인 중 **어느 한쪽이라도** `8009004`이면 그 라인은 제외합니다(`NULL`은 내수로 간주해 포함).
- **ERP와 동일 데이터**: `.env`의 `ERP_TSL_INVOICE_COMPANY_SEQ`(필요 시 `ERP_TSL_INVOICE_BIZ_UNIT`)로 법인·사업장을 ERP와 맞추세요. 단가는 `CustPrice` → `ItemPrice` → `Price` 우선입니다.
- **상한**: 기본 최대 8,000행; 초과 시 `truncated: true`와 함께 앞부분만 반환합니다.

## 수출 Invoice 품목 조회

- **화면**: **메일발송관리 → 메일발송메뉴현황**에서 메뉴명이 `수출Invoice품목조회`(공백 무시·영문 대소문자 무시)이거나 메뉴코드가 `tsl_export_invoice_items`·`menu_code_007` 인 항목 상세. 라벨에 `수출`·`품목조회`와(`invoice` 또는 `인보이스`)가 함께 있으면 동일 화면으로 연결합니다(이름에 `반품`이 들어가면 수출 반품 메뉴로 분리). **내수용 코드(`menu_code_001` 등)로 잘못 등록돼 있어도** 위 라벨 규칙이면 수출 Invoice API를 호출합니다.
- **API**: `GET /api/erp/tsl-export-invoice-items?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  선택 쿼리: `limit` (1~10000, 기본 8000). 로그인 세션 필요.
- **데이터**: `dbo._TSLInvoice`·`dbo._TSLInvoiceItem`(국내 거래명세 조회와 동일 베이스). 거래처 `_TDACust`, 품목 `_TDAItem`, 단위 `_TDAUnit`, 프로젝트 `_TPJTProject`, 통화 `_TDACurr` 등 LEFT JOIN.
- **필터**: 헤더 `InvoiceDate`(nchar `YYYYMMDD`)가 `from`~`to`(포함)이고, **`SMExpKind`가 문자열 `8009004`와 일치**(공백·빈 문자열 제거 후 비교)하는 품목 라인만 반환합니다. `_TSLInvoice`·`_TSLInvoiceItem` 중 컬럼이 있는 쪽으로 판별하고, **둘 다 있으면 헤더 또는 라인 중 하나라도** `8009004`이면 포함합니다. 둘 다 없으면 결과는 비웁니다. 국내 거래명세 API는 동일 코드를 헤더·라인 기준으로 **라인 단위 제외**합니다.
- **수출 부가 컬럼**: 선적·B/L·HS·중량·신고·면장·포장 등은 DB에 존재하는 컬럼명을 `INFORMATION_SCHEMA`로 후보 매칭해 SELECT 합니다. 실제 스키마에 없으면 `null`·빈 문자열에 가깝게 표시됩니다.
- **응답 컬럼(엑셀 그리드 순)**: 순번(조회 결과 표시 순서 1부터), 구분, Invoice No., Invoice일자, 거래처, 품목코드·품명·규격·단위, 수량·단가·금액·외화금액·비고, 수출구분(`SMExpKind` 표시), 선적일자·선적지·도착지, 인코텀즈·결제조건, 통화·환율, HS Code·원산지, Net/Gross Weight, Measurement, Carton No., 수출신고번호·일자, 면장번호·일자, L/C·B/L, 선명·항차, ETD·ETA, 운송수단, 포장방법·수량·단위, 프로젝트, 사업장.
- **ERP 범위**: 국내 거래명세와 동일하게 `ERP_TSL_INVOICE_COMPANY_SEQ`·`ERP_TSL_INVOICE_BIZ_UNIT`로 법인·사업장을 제한합니다.
- **상한**: 기본 최대 8,000행; 초과 시 `truncated: true`와 함께 앞부분만 반환합니다.

## 수출 반품 품목 조회

- **화면**: **메일발송관리 → 메일발송메뉴현황**에서 메뉴명이 `수출반품품목조회`(공백 무시)이거나 메뉴코드가 `tsl_export_return_invoice_items`·`menu_code_008` 인 항목 상세.
- **API**: `GET /api/erp/tsl-export-return-invoice-items?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  선택 쿼리: `limit` (1~10000, 기본 8000). 로그인 세션 필요.
- **데이터**: `dbo._TSLInvoice`·`dbo._TSLInvoiceItem`. **반품 라인**: `Qty` 및 `DomAmt`·`CurAmt` 등 스키마에 있는 금액·세액 컬럼 후보 중 **하나라도 음수**. **`SMExpKind`**: **`_TSLInvoice` 헤더** `8009019` (문자·BIGINT 비교, `@exportReturnSmExpKind`). **`UMOutKind`**: `_TDAUMinorValue`의 **`MinorSeq`**와 매칭, `MajorSeq = 8020`, `Serl = 2002`, `ValueText` trim = `'1'`. `ERP_TSL_EXPORT_RETURN_SKIP_UM_OUT_KIND_FILTER` / `ERP_TSL_EXPORT_RETURN_SKIP_SM_EXP_KIND_FILTER`가 `true`이면 각각 해당 조건만 생략.
- **조인**: 거래처·품목·단위·통화는 수출 Invoice와 동일. `INFORMATION_SCHEMA`에 `dbo._TDABizUnit`이 있으면 사업장명 조인, `_TDAWH`는 `DVPlaceSeq` 우선·`WHSeq` 보조로 창고명, `_TDAEmp`는 헤더 `EmpSeq`가 있을 때 담당자명.
- **응답 컬럼**: 순번, 상태, 사업장, Invoice No., Invoice일자, 거래처코드, 거래처명, 품목코드·품명·규격·단위, 화폐·환율·단가·수량·외화금액·원화금액·부가세·합계금액, 창고, 담당자, Lot No., 수출신고번호, 비고, 수출구분(`SMExpKind`).
- **ERP 범위**: `ERP_TSL_INVOICE_COMPANY_SEQ`·`ERP_TSL_INVOICE_BIZ_UNIT` (수출 Invoice 품목과 동일).
- **상한**: 기본 최대 8,000행; 초과 시 `truncated: true`.

## 반품요청 품목 조회

- **화면**: **메일발송관리 → 메일발송메뉴현황**에서 메뉴명이 `반품요청품목조회`(공백 무시)이거나 메뉴코드가 `tsl_dv_req_items`·`menu_code_005` 인 항목 상세.
- **API**: `GET /api/erp/tsl-dv-req-items?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  선택 쿼리: `limit` (1~10000, 기본 8000). 로그인 세션 필요.
- **데이터**: `dbo._TSLDVReq` + `dbo._TSLDVReqItem`. 문서키·일자·라인순번·비고 등은 `INFORMATION_SCHEMA`로 감지합니다. 거래처 `_TDACust`, 품목 `_TDAItem`, 단위 `_TDAUnit`, 부서 `_TDADept`, 담당자 `_TDAEmp` 등은 해당 컬럼이 있을 때만 LEFT JOIN 합니다.
- **필터**: 헤더 `UMOutKind`가 `_TDAUMinorValue`에서 `MajorSeq = 8020`, `Serl = 2002`, `ValueText` trim 후 `'1'`인 행의 **`MinorSeq` 집합**과 `IN`(문자·숫자 혼용 대비 `CAST` 비교)으로 일치하는 건만 포함합니다. `_TDAUMinorValue`에 `CompanySeq`가 있으면 `(m.CompanySeq = h.CompanySeq OR m.CompanySeq IS NULL)`로 한정합니다. 헤더의 감지된 요청일 컬럼(nchar `YYYYMMDD`)이 `from`~`to`(포함)인 라인만 반환합니다. 기간은 최대 약 400일로 제한됩니다.
- **응답 컬럼**: 순번, 사업장·요청Seq(보조), 요청번호·요청일, UM출고코드·**출고구분명**(`_TDAUMinorValue` 연계), 거래처코드·명, 부서·담당자, 라인순번, 품번·품명·규격·단위, 수량·단가, 공급가액·부가세·합계, 비고, **창고·프로젝트·납기일·진행상태**(스키마에 해당 컬럼·조인이 있을 때만). 비고는 라인 `Remark`/`Memo` 등.
- **ERP와 동일 범위**: `.env`의 `ERP_TSL_DV_REQ_COMPANY_SEQ`(필요 시 `ERP_TSL_DV_REQ_BIZ_UNIT`)로 법인·사업장을 맞추세요.
- **상한**: 기본 최대 8,000행; 초과 시 `truncated: true`와 함께 앞부분만 반환합니다.

## 구매입고/반품 품목 조회

- **화면**: **메일발송관리 → 메일발송메뉴현황** 아코디언에서 해당 메뉴(예: 메뉴관리에 등록한 `구매입고/반품품목조회`)를 선택하면 `/app/mail/sending-menu/view/{메뉴ID}` 로 열립니다. 메뉴명이 `구매입고/반품품목조회`(공백 무시)이거나 메뉴코드가 `pu_delv_in_items` 이면 ERP 구매입고 그리드가 표시됩니다. **「외주입고/반품품목조회」**는 동일 문서의 **「외주입고/반품 품목 조회」** 절을 참고하세요.
- **API**: `GET /api/erp/pu-delv-in-items?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  선택 쿼리: `limit` (1~10000, 기본 8000). 로그인 세션 필요.
- **데이터**: `dbo._TPUDelvIn` + 라인 테이블(`dbo._TPUDelvInItem` 우선, 없으면 `dbo.TPUDelvInItem`). 입고일·문서키·순번·비고 등 컬럼명은 실행 시 `INFORMATION_SCHEMA`로 감지합니다. 발주 헤더 `[_TPUPurOrder]` / `[TPUPurOrder]`는 있을 때만 조인합니다.
- **응답 컬럼(엑셀 29열 순)**: 순번(조회 결과 표시 순서 1부터·`rowNo`), 사업장, 입고일, 입고번호, 거래처·거래처명, 입고구분, 창고·창고명, 품목코드·명, 규격, 단위, 관리단위, 수량, 단가(라인에 존재하는 단가 컬럼만 `COALESCE` — `CustPrice`·`Price`·`PurPrice` 등 후보, **`ItemPrice` 없음**에도 대응), 외화단가, 공급가액·부가세·합계·외화금액( `DomAmt`/`SupplyAmt` 등·`DomVAT`/`VAT` 등·`CurAmt` 등 스키마 감지), 프로젝트·발주·검사·비고·자산구분. (문서 라인 순번은 JSON의 `lineSerl`에 별도 포함.)
- **필터**: 헤더의 입고일 컬럼(감지된 `DelvInDate`·`InDate` 등, nchar `YYYYMMDD`)이 `from`~`to`(포함)인 라인만 반환합니다. 기간은 최대 약 400일로 제한됩니다.
- **ERP와 동일 범위**: `.env`의 `ERP_PU_DELV_IN_COMPANY_SEQ`(필요 시 `ERP_PU_DELV_IN_BIZ_UNIT`)로 법인·사업장을 맞추세요.
- **상한**: 기본 최대 8,000행; 초과 시 `truncated: true`와 함께 앞부분만 반환합니다. `Invalid column name` 오류 시 동일 파일에서 컬럼명을 ERP 실제 스키마에 맞게 수정하면 됩니다.

## 외주입고/반품 품목 조회

- **화면**: **메일발송관리 → 메일발송메뉴현황**에서 메뉴명이 `외주입고/반품품목조회`(공백 무시, `구매입고/반품품목조회`와 구분)이거나 메뉴코드가 `osp_delv_in_items`·`menu_code_osp_delv_in`·`menu_code_010` 인 항목 상세.
- **API**: `GET /api/erp/osp-delv-in-items?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  선택 쿼리: `limit` (1~10000, 기본 8000). 로그인 세션 필요.
- **데이터**: `dbo._TPDOSPDelvIn`(없으면 `dbo.TPDOSPDelvIn`) + 라인(`dbo._TPDOSPDelvInItem` 우선, 없으면 `dbo.TPDOSPDelvInItem`). 입고일·입고번호·문서키 등은 `INFORMATION_SCHEMA`로 감지합니다. 발주는 `_TPOSPPurOrder`/`TPOSPPurOrder` 우선, 없으면 `_TPUPurOrder`/`TPUPurOrder` 조인.
- **납품반품구분·작업지시번호**: 헤더·라인의 입고구분 컬럼(`OSPSMInKind` 등)을 `_TDAUMinorValue`와 매칭할 때 **`MinorSeq`만으로는 행이 특정되지 않는 DB**가 있어, 필요하면 `.env`에 **`ERP_OSP_DELV_IN_KIND_UMINOR_MAJOR`**·**`ERP_OSP_DELV_IN_KIND_UMINOR_SERL`**을 둘 다 넣어 소분류 그룹을 한정합니다. 소분류 조인이 비어도 코드 `0`/`1`/`2` 등은 **「납품」「반품」**으로 보이게 매핑합니다. 작업지시 표시는 라인의 `OSPWOSeq` 등 시퀀스로 **`_TPPWorkOrd`** 등 마스터 테이블을 자동 조인해 번호 문자열을 가져오고, 없으면 기존처럼 라인·헤더의 문자열·숫자 후보를 `COALESCE`합니다.
- **응답 컬럼**: 엑셀「외주입고_반품품목조회」에 맞춘 **JSON**(`rowNo`, 외주입고번호·일, 외주거래처, 입고부서·담당자, 납품반품구분, 작업지시번호, ERP품명·품번·규격, 수량·단가·금액·부가세·부가세포함·합계, 입고창고, 특이사항·비고, Lot, 차수, PO, 자재투입·원자재단가, 품목 대·중·소분류, 최종작성일시·작성자, 전표번호 등). 구매입고와 겹치는 필드(`bizUnit`, `spec`, `projectCode` 등)는 호환용으로 유지되며, 메일 본문 표는 기존 구매입고 29열 포맷을 그대로 사용합니다.
- **필터**: 헤더 입고일 컬럼을 **YYYYMMDD 8자**로 정규화한 뒤 `from`~`to`(포함)로 비교합니다(`datetime`·문자·숫자 저장 형태 혼용 대응). 기간은 최대 약 400일로 제한됩니다.
- **ERP 범위**: `.env`의 `ERP_OSP_DELV_IN_COMPANY_SEQ`·`ERP_OSP_DELV_IN_BIZ_UNIT`(비우면 `ERP_PU_DELV_IN_*`로 폴백).

## 이동품목조회 (일별수불 이동)

- **화면**: **부품관리 → 이동품목조회** (`/app/production/lg-inout-move-items`) 또는 **메일발송메뉴현황**에서 메뉴명에 `이동품목`·`조회`가 포함되거나 메뉴코드 `lg_inout_move_items`·`menu_code_011`.
- **API**: `GET /api/erp/lg-inout-move-items?from=YYYY-MM-DD&to=YYYY-MM-DD` (선택 `limit`). 로그인 세션 필요.
- **데이터**: `dbo._TLGInoutDaily`·`dbo._TLGInoutDailyItem`(없으면 `TLG*` 동명) 조인. **기간**은 헤더 **`InOutDate`만** YYYYMMDD로 정규화해 적용합니다. **`InOutType = 80`**: 헤더·라인에 컬럼이 **모두 있으면 둘 다 80**, 한쪽만 있으면 그쪽만 80입니다(`TRY_CONVERT(int, …)`). 조인 키는 양쪽 공통 `…Seq` 우선. `_TDAItem`·`_TDAUnit`·`_TDAWH`·`_TDADept`(처리·출고부서)·`_TDAEmp`·`_TDACust`(판매처·참조거래처)·`_TDAUMinorValue`(입고납품반품 등)는 스키마에 있을 때만 조인합니다.
- **응답 컬럼(28열 + `rowNo`)**: 출고확정번호, 이동일, 검토일, 최종수정일시, 이동번호, 이동사유구분, 참조확인, 작성상태, 입고납품반품구분, 품명·품번·규격·단위, 이동수량, Lot, 기준단위수량(없으면 이동수량과 동일 표시), 출고·입고창고, 기능구분, 처리부서, 담당자, 특기사항, 판매처거래처명, 출고부서명, 참조거래처, 이동요청번호, 반품번호, 취소.
- **필터**: `_TLGInoutDaily`의 이동일(감지된 `InOutDate` 등) `from`~`to`, 헤더·라인 `InOutType` 조건 위와 동일.
- **ERP 범위**: `ERP_LG_INOUT_COMPANY_SEQ`·`ERP_LG_INOUT_BIZ_UNIT`(비우면 `ERP_PU_DELV_IN_*` 폴백). 사업장은 헤더의 `BizUnit`·`BizUnitSeq` 등 **실제 컬럼**을 감지해 적용하며, 컬럼이 없는데 값만 설정되어 있으면 필터를 건너뜁니다(0건 방지).

## 일자별판매실적분석

- **화면**: **부품관리 → 일자별판매실적분석** (`/app/production/tsl-sales-daily-analysis`).
- **API**: `GET /api/erp/tsl-sales-daily-analysis?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  선택 쿼리: `limit` (1~10000, 기본 8000). 로그인 세션 필요.
- **데이터**: `dbo._TSLInvoiceItem`(ii)를 기준으로 `dbo._TSLSalesItem`(si)·`dbo._TSLBillItem`(bi)를 **공통 키 후보**(`CompanySeq`+`InvoiceSeq`/`InvoiceSerl`, `SalesSeq`/`SalesSerl`, `SOSeq`/`SOSerl` 등)로 `INFORMATION_SCHEMA`에 맞춰 LEFT JOIN합니다. 테이블명이 `_` 접두 없이 존재하면 `TSL*` 동명으로 폴백합니다. 거래처·품목·부서·담당자·통화·단위 등은 `_TDACust`·`_TDAItem`·`_TDADept`·`_TDAEmp`·`_TDACurr`·`_TDAUnit`(있을 때) LEFT JOIN. **품목분류·품목그룹** 마스터는 스키마 편차를 줄이기 위해 현재 **NULL**로 두고, ERP와 맞추려면 서비스에서 분류 테이블 조인을 추가하면 됩니다.
- **필터**: 감지된 **업체일자**(Invoice·Sales·Bill 후보 컬럼을 YYYYMMDD로 정규화한 식)가 `from`~`to`(포함). 기간은 최대 약 400일. **`ERP_TSL_SALES_ANALYSIS_COMPANY_SEQ`**가 있으면 `ii`의 `CompanySeq`로 한정하고, **비우면** **`ERP_TSL_INVOICE_COMPANY_SEQ`**를 사용하며, 둘 다 비우면 법인 필터 없음.
- **응답 컬럼(그리드 순)**: 순번, 구분, 업체번호, 업체일자, 거래처, 거래처사업부, 영업구분, 품목계정, 부서, 담당자, 품명, 규격, 단위, 수량, 단가, 공급가액(외화) 문자열, 통화, 환율, 원화가액, 판매가액(공급+부가세), 공급가액, 부가세액, 합계금액, 원가단가(외화·원화), 원가금액(원화), 품목코드, 품목분류, 품목그룹, 영업그룹, 수주번호·순번, 지시번호·순번, 출고번호·순번.
- **상한**: 기본 최대 8,000행; 초과 시 `truncated: true`와 함께 앞부분만 반환합니다.

## 구매납품 품목 조회

- **화면**: **메일발송관리 → 메일발송메뉴현황**에서 메뉴명이 `구매납품품목조회`(공백 무시)이거나 메뉴코드가 `pu_delv_items`·`menu_code_004` 인 항목 상세. **외주납품품목조회**는 [외주납품 품목 조회](#외주납품-품목-조회)를 참고하세요.
- **API**: `GET /api/erp/pu-delv-items?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  선택 쿼리: `limit` (1~10000, 기본 8000), `schemaMeta=true`(선택, 응답에 `_TPUDelv`/라인의 `SMExpKind` 존재·필터 적용 여부 포함). 로그인 세션 필요.
- **데이터**: `dbo._TPUDelv` + 라인 테이블(`dbo._TPUDelvItem` 우선, 없으면 `dbo.TPUDelvItem`). 납품일·문서키·순번·금액·납품처 등 컬럼명은 실행 시 `INFORMATION_SCHEMA`로 감지합니다. 거래처 `_TDACust`, 품목 `_TDAItem`, 단위 `_TDAUnit`, 창고 `_TDAWH`, 프로젝트 `_TPJTProject`, 담당자 `_TDAEmp`, 부서 `_TDADept`, 통화 `_TDACurr` 등은 존재할 때 LEFT JOIN 합니다.
- **응답 컬럼(엑셀「구매납품품목조회」50열·선택 열 제외 순)**: 순번(조회 결과 표시 순서 1부터·`rowNo`), 사업단위, 납품일·번호, 발주일·번호, 구매거래처·구매처번호, 납품구분, 입고진행상태, 납품부서·담당자, 검사구분, 품명·품번·규격·단위, 납품단가·수량, 부가세포함여부·율, 금액·부가세·금액계, 통화·환율, 원화 금액·부가세·금액계, 입고수량·입고금액·입고원화금액, 내외자구분, 창고, 제조사, 품목자산분류, 유효일자, 합격·불합격·불합격반품수량, 특이사항·비고, 원천·진행조회(예약), 원천관리번호·원천번호, 고객 Lot, 최종작업일시, 품목 대·중·소분류. 실제 값은 `_TPUDelv`·`_TPUDelvItem`·`_TDAItem` 등에 존재하는 컬럼만 채워지며, 나머지는 `null`입니다.
- **필터**: 헤더의 납품일 컬럼(감지된 `DelvDate`·`PUDelvDate` 등, nchar `YYYYMMDD`)이 `from`~`to`(포함)인 라인만 반환합니다. 기간은 최대 약 400일로 제한됩니다. **수출품 제외**: 거래명세와 동일하게 `SMExpKind`가 문자열 `8009004`와 일치하는 헤더·라인은 제외합니다(`SMExpKind` 컬럼이 헤더·라인 중 어디에 있든 `INFORMATION_SCHEMA`로 감지해 적용, 없으면 해당 구간 필터 없음). `NULL`·공백·그 외 코드는 포함합니다.
- **ERP와 동일 범위**: `.env`의 `ERP_PU_DELV_COMPANY_SEQ`(필요 시 `ERP_PU_DELV_BIZ_UNIT`)로 법인·사업장을 맞추세요(구매입고용 `ERP_PU_DELV_IN_*`와 별도).
- **상한**: 기본 최대 8,000행; 초과 시 `truncated: true`와 함께 앞부분만 반환합니다.

구매납품 검증 절차(Network·MailMenu·엑셀 diff·`schemaMeta`)는 [docs/erp-pu-delv-verification.md](erp-pu-delv-verification.md)를 참고하세요.

## 외주납품 품목 조회

- **화면**: **메일발송관리 → 메일발송메뉴현황**에서 메뉴명이 `외주납품품목조회`(공백 무시, `구매납품품목조회` 라벨은 제외)이거나 메뉴코드가 `osp_delv_items`·`menu_code_osp_delv`·`menu_code_009` 인 항목 상세.
- **API**: `GET /api/erp/osp-delv-items?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  선택 쿼리: `limit` (1~10000, 기본 8000), `schemaMeta=true`(선택). 로그인 세션 필요.
- **데이터**: `dbo._TPDOSPDelv`(없으면 `dbo.TPDOSPDelv`) + 라인(`dbo._TPDOSPDelvItem` 우선, 없으면 `dbo.TPDOSPDelvItem`). 납품일·문서번호·외주처·납품처·금액·발주 등은 `INFORMATION_SCHEMA`로 후보 컬럼을 맞춥니다.
- **응답 컬럼**: 상태, 순번, 납품번호·순번, 납품일자, 외주처명, 납품처명, 담당자, 납품구분, 입고진행상태, 품목코드·명·규격·단위, 납품수량·단가, 금액·부가세·합계, 통화·환율, 외화 금액·부가세·합계, 창고·보관장소, 비고, 발주번호·순번·일자, 등록자·등록일시, 사업장.
- **필터**: 헤더의 납품일 컬럼(nchar `YYYYMMDD` 등)이 `from`~`to`(포함)인 라인만 반환합니다.
- **ERP와 동일 범위**: `.env`의 `ERP_OSP_DELV_COMPANY_SEQ`(필요 시 `ERP_OSP_DELV_BIZ_UNIT`)로 법인·사업장을 맞춥니다. 비어 있으면 구매납품용 `ERP_PU_DELV_*` 값으로 폴백할 수 있습니다(서비스 구현 기준).
- **상한**: 기본 최대 8,000행; 초과 시 `truncated: true`.

메뉴 라벨·코드는 구매납품(`구매납품품목조회` / `pu_delv_items`)과 겹치지 않게 등록하는 것이 좋습니다. MailMenu 점검 예시는 [docs/erp-pu-delv-verification.md](erp-pu-delv-verification.md)를 참고하세요.

설비정보 동기 등 기타 ERP 뷰는 `backend/src/external/erp/erp-tools.service.ts` 등을 참고하세요.
