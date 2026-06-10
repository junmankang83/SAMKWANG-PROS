/**
 * 창고별 재고조회 — ERP SSMS 배치와 동일: `#BIZ_*` 임시테이블 → `_SWCOMBisProcCheck`(선택) → `_SWLGWHStockListQuery`.
 * 조회일은 `#BIZ_IN_DataBlock1.DateTo`(YYYYMMDD 8자), `DateFr`는 NULL, 나머지 파라미터는 기본값·환경변수.
 */

const META = `WorkingTag      NCHAR(1)
        , IDX_NO        INT
        , DataSeq       INT
        , Selected      INT
        , MessageType   INT
        , Status        INT
        , Result        NVARCHAR(255)
        , ROW_IDX       INT
        , IsChangedMst  NCHAR(1)
        , TABLE_NAME    NVARCHAR(255)`;

/** ERP 창고별 재고 List용 `#BIZ_IN_DataBlock1` (수불 Sum용 IN1과 컬럼 구성이 다름) */
const LIST_IN1_COLS = `
        , BizUnit INT, DateFr NVARCHAR(8), DateTo NVARCHAR(8), SMQryType NCHAR(1), SMWHType INT, WHSeq INT, SMWHKind INT, SMUnitType INT, ConvUnitSeq INT, IsStockAmt NCHAR(1), SMStockAmtType INT, AssetSeq INT, SMStatus INT, ItemClassSSeq INT, ItemName NVARCHAR(200), ItemNo NVARCHAR(100), Spec NVARCHAR(200), IsZeroQty NCHAR(1), ItemClassLSeq INT, ItemClassMSeq INT, SMABC INT, EmpSeq INT, UMCostWHGroup INT`;

/** `#BIZ_OUT_DataBlock1` — Sum OUT1에서 `IsMStockQty` 제외(재고 List 스크립트 기준) */
const LIST_OUT1_COLS = `
        , BizUnit INT, BizUnitName NVARCHAR(100), DateFr NVARCHAR(8), DateTo NVARCHAR(8), SMQryType NCHAR(1), SMWHType INT, WHSeq INT, WHName NVARCHAR(100), SMWHKind INT, SMWHKindName NVARCHAR(100), SMUnitType INT,
ConvUnitSeq INT, IsStockAmt NCHAR(1), SMStockAmtType INT, AssetName NVARCHAR(100), AssetSeq INT, IsSubDisplay NCHAR(1), IsTrustCust NCHAR(1), SMStatus INT, SMStatusName NVARCHAR(100), ItemClassLName NVARCHAR(100),
ItemClassMName NVARCHAR(100), ItemClassSName NVARCHAR(100), ItemClassSSeq INT, ItemName NVARCHAR(200), ItemNo NVARCHAR(100), Spec NVARCHAR(200), ItemSeq INT, UnitName NVARCHAR(30), UnitSeq INT, PrevQty DECIMAL(19, 5), InQty DECIMAL(19, 5), OutQty DECIMAL(19, 5), StockQty DECIMAL(19, 5), StockAmt DECIMAL(19, 5), SafetyQty DECIMAL(19, 5), CustName NVARCHAR(100), CustSeq INT, InOutDate NCHAR(8), InOutName NVARCHAR(100), InOutKindName NVARCHAR(100), InOutDetailKindName NVARCHAR(100), InOutTypeName NVARCHAR(100), InOutNo NVARCHAR(30), InOutBizUnitName NVARCHAR(100), InWHName NVARCHAR(100), OutWHName NVARCHAR(100), InOutCustName NVARCHAR(100), InOutDeptName NVARCHAR(100), InOutEmpName NVARCHAR(100), JumpOutPgmId NVARCHAR(100), ColumnName NVARCHAR(100), InOutSeq INT, InOutSerl INT, InOutKind INT, InOutDetailKind INT, InOutType INT, InWHSeq INT, OutWHSeq INT, IsLackQry NCHAR(1), IsZeroQty NCHAR(1), LackQty DECIMAL(19, 5), IsLackYn NCHAR(1), ItemClassLSeq INT, ItemClassMSeq INT, MultiBizUnit NVARCHAR(MAX), LastUserName NVARCHAR(40), LastDateTime DATETIME, Remark NVARCHAR(1000), FullName NVARCHAR(200), CustNo NVARCHAR(30), UMCredLevelName NVARCHAR(100), UMChannelName NVARCHAR(100), UMCountryName NVARCHAR(100), SMCustStatusName NVARCHAR(100), BizNo NVARCHAR(40), SMBizPersName NVARCHAR(100), LawRegNo NVARCHAR(20), Owner NVARCHAR(60), PersonId NVARCHAR(400), TelNo NVARCHAR(20), MinorBizNo NVARCHAR(10), BizType NVARCHAR(60), BizKind NVARCHAR(60), BizAddr NVARCHAR(300), EngCustName NVARCHAR(200), FAX NVARCHAR(30), CustAddrName NVARCHAR(100), CustAddrEngName NVARCHAR(100), Email NVARCHAR(120), TransOpenDate NCHAR(8), HomePage NVARCHAR(120), SMInOutKindName NVARCHAR(100), SMABCName NVARCHAR(100), ItemEngName NVARCHAR(200), STDItemName NVARCHAR(200), Location NVARCHAR(2000), MRemark NVARCHAR(1000), SMQryTypeName NVARCHAR(100), LotNo NVARCHAR(30), LimitDays NVARCHAR(100), SMABC INT, EmpSeq INT, CostWHName NVARCHAR(200), UMCostWHGroup INT, InOutCustNo NVARCHAR(30)`;

