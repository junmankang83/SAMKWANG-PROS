import { AppSidebar } from '@/components/AppSidebar';
import { AppTopNav } from '@/components/AppTopNav';

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppTopNav />
      <div className="flex min-h-0 flex-1">
        <AppSidebar />
        <main className="min-h-0 flex-1 overflow-auto bg-app-bg-subtle p-6">{children}</main>
      </div>
    </div>
  );
}
