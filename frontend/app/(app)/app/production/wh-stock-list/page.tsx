import { WhStockListInquiry } from '@/components/WhStockListInquiry';

/** 상단·여백을 빼고 남은 높이 안에서만 표가 스크롤되도록(가로 스크롤바가 화면 하단 근처에 유지) */
export default function WhStockListPage() {
  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-0 flex-col gap-2">
      <h1 className="shrink-0 text-xl font-semibold">창고별 재고조회</h1>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <WhStockListInquiry />
      </div>
    </div>
  );
}
