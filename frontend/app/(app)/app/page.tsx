import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@samkwang/ui-kit';
import Link from 'next/link';
import { APP_DOMAINS } from '@/lib/navigation/app-menu';

export default function AppHomePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold text-app-text">시작 화면</h1>
      <p className="mt-1 text-sm text-app-muted">
        상단 메뉴에서 업무 영역을 선택한 뒤 왼쪽 서브메뉴로 이동하세요.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {APP_DOMAINS.map((d) => {
          const first = d.items.find((i) => !i.disabled);
          const href = first?.href ?? d.basePath;
          return (
            <li key={d.id}>
              <Link href={href} className="block no-underline">
                <Card className="h-full shadow-card transition-shadow hover:shadow-card-hover">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{d.label}</CardTitle>
                    <CardDescription>{d.items.map((i) => i.label).join(' · ')}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-app-muted">바로가기 →</CardContent>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
