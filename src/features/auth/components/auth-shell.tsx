import type * as React from "react";

import { BrandLogo } from "@/shared/ui/brand";
import { LocaleSwitcher } from "@/shared/ui/locale-switcher";

/** Centered card for sign-in flows; mobile-first, no app chrome. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <BrandLogo className="w-60 sm:w-72" />
      <div className="rounded-card border-border bg-surface shadow-pop relative w-full max-w-sm overflow-hidden border p-6 pt-7">
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 [background:var(--brand-rule)]" />
        <h1 className="text-center text-xl font-semibold">{title}</h1>
        {subtitle && <p className="text-muted mt-1 text-center text-sm">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
      {footer && <div className="text-muted text-sm">{footer}</div>}
      <LocaleSwitcher />
    </main>
  );
}
