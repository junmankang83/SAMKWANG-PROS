'use client';

import { TooltipProvider } from '@samkwang/ui-kit';

export function UiKitProvider({ children }: { children: React.ReactNode }) {
  return <TooltipProvider delayDuration={300}>{children}</TooltipProvider>;
}
