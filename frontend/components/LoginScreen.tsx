import { Icon } from '@iconify/react';
import { LoginForm } from '@/app/(public)/login/LoginForm';
import { SoftLoginStyleBackdrop } from '@/components/SoftLoginStyleBackdrop';

export function LoginScreen() {
  return (
    <SoftLoginStyleBackdrop className="flex min-h-screen flex-col items-center justify-center px-4 py-16 sm:px-8">
      <div className="flex w-full max-w-[440px] flex-col items-center">
        <div className="mb-8 flex flex-col items-center text-center sm:mb-10">
          <div className="mb-5 flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-2xl bg-sky-100/90 shadow-md shadow-sky-900/5 ring-1 ring-sky-200/70 backdrop-blur-sm sm:h-28 sm:w-28">
            <Icon icon="mdi:email-fast-outline" className="h-14 w-14 text-sky-600 sm:h-16 sm:w-16" aria-hidden />
          </div>
          <h1 className="mb-2 text-center text-xl font-bold tracking-[0.14em] text-slate-900 sm:text-2xl">
            ERP INFO MAILER
          </h1>
        </div>

        <LoginForm />

        <p className="mt-10 text-center text-[11px] text-slate-500 sm:text-xs">SAMKWANG · Secure sign-in</p>
      </div>
    </SoftLoginStyleBackdrop>
  );
}
