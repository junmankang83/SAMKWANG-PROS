import { SparePartsInventory } from '@/components/SparePartsInventory';

export default function SparePartsLedgerPage() {
  return (
    <SparePartsInventory
      filterMode="inboundDateRange"
      title="부품 입출고 대장"
      description="입고시작일자~입고종료일자 기간의 입·출고 수량과 현재 재고를 표시합니다."
      emptyMessage="표시할 내역이 없습니다. 부품입고에서 입고를 등록하면 여기에 반영됩니다."
    />
  );
}
