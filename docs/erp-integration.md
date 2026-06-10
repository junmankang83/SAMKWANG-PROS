# ERP(MSSQL) 연동

SAMKWANG-PROS 백엔드는 `ERP_MSSQL_*` 환경 변수로 ERP SQL Server에 접속합니다. (예: `.env.example` 참고)  
**창고별수불집계**를 ERP 저장 프로시저로 조회할 때(`ERP_WH_STOCK_SUM_USE_ERP_PROC=true`)는 **`ERP_MSSQL_USER2`·`ERP_MSSQL_PASSWORD2`**로 별도 접속하는 것을 권장합니다(동일 `HOST`·`PORT`·`DATABASE`, EXECUTE 권한 계정).

**USER2 SQL 로그인명**은 **`skkrace`**가 정식입니다. OS·배포 환경에 과거 오타 **`skkracc`**가 남아 있어도 백엔드와 `erp:verify-user2` 스크립트가 접속 전에 **`skkrace`로 보정**합니다. 가능하면 `ERP_MSSQL_USER2`도 `skkrace`로 통일해 두세요.

**`.env` vs OS 환경 변수**: 백엔드 `ConfigModule`은 **`validatePredefined: false`**로 설정되어, `backend/.env`·상위 `../.env`에서 읽은 값이 Nest 기동 시 **`process.env` 전체와 다시 합쳐지며 덮어씌워지지 않습니다**. 그래서 `erp:verify-user2`(파일만 파싱)와 동일하게 **`ERP_MSSQL_HOST`·`DATABASE`(예: SKKR)·`USER2`·`PASSWORD2`**가 `.env` 기준으로 적용됩니다. OS에 잘못된 `ERP_MSSQL_PASSWORD2`가 있어도 창고별 재고조회용 접속에는 `.env`가 우선합니다. (`.env`에 없는 키만 여전히 `process.env`에서 읽힙니다.)

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
- **납품반품구분·작업지시번호**: 헤더 **`SMDelvType`**이 있으면 **`_TDASMinor`**(없으면 `TDASMinor`)에서 **`MajorSeq = 6209`**(다르면 **`ERP_OSP_DELV_IN_SMDELVTYPE_UMINOR_MAJOR`**)로 `MinorSeq`와 매칭한 명칭을 **최우선**으로 표시합니다. 추가로 헤더·라인의 입고구분 컬럼(`OSPSMInKind` 등)을 `_TDAUMinorValue`와 매칭할 때 **`MinorSeq`만으로는 행이 특정되지 않는 DB**가 있어, 필요하면 **`ERP_OSP_DELV_IN_KIND_UMINOR_MAJOR`**·**`ERP_OSP_DELV_IN_KIND_UMINOR_SERL`**을 둘 다 넣어 소분류 그룹을 한정합니다. 소분류 조인이 비어도 코드 `0`/`1`/`2` 등은 **「납품」「반품」**으로 보이게 매핑합니다. 작업지시번호는 **`_TPDSFCWorkOrder`**(없으면 `TPDSFCWorkOrder`)의 **`WorkOrderNo`**를 라인·헤더 **`WorkOrderSeq`**로 조인해 **최우선**으로 쓰고, 그다음 라인 `OSPWOSeq` 등으로 **`_TPPWorkOrd`** 등을 조인한 뒤, 없으면 기존처럼 라인·헤더의 문자열·숫자 후보를 `COALESCE`합니다.
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
- **데이터**: **세 축 `UNION ALL`** — (1) `dbo._TSLInvoiceItem`(ii) 기준 + si·bi `LEFT JOIN`, (2) `dbo._TSLSalesItem`(si) 기준으로 ii·bi를 붙인 뒤 **동일 키의 거래명세 품목이 없을 때만**(`NOT EXISTS ii`) 포함, (3) `dbo._TSLBillItem`(bi) 기준으로 ii·si를 붙인 뒤 동일하게 **`NOT EXISTS ii`** 시만 포함. 금액·수량 등은 ii/si/bi에 대해 `COALESCE` 후보로 스키마 매칭. 조인 키는 `INFORMATION_SCHEMA` 기준 **공통 키 후보**(`CompanySeq`+`InvoiceSeq`/`InvoiceSerl`, `SalesSeq`/`SalesSerl`, `SOSeq`/`SOSerl` 등). 테이블명 `_` 없으면 `TSL*` 동명 폴백. 거래처·품목·부서·담당자·통화·단위는 `COALESCE(ii,s,b).CompanySeq`로 마스터(`_TDACust`·`_TDAItem`·`_TDADept`·`_TDAEmp`·`_TDACurr`·`_TDAUnit`) 조인. 있으면 **`_TSLSales` / `_TSLBill`** 헤더를 si·bi 분기에 `LEFT JOIN`하여 **헤더 `SMExpKind`** 로도 수출 판별. **품목분류·품목그룹**은 현재 **NULL**(추후 마스터 조인 가능).
- **필터**: 감지된 **업체일자**(`dateYmdExpr`)가 `from`~`to`(포함). 라인에 일자 컬럼이 없으면 **`_TSLInvoice` 헤더**를 스칼라 서브쿼리로 붙여 `InvoiceDate` 등을 보강합니다. **`ERP_TSL_SALES_ANALYSIS_COMPANY_SEQ`**가 있으면 `COALESCE(ii,s,b).CompanySeq`로 한정하고, **비우면** **`ERP_TSL_INVOICE_COMPANY_SEQ`**를 사용하며, 둘 다 비우면 법인 필터 없음. **수출품만**: ii 분기는 `SMExpKind` = `8009004`(문자·BIGINT 일치) 또는 헤더·라인 조합. `SMExpKind`가 없을 때는 **`UMSalesKind`/`SMSalesKind` 텍스트**가 `수출`, **`매출-수출`**, `매출%수출` 패턴(단 `반품` 포함 문자열 제외)으로 판별합니다. si·bi 분기도 동일한 UM 규칙·헤더 `SMExpKind`를 사용합니다. 화면 **구분**은 ERP 컬럼 조합(`divisionExpr`)으로 표시됩니다.
- **응답 컬럼(그리드 순)**: 순번, 구분, 업체번호, 업체일자, 거래처, 거래처사업부, 영업구분, 품목계정, 부서, 담당자, 품명, 규격, 단위, 수량, 단가, 공급가액(외화) 문자열, 통화, 환율, 원화가액, 판매가액(공급+부가세), 공급가액, 부가세액, 합계금액, 원가단가(외화·원화), 원가금액(원화), 품목코드, 품목분류, 품목그룹, 영업그룹, 수주번호·순번, 지시번호·순번, 출고번호·순번.
- **상한**: 기본 최대 8,000행; 초과 시 `truncated: true`와 함께 앞부분만 반환합니다.

