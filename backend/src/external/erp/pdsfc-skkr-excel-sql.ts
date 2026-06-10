import { PDSFC_SKKR_EXCEL_COLUMNS } from './pdsfc-skkr-excel.columns';

function bracketIdent(name: string): string {
  return `[${name.replace(/\]/g, ']]')}]`;
}

export type SkkrSqlNv = (alias: string, col: string | null, width: number) => string;
export type SkkrSqlDec = (alias: string, col: string | null) => string;
export type SkkrSqlCoalesceWIt = (enabled: boolean, wColExpr: string, itExpr: string) => string;
export type SkkrSqlCoalesceWJoined = (enabled: boolean, wColExpr: string, joinedExpr: string) => string;

export type SkkrSqlBuildInput = {
  nv: SkkrSqlNv;
  dec: SkkrSqlDec;
  coalesceWIt: SkkrSqlCoalesceWIt;
  coalesceWJoined: SkkrSqlCoalesceWJoined;
  dateYmdExpr: string;
  hasItemJoin: boolean;
  hasEmpJoin: boolean;
  hasUnitJoin: boolean;
  hasWorkShopJoin: boolean;
  hasDeptJoin: boolean;
  hasEmpFinalJoin: boolean;
  itItemNo: string;
  itItemName: string;
  itSpec: string;
  uUnitName: string;
  empEmpName: string;
  empFinalName: string;
  wsShopName: string;
  itItemL: string | null;
  itItemM: string | null;
  itItemS: string | null;
  itAsset: string | null;
  w: 'w';
  finalWorkCol: string | null;
  mfgUnitPrice: string | null;
  prodAmount: string | null;
  goodAmount: string | null;
  defectAmount: string | null;
  stdUnitPrice: string | null;
  settleUnitPrice: string | null;
  defectCost: string | null;
  matRegenProc: string | null;
  scrapCost: string | null;
  workMinutes: string | null;
  manMinutes: string | null;
  loadMinutes: string | null;
  runMinutes: string | null;
  lossRate: string | null;
  plannedStopMin: string | null;
  stopLossMin: string | null;
  stdWorkTime: string | null;
  cavity: string | null;
  lossMinutes: string | null;
  shiftType: string | null;
  prodPlanNo: string | null;
  workKind: string | null;
  matInputYn: string | null;
  finalInspTarget: string | null;
  receiptYn: string | null;
  moldName: string | null;
  moldNo: string | null;
  revNo: string | null;
  poNo: string | null;
  processSeqCol: string | null;
  workplaceSingle: string | null;
  workplaceCode: string | null;
  workplaceName: string | null;
  processCode: string | null;
  processName: string | null;
  equipmentCode: string | null;
  equipmentName: string | null;
  equipSpec: string | null;
  itemNo: string | null;
  itemName: string | null;
  spec: string | null;
  unitName: string | null;
  instructQty: string | null;
  productionQty: string | null;
  goodQty: string | null;
  defectQty: string | null;
  workerName: string | null;
  workOrderNo: string | null;
  remark: string | null;
  deptName: string | null;
};

function itColExpr(hasItemJoin: boolean, col: string | null, width: number): string {
  if (!hasItemJoin || !col) return `CAST(NULL AS NVARCHAR(${width}))`;
  return `LTRIM(RTRIM(CAST(it.${bracketIdent(col)} AS NVARCHAR(${width}))))`;
}

function deptExpr(inp: SkkrSqlBuildInput): string {
  if (inp.hasDeptJoin) {
    return `COALESCE(NULLIF(LTRIM(RTRIM(CAST(d.DeptName AS NVARCHAR(200)))), N''), ${inp.nv(inp.w, inp.deptName, 200)})`;
  }
  return inp.nv(inp.w, inp.deptName, 200);
}

function workCenterExpr(inp: SkkrSqlBuildInput): string {
  const wn = inp.coalesceWJoined(inp.hasWorkShopJoin, inp.nv(inp.w, inp.workplaceName, 200), inp.wsShopName);
  return `COALESCE(NULLIF(${wn}, N''), ${inp.nv(inp.w, inp.workplaceSingle, 200)}, ${inp.nv(inp.w, inp.workplaceCode, 80)})`;
}

