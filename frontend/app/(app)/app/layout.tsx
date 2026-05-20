import { AppSidebar } from '@/components/AppSidebar';
import { AppTopNav } from '@/components/AppTopNav';
import { getServerSession } from '@/lib/auth/session';

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSession();
  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppTopNav user={user} />
      <div className="flex min-h-0 flex-1">
        <AppSidebar />
        <main className="min-h-0 flex-1 overflow-auto bg-app-bg-subtle p-6">{children}</main>
      </div>
    </div>
  );
}
