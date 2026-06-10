import { AppSidebar } from '@/components/AppSidebar';
import { AppTopNav } from '@/components/AppTopNav';
import { NavDomainGuard } from '@/components/NavDomainGuard';
import { NavVisibilityProvider } from '@/components/NavVisibilityContext';
import { getServerSession } from '@/lib/auth/session';
import { loadNavDomainVisibility } from '@/lib/nav-visibility-server';
import { redirect } from 'next/navigation';

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSession();
  if (!user) {
    redirect('/login');
  }

  const navVisibility = await loadNavDomainVisibility();

  return (
    <NavVisibilityProvider initial={navVisibility}>
      <div className="flex min-h-screen flex-col">
        <AppTopNav user={user} />
        <NavDomainGuard />
        <div className="flex min-h-0 flex-1">
          <AppSidebar />
          <main className="min-h-0 flex-1 overflow-auto bg-app-bg-subtle p-6 print:bg-white print:p-3">{children}</main>
        </div>
      </div>
    </NavVisibilityProvider>
  );
}
