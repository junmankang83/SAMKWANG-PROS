import { SparePartsInventory } from '@/components/SparePartsInventory';

export default function SparePartsLedgerPage() {
  return (
    <SparePartsInventory
      filterMode="inboundDateRange"
      title="부품 입출고 대장"
      emptyMessage="표시할 내역이 없습니다. 부품입고에서 입고를 등록하면 여기에 반영됩니다."
    />
  );
}
