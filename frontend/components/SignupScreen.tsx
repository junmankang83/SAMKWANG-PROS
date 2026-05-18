import { SignupForm } from '@/app/(public)/signup/SignupForm';

export function SignupScreen() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <SignupForm />
    </div>
  );
}
