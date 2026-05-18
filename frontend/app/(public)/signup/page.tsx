import { redirect } from 'next/navigation';
import { SignupScreen } from '@/components/SignupScreen';
import { getServerSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  if (await getServerSession()) {
    redirect('/app');
  }

  return <SignupScreen />;
}
