import { SparePartsInventory } from '@/components/SparePartsInventory';

export default function SparePartsInventoryPage() {
  return (
    <SparePartsInventory
      filterMode="asOfDate"
      description="기준일 시점까지의 전체 입·출고 수불을 합산해 재고 수량을 표시합니다."
    />
  );
}
