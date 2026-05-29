import { redirect } from 'next/navigation';

export default function MailHomePage() {
  redirect('/app/mail/settings');
}
