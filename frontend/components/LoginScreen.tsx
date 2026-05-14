import { LoginForm } from '@/app/(public)/login/LoginForm';

export function LoginScreen() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <LoginForm />
    </div>
  );
}
