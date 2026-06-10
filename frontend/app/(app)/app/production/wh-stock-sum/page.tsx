import { WhStockSumInquiry } from '@/components/WhStockSumInquiry';

/** 창고별 재고조회와 동일: 상단·안내·여백을 제외한 한 화면 안에서 표만 스크롤 */
export default function WhStockSumPage() {
  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-0 flex-col gap-2">
      <h1 className="shrink-0 text-xl font-semibold text-app-text">창고별수불집계조회</h1>
      <p className="shrink-0 text-sm text-app-muted">
        조회 조건은 <strong className="text-app-text">조회시작일·조회종료일</strong>입니다. 기본은 ERP{' '}
        <code className="rounded bg-app-muted/20 px-1">Sp_StockSumListQuery_NQL</code> 등으로 집계합니다. 조회는{' '}
        <strong className="text-app-text">조회</strong> 버튼을 눌렀을 때만 실행됩니다.
      </p>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <WhStockSumInquiry />
      </div>
    </div>
  );
}
