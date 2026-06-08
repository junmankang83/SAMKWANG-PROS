/*
  이동품목조회 (검증용)
  - dbo._TLGInoutDaily(h) + dbo._TLGInoutDailyItem(i)
  - 기간: h.InOutDate (YYYYMMDD 정규화)
  - 헤더·라인 모두 InOutType = 80 (한쪽만 있으면 그쪽만 = 80)
  테이블/컬럼명이 다르면 INFORMATION_SCHEMA로 확인 후 수정.
*/

SET NOCOUNT ON;

DECLARE @CompanySeq INT = 1;          /* 필요 없으면 WHERE에서 제거 */
DECLARE @FromYmd   CHAR(8) = '20240401';
DECLARE @ToYmd     CHAR(8) = '20240430';

;WITH hdt AS (
  SELECT
    h.CompanySeq,
    h.LGInoutDailySeq,
    CASE
      WHEN TRY_CONVERT(datetime, h.InOutDate, 112) IS NOT NULL
        THEN CONVERT(CHAR(8), TRY_CONVERT(datetime, h.InOutDate, 112), 112)
      WHEN TRY_CONVERT(datetime, h.InOutDate) IS NOT NULL
        THEN CONVERT(CHAR(8), TRY_CONVERT(datetime, h.InOutDate), 112)
      ELSE RIGHT(N'00000000' + LTRIM(RTRIM(CAST(h.InOutDate AS NVARCHAR(30)))), 8)
    END AS MoveYmd8
  FROM dbo._TLGInoutDaily h
  WHERE h.CompanySeq = @CompanySeq
    AND TRY_CONVERT(int, LTRIM(RTRIM(CAST(h.InOutType AS NVARCHAR(30))))) = 80
)
SELECT TOP 5000
  h.MoveYmd8,
  i.LGInoutDailySerl,
  i.ItemSeq,
  i.Qty
FROM hdt h
INNER JOIN dbo._TLGInoutDailyItem i
  ON i.CompanySeq = h.CompanySeq AND i.LGInoutDailySeq = h.LGInoutDailySeq
WHERE TRY_CONVERT(int, LTRIM(RTRIM(CAST(i.InOutType AS NVARCHAR(30))))) = 80
  AND h.MoveYmd8 >= @FromYmd
  AND h.MoveYmd8 <= @ToYmd
ORDER BY h.MoveYmd8, h.LGInoutDailySeq, i.LGInoutDailySerl;
GO
