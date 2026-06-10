export type AppMenuItem = {
  label: string;
  href: string;
  disabled?: boolean;
  /** Iconify icon id (예: `mdi:home`) */
  icon?: string;
  /**
   * true: 메일 도메인에서만 사용. 메뉴관리 API로 받은 목록을 아코디언 하위 링크로 표시.
   * href는 상위 경로(예: `/app/mail/sending-menu`)로 유지.
   */
  mailMenuAccordion?: boolean;
};

export type AppDomainMenu = {
  id: string;
  label: string;
  basePath: string;
  /** 상단 주메뉴·사이드 헤더용 Iconify id */
  icon?: string;
  items: AppMenuItem[];
};

export const APP_DOMAINS: AppDomainMenu[] = [
  {
    id: 'master-data',
    label: '기준정보',
    basePath: '/app/master-data',
    icon: 'mdi:database-cog-outline',
    items: [
      { label: '기준정보관리', href: '/app/master-data/standard-info', icon: 'mdi:file-certificate-outline' },
      { label: '사용자 관리', href: '/app/master-data/users', icon: 'mdi:account-multiple-outline' },
      { label: '설비정보관리', href: '/app/master-data/tools', icon: 'mdi:wrench-outline' },
      { label: '부품정보관리', href: '/app/master-data/spare-parts', icon: 'mdi:cog-outline' },
      { label: '메뉴관리', href: '/app/master-data/app-menu', icon: 'mdi:view-dashboard-outline' },
    ],
  },
  {
    id: 'production',
    label: '부품관리',
    basePath: '/app/production',
    icon: 'mdi:package-variant',
    items: [
      { label: '부품입고', href: '/app/production/inbound', icon: 'mdi:tray-arrow-down' },
      { label: '부품출고', href: '/app/production/outbound', icon: 'mdi:tray-arrow-up' },
      { label: '부품 입출고 대장', href: '/app/production/ledger', icon: 'mdi:book-open-page-variant-outline' },
      { label: '재고현황', href: '/app/production/inventory', icon: 'mdi:archive-outline' },
      { label: '이동품목조회', href: '/app/production/lg-inout-move-items', icon: 'mdi:truck-delivery-outline' },
    ],
  },
  {
    id: 'mold',
    label: '설비관리',
    basePath: '/app/mold',
    icon: 'mdi:factory',
    items: [
      { label: '기준정보관리', href: '/app/mold/base-info', icon: 'mdi:folder-cog-outline' },
      { label: '점검항목관리', href: '/app/mold/inspection-items', icon: 'mdi:format-list-checks' },
      { label: '설비점검계획등록', href: '/app/mold/inspection-plans', icon: 'mdi:calendar-clock' },
      { label: '설비점검실적내역등록', href: '/app/mold/inspection-records', icon: 'mdi:clipboard-text-clock-outline' },
      { label: '연간설비점검계획서', href: '/app/mold/annual-inspection-plan', icon: 'mdi:file-chart-outline' },
    ],
  },
  {
    id: 'mail',
    label: '메일발송관리',
    basePath: '/app/mail',
    icon: 'mdi:email-send-outline',
    items: [
      { label: '메일설정', href: '/app/mail/settings', icon: 'mdi:email-outline' },
      { label: '메일 메뉴관리', href: '/app/mail/menu-admin', icon: 'mdi:book-cog-outline' },
      { label: '메일발송관리', href: '/app/mail/sending-menu-admin', icon: 'mdi:playlist-edit' },
      { label: '메일발송정보', href: '/app/mail/sending-info', icon: 'mdi:card-account-details-outline' },
      { label: '메일발송메뉴현황', href: '/app/mail/sending-menu', icon: 'mdi:email-multiple-outline', mailMenuAccordion: true },
    ],
  },
];

export function domainFromPathname(pathname: string): AppDomainMenu | undefined {
  return APP_DOMAINS.find((d) => pathname === d.basePath || pathname.startsWith(`${d.basePath}/`));
}

/** 상단 주메뉴 도메인 id — `APP_DOMAINS` 순서와 동기 */
export const APP_NAV_DOMAIN_IDS = APP_DOMAINS.map((d) => d.id) as readonly string[];