## 작업실적조회

- **화면**: **부품관리 → 작업실적조회** (`/app/production/pdsfc-work-report`).
- **API**: `GET /api/erp/pdsfc-work-report?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  선택 쿼리: `limit` (1~10000, 기본 8000), `schemaMeta=true`(선택, 사용한 테이블명·실적일자 컬럼명·법인 필터 적용 여부). 로그인 세션 필요.
- **데이터**: `dbo._TPDSFCWorkReport`(없으면 `dbo.TPDSFCWorkReport`) 기준. 실적일자·수량·금액·시간 등 컬럼명은 `INFORMATION_SCHEMA` 후보 매칭으로 감지합니다. **`CompanySeq`가 있으면** `dbo.[_TDAItem]`(제품번호·명·규격, 품목 대·중·소·자산분류 컬럼명도 `_TDAItem` 메타에서 감지), `dbo.[_TDAEmp]` `emp`(대표작업자), `empF`(최종작업자, `FinalEmpSeq` 등 후보), `dbo.[_TDAUnit]`, `dbo.[_TDAWorkShop]`, `dbo.[_TDADept]`(생산부서명)을 **LEFT JOIN**할 수 있으면 조인합니다. 키·테이블이 없으면 해당 조인·값은 생략·NULL입니다.
- **필터**: 감지된 실적일자가 `from`~`to`(포함). 기간은 최대 약 400일. **`ERP_PDSFC_WORK_REPORT_COMPANY_SEQ`**를 **비우거나 0**이면 법인 필터 없음, **1 이상**이면 해당 `CompanySeq`만 조회합니다.
- **응답 컬럼**: 엑셀 **작업실적조회_skkr**와 동일한 **52키**(`choice`, `finalWorkAt`, `workDate`, `prodDept`, … `finalWorker` — 백엔드 `PDSFC_SKKR_EXCEL_COLUMNS`·프론트 `lib/erp/pdsfc-skkr-excel-columns.ts` 순서). 화면 그리드는 **순번(`rowNo`) + 위 52열**입니다.
- **상한**: 기본 최대 8,000행; 초과 시 `truncated: true`와 함께 앞부분만 반환합니다.

## 창고별수불집계조회

- **화면**: **메일발송관리 → 메일발송메뉴현황**에서 메뉴명·코드가 맞으면 동일 조회 UI가 열립니다(`lib/mail/wh-stock-sum-menu.ts`). 부품관리 사이드 메뉴에는 노출하지 않습니다. URL 직접 접근: `/app/production/wh-stock-sum`.
- **API**: `GET /api/erp/wh-stock-sum?dateFr=YYYY-MM-DD&dateTo=YYYY-MM-DD`  
  동일 의미 별칭: `from`·`to`(우선순위는 `dateFr`·`dateTo`가 더 높음). 선택 쿼리: `limit`, `bizUnit`(API·자동화용 오버라이드; 화면은 **`ERP_WH_STOCK_SUM_BIZ_UNIT`** 등 서버 기본값만 사용).
- **데이터**: **기본**은 `dbo._TLGInoutDaily`·`dbo._TLGInoutDailyItem`(없으면 `TLG*` 동명)에서 **프로시저 없이** 창고·품목별로 이월(`DateFr` 이전 누적)·기간 입고·기간 출고·기말 재고를 집계합니다. 입고창고·출고창고에 수량을 나누어 반영하고, 둘 다 없을 때는 라인 `WHSeq` 등 단일 창고 후보가 있으면 **입고 쪽**으로만 집계합니다(ERP 표준과 다를 수 있음). 취소 플래그 컬럼이 있으면 제외합니다. **`_TDAItem`·`_TDAUnit`·`_TDAWH`·`_TDABizUnit`**은 있으면 조인합니다. 이월 계산을 위해 `ERP_WH_STOCK_SUM_DIRECT_OPENING_LOOKBACK_DAYS`(기본 1460일)만큼 과거 일자까지 스캔합니다.
- **레거시 프로시저 경로**: `ERP_WH_STOCK_SUM_USE_ERP_PROC=true`이면 ERP와 동일하게 `#BIZ_*` 임시테이블을 만든 뒤 **`_SWCOMBisProcCheck`**(선택) → **`skkr_SWLGWHStockSumListQuery`**(`SKKR_SWLGWHStockSumListQuery`)를 실행합니다. 프로시저는 **여러 결과 집합**을 반환할 수 있으며(입출고유형 헤더, `#TempReturn_ROW` 고정행, `RowIDX`·`ColIDX`·`Qty` 피벗 등), 백엔드는 **`SMAssetGrpName`·`ItemName` 등이 있는 고정행** 집합을 골라 36열로 매핑합니다. 배치 SQL 끝의 `#BIZ_OUT_DataBlock1`만 읽는 `SELECT`는 SKKR 본문이 해당 테이블을 채우지 않는 경우가 있어 사용하지 않습니다. DB 접속은 **`ERP_MSSQL_USER2`·`ERP_MSSQL_PASSWORD2`**가 있으면 해당 계정만 사용하고, 없으면 `ERP_MSSQL_USER`로 폴백합니다. **`ERP_WH_STOCK_SUM_RUN_PROC_CHECK=true`**일 때만 `_SWCOMBisProcCheck`를 선행합니다.
- **필터**: `DateFr`·`DateTo`를 `YYYYMMDD`로 변환해 `#BIZ_IN_DataBlock1`에 설정합니다. 기간은 최대 약 400일입니다.
- **환경 변수(예시·미설정 시 코드 기본값 사용)**: `ERP_WH_STOCK_SUM_SERVICE_SEQ`(152910054), `ERP_WH_STOCK_SUM_METHOD_SEQ`(2), `ERP_WH_STOCK_SUM_PGM_SEQ`(152910062), `ERP_WH_STOCK_SUM_COMPANY_SEQ`(1), `ERP_WH_STOCK_SUM_LANGUAGE_SEQ`(1), `ERP_WH_STOCK_SUM_USER_SEQ`(5), `ERP_WH_STOCK_SUM_BIZ_UNIT`(1), `ERP_WH_STOCK_SUM_SM_QRY_TYPE`(S), `ERP_WH_STOCK_SUM_SMWH_TYPE`(8104001), `ERP_WH_STOCK_SUM_SM_UNIT_TYPE`(8103001), `ERP_WH_STOCK_SUM_SM_STOCK_AMT_TYPE`(8105002). 실제 값은 ERP 등록 화면·DB와 맞춰야 합니다.
- **응답 컬럼**: ERP 창고별수불 집계 화면과 동일한 **36열**(품목구분·품목그룹명·대/중분류·품번·품명·규격·단위·관리단위·창고코드·창고명·장소·프로젝트·기초/입고/출고/기말 수량·금액·가용·안전재고·발주·예정·미납·예약·부족·적정·과잉·회전율·회전일 등). JSON 키는 `camelCase`(`itemKind`, `openingQty` …). 직접 SQL 경로는 조인 가능한 마스터만 채우고 나머지 수치는 `0`/`null`입니다. 프로시저 경로는 SKKR **`#TempReturn_ROW` 형태**(또는 레거시 **`#BIZ_OUT_DataBlock1`**) 결과를 이 레이아웃으로 매핑합니다.
- **상한**: 기본 최대 8,000행; 초과 시 `truncated: true`와 함께 앞부분만 반환합니다.

