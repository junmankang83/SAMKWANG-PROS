import './globals.css';
import type { Metadata } from 'next';
import { UiKitProvider } from '@/components/UiKitProvider';

export const metadata: Metadata = {
  title: 'SAMKWANG-PROS',
  description: '생산관리시스템 (Production Management System)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {/* PostCSS 미처리 정적 CSS — ui-kit(TW v4)을 앱(TW v3)과 분리 */}
        <link rel="stylesheet" href="/samkwang-ui-kit.css" precedence="high" />
      </head>
      <body className="min-h-screen bg-app-bg text-app-text antialiased">
        <UiKitProvider>{children}</UiKitProvider>
      </body>
    </html>
  );
}
