import { APP_NAV_DOMAIN_IDS } from '@/lib/navigation/app-menu';

export type NavDomainVisibilityMap = Record<string, boolean>;

export function defaultNavVisibility(): NavDomainVisibilityMap {
  return Object.fromEntries(APP_NAV_DOMAIN_IDS.map((id) => [id, true])) as NavDomainVisibilityMap;
}

/** API·DB에서 온 값을 4개 도메인 키로 정규화(명시적 true/false) */
export function mergeNavVisibility(raw: Record<string, unknown> | null | undefined): NavDomainVisibilityMap {
  const out = defaultNavVisibility();
  if (raw && typeof raw === 'object') {
    for (const id of APP_NAV_DOMAIN_IDS) {
      if (Object.prototype.hasOwnProperty.call(raw, id)) {
        out[id] = Boolean((raw as Record<string, unknown>)[id]);
      }
    }
  }
  return out;
}