## 창고별 재고조회

- **화면**: **메일발송관리 → 메일발송메뉴현황**에서 메뉴명·코드가 `lib/mail/wh-stock-list-menu.ts`의 `isWhStockListMailMenu`와 일치하는 항목 상세(내장 `WhStockListInquiry`). 부품관리 사이드 메뉴에는 노출하지 않습니다. URL 직접 접근: `/app/production/wh-stock-list`.
- **API**: `GET /api/erp/wh-stock-list?asOf=YYYY-MM-DD` (별칭 `date=`). 선택: `limit`, **`bizUnit`**(레거시 배치 경로에서만 `#BIZ_IN_DataBlock1.BizUnit`; 생략 시 `ERP_WH_STOCK_LIST_BIZ_UNIT`·기본 1).
- **데이터(기본)**: **`ERP_MSSQL_USER2`·`ERP_MSSQL_PASSWORD2` 필수**로 접속한 뒤 **`EXEC [dbo].[Sp_Inventory_NQL] @… = @…`** 한 번만 실행합니다. 조회일은 API `asOf`를 **`YYYYMMDD` 8자(하이픈 없음)**로 바꿔 SP 매개 변수에 넣습니다(기본 **`@Date`**, **`ERP_WH_STOCK_LIST_SP_INVENTORY_NQL_DATE_PARAM`**으로 변경 가능). **`ERP_WH_STOCK_LIST_SP_INVENTORY_NQL_PROC`**로 프로시저명(또는 `스키마.이름`)을 바꿀 수 있습니다. 결과 recordset이 품목·창고명·수량 형태면 **`#BIZ_OUT_DataBlock3`와 동일한 피벗**으로 42열 응답을 만듭니다. SP가 돌려준 **`WHName` 등 창고명**으로 열 순서를 잡을 수 있으면 그 순서를 쓰고, 아니면 **`ERP_WH_STOCK_LIST_EXCEL_WH_HEADERS`** 또는 코드 기본 15창고 순서를 씁니다.
- **데이터(레거시)**: **`ERP_WH_STOCK_LIST_USE_SP_INVENTORY_NQL`**을 **`false`**, **`0`**, **`no`**, **`legacy`** 중 하나로 두면, SSMS 배치와 동일하게 **`#BIZ_IN_DataBlock1` … `#BIZ_OUT_DataBlock4`** 임시테이블을 만든 뒤 **`#BIZ_IN_DataBlock1`에 한 행 INSERT**하고 **`DateTo`**·**`DateFr`**·**`BizUnit`** 등 기존 규칙으로 **`_SWCOMBisProcCheck`**(선택) → **`_SWLGWHStockListQuery`**(`ERP_WH_STOCK_LIST_BATCH_PROC`)를 실행합니다.
- **엑셀 동일 42열**: 프로시저 실행 직후·임시테이블 `DROP` 전에 배치가 **`SELECT * FROM #BIZ_OUT_DataBlock2`**(열 제목)·**`#BIZ_OUT_DataBlock3`**(장형)·**`#BIZ_OUT_DataBlock4`**(`RowIDX`·`ColIDX` 피벼)를 추가 실행합니다. SSMS에서 사용자 스크립트가 **바로 `DROP TABLE`만 하면** 이 시점의 데이터를 볼 수 없으므로, 검증 시에는 **`DROP` 전에 동일 `SELECT`를 넣어** 결과 집합을 확인하세요. Node는 **`#BIZ_OUT_DataBlock3` 전용 recordset**만 골라 씁니다(`StockQtyTot`/`StockAmtTot`/`SMAssetGrpName` 등으로 `#BIZ_OUT_DataBlock1` 입출력 집합과 구분). 행이 가장 많은 OUT3 집합을 택하고, 창고열은 `WHName` → `CostWHName` → `SMWHKindName` 순으로 매칭합니다. **창고명 매칭 후에도 비어 있는 칸**은 `ROW_IDX`와 Block4의 `RowIDX`가 같을 때 **`ColIDX`→창고열**로 보조 채웁니다(합계열 스킵 등 `ColIDX` 기준은 ERP에 맞게 0/1 기반을 시도). **`#BIZ_OUT_DataBlock3`가 비어 있으면** 프로시저가 돌려준 **9컬럼 직선 recordset**으로 폴백합니다.
- **창고 열 순서(A안)**: 기본은 엑셀 샘플과 동일한 **15창고명 순서**(코드 상수 `WH_STOCK_LIST_DEFAULT_WAREHOUSE_HEADERS`). ERP 창고명과 어긋나면 `.env` **`ERP_WH_STOCK_LIST_EXCEL_WH_HEADERS`**에 JSON 문자열 배열로 덮어씁니다. 예: `["개발창고","경유창고",…]` — 개수만큼 열이 생기며, 응답 `warehouseHeaders`와 각 행의 `warehouses` 길이가 같습니다.
- **연결 점검**: 백엔드에서 `pnpm --filter @samkwang/backend erp:verify-user2`(또는 `node scripts/verify-erp-user2-connect.cjs`)로 USER2 로그인만 검증할 수 있습니다. `PASSWORD2`에 **`#`가 있으면 값 전체를 큰따옴표**로 감싸야 합니다(dotenv가 `#` 이후를 주석 처리). 값 끝이 `$`이면 따옴표 안에서 `\$`로 이스케이프하세요.
- **엑셀 샘플 정합**: `창고별 재고조회_20260609.xlsx`에서 추출한 제목·고정 10열·15창고 순서는 [`backend/src/external/erp/data/wh-stock-excel-reference.json`](../backend/src/external/erp/data/wh-stock-excel-reference.json)에 두고 코드 상수와 맞춥니다. 재생성: `python scripts/read-wh-stock-xlsx.py`(다운로드 폴더의 동일 파일명 xlsx 경로 필요).
- **응답**: 엑셀과 동일한 의미의 **`warehouseHeaders`**, **`summary`**(`TOTAL`은 **`assetClass`**에 `"TOTAL"`·품목이 없으면 `null`), **`items`**, 메타 `asOf`, `truncated`. 각 품목 행은 `assetClass`, `classL`~`classS`, `importance`, `itemName`, `itemNo`, `spec`, `unit`, `itemStatus`, `totalQty`, `totalAmt`, `warehouses: [{ qty, amt }, …]`입니다. 창고별 수량은 `StockQty`가 비면 **`Qty`** 컬럼을 사용합니다. **`#BIZ_OUT_DataBlock4`**는 창고명 매칭 후에도 비어 있는 칸을 `ROW_IDX`/`RowIDX`·`ColIDX`로 보조 채웁니다.

