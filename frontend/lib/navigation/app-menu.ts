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
    id: 'production',
    label: '생산관리',
    basePath: '/app/production',
    items: [{ label: '사출기 예비부품 입출고', href: '/app/production/spare-parts' }],
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
