/*
  외주입고/반품품목조회 — 엑셀 열 순서 (부가세포함여부 → 부가세 → 합계)
  테이블: dbo._TPDOSPDelvIn (h), dbo._TPDOSPDelvInItem (i)
  없으면 dbo.TPDOSPDelvIn / dbo.TPDOSPDelvInItem 로 바꿔 실행.

  실행 전 INFORMATION_SCHEMA 로 실제 컬럼명을 확인한 뒤,
  주석에 적어 둔 “교체 후보” 중 맞는 이름으로 바꾸세요.

    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = N'dbo'
      AND TABLE_NAME IN (N'_TPDOSPDelvIn', N'_TPDOSPDelvInItem')
    ORDER BY TABLE_NAME, ORDINAL_POSITION;
*/

SET NOCOUNT ON;

DECLARE @CompanySeq INT = 1;              /* 법인 */
DECLARE @FromYmd   CHAR(8) = '20230601';  /* YYYYMMDD */
DECLARE @ToYmd     CHAR(8) = '20230630';

/*──────── 입고일 컬럼: OSPDelvInDate 없으면 DelvInDate, InDate 등으로 일괄 치환 ────────*/
;WITH lined AS (
  SELECT
    h.CompanySeq,
    h.OSPDelvInSeq,
    h.CustSeq,
    h.DeptSeq,
    h.EmpSeq,
    h.ModEmpSeq,
    h.OSPDelvInNo,
    h.OSPDelvInDate,
    h.OSPSMInKind,
    h.OSPWorkOrdNo AS H_OSPWorkOrdNo,
    h.WorkOrdNo AS H_WorkOrdNo,
    h.WHSeq AS HWHSeq,
    h.LastDateTime,
    h.SlipNo,
    i.OSPDelvInSerl,
    i.ItemSeq,
    i.WHSeq AS IWHSeq,
    i.Qty,
    i.DomAmt,
    i.DomVAT,
    i.VATIncKind,
    i.PurOrderSeq,
    i.PurOrderNo,
    i.LotNo,
    i.Chasu,
    i.MatInputYn,
    i.RawMatPrice,
    i.OSPIOrderNo,
    i.OSPOrderNo,
    i.WOOrderNo,
    i.WorkOrderNo AS I_WorkOrderNo,
    i.WorkOrdNo AS I_WorkOrdNo,
    i.OSPWorkOrdNo AS I_OSPWorkOrdNo,
    /* 숫자형 작업지시 후보(없는 컬럼이면 CTE에서 제거) */
    i.OSPWOSeq,
    i.WOSeq,
    i.PlanSeq,
    i.OSPItemName,
    i.OSPItemNo,
    i.ProcName,
    i.WorkProcName,
    i.OSPProcName,
    i.CustPrice,
    i.ItemPrice,
    i.Price,
    i.UnitPrice,
    i.SpecialNote,
    i.UnusualNote,
    i.Remark2,
    i.Remark,
    i.Memo,
    c.CustName,
    dp.DeptName,
    empIn.EmpName AS InChargeEmpName,
    lwEmp.EmpName AS LastWriterName,
    it.ItemName,
    it.ItemNo,
    it.Spec AS ItemSpec,
    it.ItemKindLName,
    it.ItemKindMName,
    it.ItemKindSName,
    wh.WHName,
    po.PurOrderNo AS POPurOrderNo,
    ink.KindText AS InKindText,
    /* YYYYMMDD 8자 */
    CASE
      WHEN TRY_CONVERT(datetime, h.OSPDelvInDate, 112) IS NOT NULL
        THEN CONVERT(CHAR(8), TRY_CONVERT(datetime, h.OSPDelvInDate, 112), 112)
      WHEN TRY_CONVERT(datetime, h.OSPDelvInDate) IS NOT NULL
        THEN CONVERT(CHAR(8), TRY_CONVERT(datetime, h.OSPDelvInDate), 112)
      ELSE RIGHT(N'00000000' + LTRIM(RTRIM(CAST(h.OSPDelvInDate AS NVARCHAR(30)))), 8)
    END AS HYmd8
  FROM dbo._TPDOSPDelvIn h
  INNER JOIN dbo._TPDOSPDelvInItem i
    ON h.CompanySeq = i.CompanySeq
   AND h.OSPDelvInSeq = i.OSPDelvInSeq
  LEFT JOIN dbo._TDACust c
    ON h.CompanySeq = c.CompanySeq AND h.CustSeq = c.CustSeq
  LEFT JOIN dbo._TDADept dp
    ON h.CompanySeq = dp.CompanySeq AND h.DeptSeq = dp.DeptSeq
  LEFT JOIN dbo._TDAEmp empIn
    ON h.CompanySeq = empIn.CompanySeq AND h.EmpSeq = empIn.EmpSeq
  LEFT JOIN dbo._TDAEmp lwEmp
    ON h.CompanySeq = lwEmp.CompanySeq AND h.ModEmpSeq = lwEmp.EmpSeq
  OUTER APPLY (
    SELECT TOP (1)
      COALESCE(
        NULLIF(LTRIM(RTRIM(CAST(umk.MinorName AS NVARCHAR(200)))), N''),
        NULLIF(LTRIM(RTRIM(CAST(umk.ValueText AS NVARCHAR(200)))), N'')
      ) AS KindText
    FROM dbo._TDAUMinorValue umk
    WHERE (umk.CompanySeq = h.CompanySeq OR umk.CompanySeq IS NULL)
      AND (
        CAST(umk.MinorSeq AS NVARCHAR(50)) = CAST(h.OSPSMInKind AS NVARCHAR(50))
        OR LTRIM(RTRIM(CAST(umk.ValueText AS NVARCHAR(100)))) = LTRIM(RTRIM(CAST(h.OSPSMInKind AS NVARCHAR(100))))
      )
    ORDER BY CASE WHEN umk.CompanySeq = h.CompanySeq THEN 0 ELSE 1 END
  ) ink
  LEFT JOIN dbo._TDAItem it
    ON h.CompanySeq = it.CompanySeq AND i.ItemSeq = it.ItemSeq
  LEFT JOIN dbo._TDAWH wh
    ON h.CompanySeq = wh.CompanySeq
   AND wh.WHSeq = COALESCE(NULLIF(i.WHSeq, 0), NULLIF(h.WHSeq, 0))
  LEFT JOIN dbo._TPOSPPurOrder po
    ON h.CompanySeq = po.CompanySeq
   AND NULLIF(i.PurOrderSeq, 0) IS NOT NULL
   AND po.PurOrderSeq = i.PurOrderSeq
  WHERE h.CompanySeq = @CompanySeq
)
SELECT
  /* 1  외주입고번호 */
  CASE
    WHEN LEN(LTRIM(RTRIM(l.OSPDelvInNo))) = 10 AND LTRIM(RTRIM(l.OSPDelvInNo)) NOT LIKE N'%-%'
      THEN LEFT(LTRIM(RTRIM(l.OSPDelvInNo)), 6) + N'-' + SUBSTRING(LTRIM(RTRIM(l.OSPDelvInNo)), 7, 20)
    ELSE LTRIM(RTRIM(l.OSPDelvInNo))
  END AS [외주입고번호],

  /* 2  외주입고일 */
  CONVERT(
    CHAR(10),
    TRY_CONVERT(
      date,
      CASE
        WHEN TRY_CONVERT(datetime, l.OSPDelvInDate, 112) IS NOT NULL
          THEN TRY_CONVERT(datetime, l.OSPDelvInDate, 112)
        WHEN TRY_CONVERT(datetime, l.OSPDelvInDate) IS NOT NULL
          THEN TRY_CONVERT(datetime, l.OSPDelvInDate)
        ELSE TRY_CONVERT(date, l.HYmd8, 112)
      END
    ),
    23
  ) AS [외주입고일],

  /* 3  외주거래처 */
  LTRIM(RTRIM(l.CustName)) AS [외주거래처],

  /* 4  입고부서 */
  LTRIM(RTRIM(l.DeptName)) AS [입고부서],

  /* 5  입고담당자 */
  LTRIM(RTRIM(l.InChargeEmpName)) AS [입고담당자],

  /* 6  납품반품구분 — 소분류 조인 + 코드 0/1/2 보조 */
  LTRIM(RTRIM(CAST(
    COALESCE(
      NULLIF(LTRIM(RTRIM(CAST(l.InKindText AS NVARCHAR(200)))), N''),
      CASE LTRIM(RTRIM(UPPER(CAST(l.OSPSMInKind AS NVARCHAR(50)))))
        WHEN N'1' THEN N'납품'
        WHEN N'0' THEN N'납품'
        WHEN N'Y' THEN N'납품'
        WHEN N'N' THEN N'반품'
        WHEN N'2' THEN N'반품'
        WHEN N'납품' THEN N'납품'
        WHEN N'반품' THEN N'반품'
        ELSE NULL
      END,
      LTRIM(RTRIM(CAST(l.OSPSMInKind AS NVARCHAR(50))))
    ) AS NVARCHAR(200))
  )) AS [납품반품구분],

  /* 7  작업지시번호 — 문자열 후보 → 숫자 시퀀스(예: OSPWOSeq) → 헤더 후보 */
  LTRIM(RTRIM(CAST(
    COALESCE(
      NULLIF(LTRIM(RTRIM(CAST(l.OSPIOrderNo AS NVARCHAR(100)))), N''),
      NULLIF(LTRIM(RTRIM(CAST(l.OSPOrderNo AS NVARCHAR(100)))), N''),
      NULLIF(LTRIM(RTRIM(CAST(l.WOOrderNo AS NVARCHAR(100)))), N''),
      NULLIF(LTRIM(RTRIM(CAST(l.I_WorkOrderNo AS NVARCHAR(100)))), N''),
      NULLIF(LTRIM(RTRIM(CAST(l.I_WorkOrdNo AS NVARCHAR(100)))), N''),
      NULLIF(LTRIM(RTRIM(CAST(l.I_OSPWorkOrdNo AS NVARCHAR(100)))), N''),
      NULLIF(LTRIM(RTRIM(CAST(NULLIF(l.OSPWOSeq, 0) AS NVARCHAR(100)))), N''),
      NULLIF(LTRIM(RTRIM(CAST(NULLIF(l.WOSeq, 0) AS NVARCHAR(100)))), N''),
      NULLIF(LTRIM(RTRIM(CAST(NULLIF(l.PlanSeq, 0) AS NVARCHAR(100)))), N''),
      NULLIF(LTRIM(RTRIM(CAST(l.H_OSPWorkOrdNo AS NVARCHAR(100)))), N''),
      NULLIF(LTRIM(RTRIM(CAST(l.H_WorkOrdNo AS NVARCHAR(100)))), N'')
    ) AS NVARCHAR(100))
  )) AS [작업지시번호],

  /* 8  ERP품명 */
  LTRIM(RTRIM(CAST(
    COALESCE(NULLIF(LTRIM(RTRIM(CAST(l.OSPItemName AS NVARCHAR(500)))), N''), l.ItemName) AS NVARCHAR(500))
  )) AS [ERP품명],

  /* 9  ERP품번 */
  LTRIM(RTRIM(CAST(
    COALESCE(NULLIF(LTRIM(RTRIM(CAST(l.OSPItemNo AS NVARCHAR(100)))), N''), l.ItemNo) AS NVARCHAR(100))
  )) AS [ERP품번],

  /* 10 ERP규격 */
  LTRIM(RTRIM(CAST(l.ItemSpec AS NVARCHAR(500)))) AS [ERP규격],

  /* 11 입고수량 */
  l.Qty AS [입고수량],

  /* 11 단가 */
  CAST(
    COALESCE(NULLIF(l.CustPrice, 0), NULLIF(l.ItemPrice, 0), NULLIF(l.Price, 0), l.UnitPrice) AS DECIMAL(18, 6)
  ) AS [단가],

  /* 12 금액 */
  CAST(l.DomAmt AS DECIMAL(18, 4)) AS [금액],

  /* 13 부가세포함여부 */
  LTRIM(RTRIM(CAST(l.VATIncKind AS NVARCHAR(20)))) AS [부가세포함여부],

  /* 14 부가세 */
  CAST(l.DomVAT AS DECIMAL(18, 4)) AS [부가세],

  /* 15 합계금액 */
  CAST(ISNULL(l.DomAmt, 0) + ISNULL(l.DomVAT, 0) AS DECIMAL(18, 4)) AS [합계금액],

  /* 17 입고창고 */
  LTRIM(RTRIM(l.WHName)) AS [입고창고],

  /* 18 특이사항 */
  LTRIM(RTRIM(CAST(
    COALESCE(
      NULLIF(LTRIM(RTRIM(CAST(l.SpecialNote AS NVARCHAR(500)))), N''),
      NULLIF(LTRIM(RTRIM(CAST(l.UnusualNote AS NVARCHAR(500)))), N''),
      l.Remark2
    ) AS NVARCHAR(500))
  )) AS [특이사항],

  /* 19 비고 */
  LTRIM(RTRIM(CAST(COALESCE(NULLIF(LTRIM(RTRIM(CAST(l.Remark AS NVARCHAR(500)))), N''), l.Memo) AS NVARCHAR(500)))) AS [비고],

  /* 20 LotNo */
  LTRIM(RTRIM(CAST(l.LotNo AS NVARCHAR(100)))) AS [LotNo],

  /* 21 차수 */
  TRY_CAST(l.Chasu AS INT) AS [차수],

  /* 22 PO번호 */
  LTRIM(RTRIM(CAST(
    COALESCE(
      NULLIF(LTRIM(RTRIM(CAST(l.POPurOrderNo AS NVARCHAR(60)))), N''),
      NULLIF(LTRIM(RTRIM(CAST(l.PurOrderNo AS NVARCHAR(60)))), N''),
      CASE WHEN NULLIF(l.PurOrderSeq, 0) IS NULL THEN NULL
           ELSE LTRIM(RTRIM(CAST(l.PurOrderSeq AS NVARCHAR(30)))) END
    ) AS NVARCHAR(60))
  )) AS [PO번호],

  /* 23 자재투입여부 */
  LTRIM(RTRIM(CAST(l.MatInputYn AS NVARCHAR(20)))) AS [자재투입여부],

  /* 24 원자재단가 */
  CAST(l.RawMatPrice AS DECIMAL(18, 6)) AS [원자재단가],

  /* 25~27 품목 분류 — 컬럼 없으면 ItemCatLName 등으로 교체 */
  LTRIM(RTRIM(CAST(l.ItemKindLName AS NVARCHAR(200)))) AS [품목대분류],
  LTRIM(RTRIM(CAST(l.ItemKindMName AS NVARCHAR(200)))) AS [품목중분류],
  LTRIM(RTRIM(CAST(l.ItemKindSName AS NVARCHAR(200)))) AS [품목소분류],

  /* 28 최종작성일시 — LastDateTime 없으면 UpdDateTime, ModDateTime */
  CONVERT(NVARCHAR(50), l.LastDateTime, 120) AS [최종작성일시],

  /* 29 최종작성자 */
  LTRIM(RTRIM(l.LastWriterName)) AS [최종작성자],

  /* 30 전표번호 */
  LTRIM(RTRIM(CAST(l.SlipNo AS NVARCHAR(60)))) AS [전표번호]

