import { MoldAnnualInspectionPlanReport } from '@/components/MoldAnnualInspectionPlanReport';
import { getServerSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export default async function MoldAnnualInspectionPlanPage() {
  const user = await getServerSession();
  if (!user) {
    redirect('/login');
  }
  return <MoldAnnualInspectionPlanReport user={user} />;
}