## 구매납품 품목 조회

- **화면**: **메일발송관리 → 메일발송메뉴현황**에서 메뉴명이 `구매납품품목조회`(공백 무시)이거나 메뉴코드가 `pu_delv_items`·`menu_code_004` 인 항목 상세. **외주납품품목조회**는 [외주납품 품목 조회](#외주납품-품목-조회)를 참고하세요.
- **API**: `GET /api/erp/pu-delv-items?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  선택 쿼리: `limit` (1~10000, 기본 8000), `schemaMeta=true`(선택, 응답에 `_TPUDelv`/라인의 `SMExpKind` 존재·필터 적용 여부 포함). 로그인 세션 필요.
- **데이터**: `dbo._TPUDelv` + 라인 테이블(`dbo._TPUDelvItem` 우선, 없으면 `dbo.TPUDelvItem`). 납품일·문서키·순번·금액·납품처 등 컬럼명은 실행 시 `INFORMATION_SCHEMA`로 감지합니다. 거래처 `_TDACust`, 품목 `_TDAItem`, 단위 `_TDAUnit`, 창고 `_TDAWH`, 담당자 `_TDAEmp`, 부서 `_TDADept`, 통화 `_TDACurr`, 발주 `_TPUPurOrder`/`TPUPurOrder`(라인 `PurOrderSeq` 등으로 조인; **Seq를 못 찾으면 라인 발주번호 문자열로 `LEFT JOIN`**), **발주라인** `_TPUPurOrderItem`/`TPUPurOrderItem`(발주Seq·Serl로 라인 매칭 시 원천/진행조회 등), 제조사명 보강을 위한 **`_TDACust` mk**(`_TDAItem`의 `MakerSeq` 등) 등은 존재할 때 LEFT JOIN 합니다. 발주일은 발주 헤더 날짜가 비면 납품 라인·납품 헤더의 발주일 후보 컬럼으로 `COALESCE`합니다.
- **응답 컬럼(엑셀「구매납품품목조회」50열·선택 열 제외 순)**: 순번(조회 결과 표시 순서 1부터·`rowNo`), 사업단위, 납품일·번호, 발주일·번호, 구매거래처·구매처번호, 납품구분, 입고진행상태, 납품부서·담당자, 검사구분, 품명·품번·규격·단위, 납품단가·수량, 부가세포함여부·율, 금액·부가세·금액계, 통화·환율, 원화 금액·부가세·금액계, 입고수량·입고금액·입고원화금액, 내외자구분, 창고, 제조사, 품목자산분류, 유효일자, 합격·불합격·불합격반품수량, 특이사항·비고, **원천·진행조회**, 원천관리번호·원천번호, 고객 Lot, 최종작업일시, 품목 대·중·소분류. **납품일**은 `CHAR(8)` YYYYMMDD로 정규화한 뒤 기간 필터·정렬에 사용합니다(datetime·문자 혼용). 원화 열은 ERP에 `KrwSupplyAmt` 등이 있으면 우선하고, 없으면 라인 금액·부가세·합계로 채웁니다. **품명·품번**은 `_TDAItem`이 비어 있으면 납품 라인의 `MatName`·`LineItemName`·`PurItemName`·`MatNo`·`LineItemNo` 등으로 `COALESCE`합니다. 스키마에 없는 후보 컬럼은 `null`입니다.
- **필터**: 정규화된 납품일(`YYYYMMDD`)이 `from`~`to`(포함)인 라인만 반환합니다. 기간은 최대 약 400일로 제한됩니다. **수출품 제외**: 거래명세와 동일하게 `SMExpKind`가 문자열 `8009004`와 일치하는 헤더·라인은 제외합니다(`SMExpKind` 컬럼이 헤더·라인 중 어디에 있든 `INFORMATION_SCHEMA`로 감지해 적용, 없으면 해당 구간 필터 없음). `NULL`·공백·그 외 코드는 포함합니다.
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