const LIST_IN2_COLS = `
        , Title NVARCHAR(100), TitleSeq INT, Title2 NVARCHAR(100), TitleSeq2 INT`;

/** List 스크립트 IN3/OUT3 — Price·StkPrice 등 수불 전용 컬럼 없음 */
const LIST_IN3_COLS = `
        , WHName NVARCHAR(100), AssetName NVARCHAR(100), SMStatusName NVARCHAR(100), ItemClassLName NVARCHAR(100), ItemClassMName NVARCHAR(100), ItemClassSName NVARCHAR(100), ItemName NVARCHAR(200), ItemNo NVARCHAR(100), Spec NVARCHAR(200), UnitName NVARCHAR(30), UnitSeq INT, ItemSeq INT, PrevQty DECIMAL(19, 5), InQty DECIMAL(19, 5), OutQty DECIMAL(19, 5), StockQtyTot DECIMAL(19, 5), StockAmtTot DECIMAL(19, 5), SafetyQty DECIMAL(19, 5), StockQty DECIMAL(19, 5), StockAmt DECIMAL(19, 5), Qty DECIMAL(19, 5), BizUnit INT, BizUnitName NVARCHAR(100), SMWHKindName NVARCHAR(100), Location NVARCHAR(2000), SMWHKind INT, WHSeq INT, LotNo NVARCHAR(30), ValiDate NCHAR(8), SMABCName NVARCHAR(100), SMAssetGrpName NVARCHAR(200), MkCustName NVARCHAR(100), CostWHName NVARCHAR(200), Dummy1 NVARCHAR(100), Dummy2 NVARCHAR(100), Dummy3 NVARCHAR(100), Dummy4 NVARCHAR(100), Dummy5 NVARCHAR(100), Dummy6 INT, Dummy7 INT, Dummy8 DECIMAL(19, 5), Dummy9 DECIMAL(19, 5), CreateDate NCHAR(8), IsLot NCHAR(1)`;

const LIST_IN4_COLS = `
        , RowIDX INT, ColIDX INT, StockQty DECIMAL(19, 5), StockAmt DECIMAL(19, 5), Qty DECIMAL(19, 5)`;

