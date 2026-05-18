export type AppMenuItem = {
  label: string;
  href: string;
  disabled?: boolean;
};

export type AppDomainMenu = {
  id: string;
  label: string;
  basePath: string;
  items: AppMenuItem[];
};

export const APP_DOMAINS: AppDomainMenu[] = [
  {
    id: 'master-data',
    label: '기준정보',
    basePath: '/app/master-data',
    items: [
      { label: '사용자 관리', href: '/app/master-data/users' },
      { label: '부품정보관리', href: '/app/master-data/spare-parts' },
    ],
  },
  {
    id: 'production',
    label: '부품관리',
    basePath: '/app/production',
    items: [
      { label: '부품입고', href: '/app/production/inbound' },
      { label: '부품출고', href: '/app/production/outbound' },
      { label: '재고현황', href: '/app/production/inventory' },
    ],
  },
  {
    id: 'mold',
    label: '금형관리',
    basePath: '/app/mold',
    items: [{ label: '준비 중', href: '/app/mold', disabled: true }],
  },
];

export function domainFromPathname(pathname: string): AppDomainMenu | undefined {
  return APP_DOMAINS.find((d) => pathname === d.basePath || pathname.startsWith(`${d.basePath}/`));
}
