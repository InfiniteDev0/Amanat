import type { ReactNode } from 'react';

/** The column every auth page after the first uses: a title, a line under it, then the form. */
export function AuthStep({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-100 pt-[6vh] pb-24">
      <h1 className="font-heading text-center text-3xl font-bold tracking-tight">{title}</h1>
      {subtitle ? <p className="text-muted-foreground mt-2 text-center text-sm leading-relaxed">{subtitle}</p> : null}
      <div className="mt-8">{children}</div>
    </div>
  );
}
