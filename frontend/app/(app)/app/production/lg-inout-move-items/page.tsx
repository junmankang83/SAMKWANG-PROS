import { LgInoutMoveItemInquiry } from '@/components/LgInoutMoveItemInquiry';

export default function LgInoutMoveItemsPage() {
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold text-app-text">이동품목조회</h1>
      <p className="text-sm text-app-muted">
        ERP `_TLGInoutDaily`·`_TLGInoutDailyItem`, InOutType=80(이동). 기본 조회일 2024-06-01~2024-06-08.
      </p>
      <LgInoutMoveItemInquiry />
    </div>
  );
}