const DROP_TEMPS = `
IF OBJECT_ID('tempdb..#BIZ_IN_DataBlock1') IS NOT NULL DROP TABLE #BIZ_IN_DataBlock1;
IF OBJECT_ID('tempdb..#BIZ_OUT_DataBlock1') IS NOT NULL DROP TABLE #BIZ_OUT_DataBlock1;
IF OBJECT_ID('tempdb..#BIZ_IN_DataBlock2') IS NOT NULL DROP TABLE #BIZ_IN_DataBlock2;
IF OBJECT_ID('tempdb..#BIZ_OUT_DataBlock2') IS NOT NULL DROP TABLE #BIZ_OUT_DataBlock2;
IF OBJECT_ID('tempdb..#BIZ_IN_DataBlock3') IS NOT NULL DROP TABLE #BIZ_IN_DataBlock3;
IF OBJECT_ID('tempdb..#BIZ_OUT_DataBlock3') IS NOT NULL DROP TABLE #BIZ_OUT_DataBlock3;
IF OBJECT_ID('tempdb..#BIZ_IN_DataBlock4') IS NOT NULL DROP TABLE #BIZ_IN_DataBlock4;
IF OBJECT_ID('tempdb..#BIZ_OUT_DataBlock4') IS NOT NULL DROP TABLE #BIZ_OUT_DataBlock4;
`;

function buildConstCreateBlockList(): string {
  return `
DECLARE @WS_L_In1 INT, @WS_L_Out1 INT, @WS_L_In2 INT, @WS_L_Out2 INT, @WS_L_In3 INT, @WS_L_Out3 INT, @WS_L_In4 INT, @WS_L_Out4 INT;
SELECT
    @WS_L_In1 = 0, @WS_L_Out1 = 0, @WS_L_In2 = 0, @WS_L_Out2 = 0,
    @WS_L_In3 = 0, @WS_L_Out3 = 0, @WS_L_In4 = 0, @WS_L_Out4 = 0;

IF @WS_L_In1 = 0
BEGIN
    CREATE TABLE #BIZ_IN_DataBlock1 (${META}${LIST_IN1_COLS});
    SET @WS_L_In1 = 1;
END

IF @WS_L_Out1 = 0
BEGIN
    CREATE TABLE #BIZ_OUT_DataBlock1 (${META}${LIST_OUT1_COLS});
    SET @WS_L_Out1 = 1;
END

IF @WS_L_In2 = 0
BEGIN
    CREATE TABLE #BIZ_IN_DataBlock2 (${META}${LIST_IN2_COLS});
    SET @WS_L_In2 = 1;
END

IF @WS_L_Out2 = 0
BEGIN
    CREATE TABLE #BIZ_OUT_DataBlock2 (${META}${LIST_IN2_COLS});
    SET @WS_L_Out2 = 1;
END

IF @WS_L_In3 = 0
BEGIN
    CREATE TABLE #BIZ_IN_DataBlock3 (${META}${LIST_IN3_COLS});
    SET @WS_L_In3 = 1;
END

IF @WS_L_Out3 = 0
BEGIN
    CREATE TABLE #BIZ_OUT_DataBlock3 (${META}${LIST_IN3_COLS});
    SET @WS_L_Out3 = 1;
END

IF @WS_L_In4 = 0
BEGIN
    CREATE TABLE #BIZ_IN_DataBlock4 (${META}${LIST_IN4_COLS});
    SET @WS_L_In4 = 1;
END

IF @WS_L_Out4 = 0
BEGIN
    CREATE TABLE #BIZ_OUT_DataBlock4 (${META}${LIST_IN4_COLS});
    SET @WS_L_Out4 = 1;
END
`;
}

/** `schema.proc` 또는 `proc`만 — `proc`만이면 `[dbo].[proc]` */
export function qualifyListBatchProc(configured: string): string {
  const t = configured.trim();
  if (!t) return '[dbo].[_SWLGWHStockListQuery]';
  if (t.includes('.')) {
    const i = t.lastIndexOf('.');
    const sch = t.slice(0, i).replace(/\]/g, ']]');
    const pr = t.slice(i + 1).replace(/\]/g, ']]');
    return `[${sch}].[${pr}]`;
  }
  return `[dbo].[${t.replace(/\]/g, ']]')}]`;
}

