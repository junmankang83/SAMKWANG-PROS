import { redirect } from 'next/navigation';

export default function ProductionHomePage() {
  redirect('/app/production/spare-parts');
}
