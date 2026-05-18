import { redirect } from 'next/navigation';

/** @deprecated 이전 경로 — 재고현황으로 이동 */
export default function SparePartsLegacyPage() {
  redirect('/app/production/inventory');
}
