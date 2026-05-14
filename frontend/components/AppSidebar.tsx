'use client';

import { Card, CardContent, CardDescription, List, ListHeader, ListItem } from '@samkwang/ui-kit';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { domainFromPathname } from '@/lib/navigation/app-menu';

export function AppSidebar() {
  const pathname = usePathname();
  const domain = domainFromPathname(pathname);

  if (!domain) {
    return (
      <aside className="w-56 shrink-0 border-r border-app-border bg-app-surface p-3" aria-label="서브 메뉴">
        <Card className="border-app-border shadow-none">
          <CardContent className="p-3 pt-4">
            <CardDescription className="text-sm">
              메뉴를 보려면 상단에서 영역을 선택하세요.
            </CardDescription>
          </CardContent>
        </Card>
      </aside>
    );
  }

  return (
    <aside className="w-56 shrink-0 border-r border-app-border bg-app-surface p-3" aria-label="서브 메뉴">
      <List variant="contained" className="rounded-md border border-app-border bg-app-surface-02 p-1">
        <ListHeader className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-app-muted">
          {domain.label}
        </ListHeader>
        {domain.items.map((item) => {
          const active = pathname === item.href;
          if (item.disabled) {
            return (
              <ListItem key={item.href} disabled className="cursor-not-allowed opacity-50">
                {item.label}
              </ListItem>
            );
          }
          return (
            <ListItem key={item.href} active={active} interactive>
              <Link href={item.href} className="block w-full text-inherit no-underline">
                {item.label}
              </Link>
            </ListItem>
          );
        })}
      </List>
    </aside>
  );
}