export function buildWhStockListBatchSql(opts: { skipProcCheck: boolean; listProcQualified: string }): string {
  const procCheck = opts.skipProcCheck
    ? `/* ERP_WH_STOCK_LIST_RUN_PROC_CHECK=false 일 때만 _SWCOMBisProcCheck 생략 */`
    : `EXEC _SWCOMBisProcCheck @ServiceSeq, @MethodSeq, @WorkingTag, @CompanySeq, @LanguageSeq, @UserSeq, @PgmSeq;
  IF @@ERROR <> 0 THROW 51100, N'_SWCOMBisProcCheck failed', 1;
  IF EXISTS(SELECT 1 FROM #BIZ_OUT_DataBlock1 WHERE Status <> 0) THROW 51101, N'#BIZ_OUT_DataBlock1 Status', 1;
  IF EXISTS(SELECT 1 FROM #BIZ_OUT_DataBlock2 WHERE Status <> 0) THROW 51102, N'#BIZ_OUT_DataBlock2 Status', 1;
  IF EXISTS(SELECT 1 FROM #BIZ_OUT_DataBlock3 WHERE Status <> 0) THROW 51103, N'#BIZ_OUT_DataBlock3 Status', 1;
  IF EXISTS(SELECT 1 FROM #BIZ_OUT_DataBlock4 WHERE Status <> 0) THROW 51104, N'#BIZ_OUT_DataBlock4 Status', 1;`;

  const execList = `EXEC ${opts.listProcQualified}
      @ServiceSeq, @WorkingTag, @CompanySeq, @LanguageSeq, @UserSeq, @PgmSeq, @IsTransaction;`;

  return `
SET NOCOUNT ON;
${DROP_TEMPS}
${buildConstCreateBlockList()}

/* DateTo = 조회일(YYYYMMDD), DateFr = NULL, 필터·코드는 파라미터 기본값 */
INSERT INTO #BIZ_IN_DataBlock1 (
  WorkingTag, IDX_NO, DataSeq, Selected, Status, Result, ROW_IDX, IsChangedMst, TABLE_NAME,
  BizUnit, DateFr, DateTo, SMQryType, SMWHType, WHSeq, SMWHKind, SMUnitType, ConvUnitSeq, IsStockAmt, SMStockAmtType, AssetSeq, SMStatus, ItemClassSSeq, ItemName, ItemNo, Spec, IsZeroQty, ItemClassLSeq, ItemClassMSeq, SMABC, EmpSeq, UMCostWHGroup
)
SELECT N'A', 1, 1, 1, 0, NULL, NULL, N'0', N'DataBlock1',
  @BizUnit, NULL, @DateTo, @SMQryType, @SMWHType, @WHSeq, @SMWHKind, @SMUnitType, NULL, @IsStockAmt, @SMStockAmtType, NULL, NULL, NULL, NULL, NULL, NULL, N'0', NULL, NULL, NULL, NULL, NULL;

IF @@ERROR <> 0 THROW 51105, N'INSERT #BIZ_IN_DataBlock1 failed', 1;

BEGIN TRY
  ${procCheck}

  ${execList}

  IF @@ERROR <> 0 THROW 51110, N'창고별 재고 List 프로시저 실행 실패', 1;

  /* 엑셀 42열: DROP 전 OUT2(열 제목)·OUT3(장형)·OUT4(RowIDX·ColIDX) 스냅샷 */
  SELECT * FROM #BIZ_OUT_DataBlock2;
  SELECT * FROM #BIZ_OUT_DataBlock3;
  SELECT * FROM #BIZ_OUT_DataBlock4;

  ${DROP_TEMPS}
END TRY
BEGIN CATCH
  ${DROP_TEMPS}
  THROW;
END CATCH;
`;
}
