import './globals.css';
import type { Metadata } from 'next';

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
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
