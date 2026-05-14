import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';

export default async function AuthenticatedGroupLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSession();
  if (!user) {
    redirect('/login');
  }
  return <>{children}</>;
}
