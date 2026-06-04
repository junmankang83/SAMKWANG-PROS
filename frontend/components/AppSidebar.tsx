'use client';

import { Card, CardContent, CardDescription, List, ListHeader, ListItem } from '@samkwang/ui-kit';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { domainFromPathname } from '@/lib/navigation/app-menu';
import { MailSendingMenuStatusNav } from '@/components/MailSendingMenuStatusNav';

export function AppSidebar() {
  const pathname = usePathname();
  const domain = domainFromPathname(pathname);

  if (!domain) {
    return (
      <aside className="w-56 shrink-0 border-r border-app-border bg-app-surface p-3 print:hidden" aria-label="서브 메뉴">
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
    <aside className="w-56 shrink-0 border-r border-app-border bg-app-surface p-3 print:hidden" aria-label="서브 메뉴">
      <List variant="contained" className="rounded-md border border-app-border bg-app-surface-02 p-1">
        <ListHeader className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-app-muted">
          {domain.icon ? (
            <Icon icon={domain.icon} className="h-4 w-4 shrink-0 text-app-muted" aria-hidden />
          ) : null}
          <span>{domain.label}</span>
        </ListHeader>
        {domain.items.map((item) => {
          if (item.mailMenuAccordion) {
            return <MailSendingMenuStatusNav key={item.href} />;
          }
          const active = pathname === item.href;
          if (item.disabled) {
            return (
              <ListItem key={item.href} disabled className="cursor-not-allowed opacity-50">
                <span className="inline-flex w-full items-center gap-2">
                  {item.icon ? <Icon icon={item.icon} className="h-4 w-4 shrink-0" aria-hidden /> : null}
                  {item.label}
                </span>
              </ListItem>
            );
          }
          return (
            <ListItem key={item.href} active={active} interactive>
              <Link href={item.href} className="inline-flex w-full items-center gap-2 text-inherit no-underline">
                {item.icon ? (
                  <Icon
                    icon={item.icon}
                    className={`h-4 w-4 shrink-0 ${active ? 'text-brand' : 'text-app-muted'}`}
                    aria-hidden
                  />
                ) : null}
                {item.label}
              </Link>
            </ListItem>
          );
        })}
      </List>
    </aside>
  );
}