export function buildSkkrSelectParts(inp: SkkrSqlBuildInput): string {
  const w = inp.w;
  const workDateSql = `CONVERT(VARCHAR(10), TRY_CONVERT(DATE, ${inp.dateYmdExpr}, 112), 23)`;
  const finalWorkSql = inp.finalWorkCol
    ? `CONVERT(VARCHAR(19), TRY_CONVERT(datetime, LTRIM(RTRIM(CAST(${w}.${bracketIdent(inp.finalWorkCol)} AS NVARCHAR(30))))), 120)`
    : `CAST(NULL AS VARCHAR(19))`;

  const productNo = inp.coalesceWIt(inp.hasItemJoin, inp.nv(w, inp.itemNo, 120), inp.itItemNo);
  const productName = inp.coalesceWIt(inp.hasItemJoin, inp.nv(w, inp.itemName, 300), inp.itItemName);
  const productSpec = inp.coalesceWIt(inp.hasItemJoin, inp.nv(w, inp.spec, 400), inp.itSpec);
  const repWorker = inp.coalesceWJoined(inp.hasEmpJoin, inp.nv(w, inp.workerName, 120), inp.empEmpName);
  const finalWorker = inp.coalesceWJoined(inp.hasEmpFinalJoin, inp.nv(w, inp.workerName, 120), inp.empFinalName);

  const exprByKey: Record<string, string> = {
    choice: 'CAST(0 AS INT)',
    finalWorkAt: finalWorkSql,
    workDate: workDateSql,
    prodDept: deptExpr(inp),
    workCenter: workCenterExpr(inp),
    workOrderNo: inp.nv(w, inp.workOrderNo, 120),
    itemCatLarge: itColExpr(inp.hasItemJoin, inp.itItemL, 120),
    itemCatMid: itColExpr(inp.hasItemJoin, inp.itItemM, 120),
    itemCatSmall: itColExpr(inp.hasItemJoin, inp.itItemS, 120),
    productName,
    productNo,
    productSpec,
    processSeq: inp.nv(w, inp.processSeqCol, 40),
    process: (() => {
      const c = inp.nv(w, inp.processCode, 80);
      const n = inp.nv(w, inp.processName, 200);
      return `COALESCE(NULLIF(${n}, N''), NULLIF(${c}, N''), CAST(N'' AS NVARCHAR(200)))`;
    })(),
    itemAssetClass: itColExpr(inp.hasItemJoin, inp.itAsset, 120),
    instructQty: inp.dec(w, inp.instructQty),
    prodQty: inp.dec(w, inp.productionQty),
    goodQty: inp.dec(w, inp.goodQty),
    mfgUnitPrice: inp.dec(w, inp.mfgUnitPrice),
    prodAmount: inp.dec(w, inp.prodAmount),
    goodAmount: inp.dec(w, inp.goodAmount),
    defectAmount: inp.dec(w, inp.defectAmount),
    stdUnitPrice: inp.dec(w, inp.stdUnitPrice),
    settleUnitPrice: inp.dec(w, inp.settleUnitPrice),
    defectCost: inp.dec(w, inp.defectCost),
    matRegenProc: inp.dec(w, inp.matRegenProc),
    scrapCost: inp.dec(w, inp.scrapCost),
    workMinutes: inp.dec(w, inp.workMinutes),
    manMinutes: inp.dec(w, inp.manMinutes),
    loadMinutes: inp.dec(w, inp.loadMinutes),
    runMinutes: inp.dec(w, inp.runMinutes),
    lossRate: inp.dec(w, inp.lossRate),
    plannedStopMin: inp.dec(w, inp.plannedStopMin),
    stopLossMin: inp.dec(w, inp.stopLossMin),
    stdWorkTime: inp.nv(w, inp.stdWorkTime, 80),
    cavity: inp.dec(w, inp.cavity),
    lossMinutes: inp.dec(w, inp.lossMinutes),
    repWorker,
    shiftType: inp.nv(w, inp.shiftType, 40),
    prodPlanNo: inp.nv(w, inp.prodPlanNo, 80),
    workKind: inp.nv(w, inp.workKind, 80),
    matInputYn: inp.nv(w, inp.matInputYn, 40),
    finalInspTarget: inp.nv(w, inp.finalInspTarget, 40),
    receiptYn: inp.nv(w, inp.receiptYn, 40),
    moldName: inp.nv(w, inp.moldName, 200),
    moldNo: inp.nv(w, inp.moldNo, 120),
    revNo: inp.nv(w, inp.revNo, 40),
    poNo: inp.nv(w, inp.poNo, 80),
    equip: inp.nv(w, inp.equipmentName, 200),
    equipNo: inp.nv(w, inp.equipmentCode, 80),
    equipSpec: inp.nv(w, inp.equipSpec, 200),
    finalWorker,
  };

  return PDSFC_SKKR_EXCEL_COLUMNS.map((c) => `${exprByKey[c.key]} AS ${bracketIdent(c.key)}`).join(',\n        ');
}
