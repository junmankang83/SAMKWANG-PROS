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
        <link rel="stylesheet" href="/samkwang-ui-kit.css" />
      </head>
      <body className="min-h-screen bg-app-bg text-app-text antialiased">
        <UiKitProvider>{children}</UiKitProvider>
      </body>
    </html>
  );
}