FROM lined l
WHERE l.HYmd8 >= @FromYmd
  AND l.HYmd8 <= @ToYmd
ORDER BY l.HYmd8, l.OSPDelvInSeq, l.OSPDelvInSerl;
GO

/*
  ■ 자주 바꾸는 매핑 요약
  - 헤더 입고일·번호·키: OSPDelvInDate, OSPDelvInNo, OSPDelvInSeq  →  DelvInDate, DelvInNo, DelvInSeq
  - 라인 순번·키: OSPDelvInSerl → DelvInSerl
  - 납품/반품: OSPSMInKind → OSPInKind, SMInKind, DelvInKind …
  - 입고담당: h.EmpSeq → InEmpSeq, ChargeEmpSeq …
  - 수정자: h.ModEmpSeq → LastEmpSeq, UpdEmpSeq …
  - 발주 조인: _TPOSPPurOrder 없으면 _TPUPurOrder + PurOrderSeq/PurOrderNo 컬럼명 확인

  ■ 합계 행(엑셀 맨 위 TOTAL) 예시 — 필요 시 별도 실행
  ---------------------------------------------------------------------------
  ;WITH detail AS ( ... 위 SELECT 본문 ... )
  SELECT '합계' AS [외주입고번호], NULL AS [외주입고일], ...
         SUM([입고수량]) AS [입고수량], NULL AS [단가], SUM([금액]) AS [금액], ...
  FROM detail
  UNION ALL
  SELECT * FROM detail;
*/
