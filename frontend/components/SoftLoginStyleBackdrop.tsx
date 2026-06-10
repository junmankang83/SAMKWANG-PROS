import type { ReactNode } from 'react';

type SoftLoginStyleBackdropProps = {
  children: ReactNode;
  /** 추가 Tailwind 클래스 (레이아웃·패딩 등) */
  className?: string;
};

/**
 * 로그인 화면과 동일한 밝은 그라데이션·그리드·글로우 배경.
 */
export function SoftLoginStyleBackdrop({ children, className = '' }: SoftLoginStyleBackdropProps) {
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-sky-50/90 ${className}`.trim()}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(15,23,42,0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(15,23,42,0.06) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      <div className="pointer-events-none absolute -left-24 top-[18%] h-80 w-80 rounded-full bg-indigo-200/55 blur-[100px]" />
      <div className="pointer-events-none absolute -right-16 bottom-[12%] h-96 w-96 rounded-full bg-sky-200/50 blur-[110px]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[120%] -translate-x-1/2 bg-gradient-to-b from-white/80 to-transparent" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
