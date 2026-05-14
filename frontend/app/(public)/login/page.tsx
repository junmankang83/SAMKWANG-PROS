import { redirect } from 'next/navigation';
import { LoginScreen } from '@/components/LoginScreen';
import { getServerSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await getServerSession()) {
    redirect('/app');
  }

  return <LoginScreen />;
}
