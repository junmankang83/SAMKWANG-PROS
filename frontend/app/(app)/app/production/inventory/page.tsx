import { SparePartsInventory } from '@/components/SparePartsInventory';

export default function SparePartsInventoryPage() {
  return (
    <SparePartsInventory
      filterMode="asOfDate"
      description="기준일까지의 입·출고 수불을 제품(부품코드)별로 합산하며, 현재재고가 0인 품목은 표시하지 않습니다."
    />
  );
}
