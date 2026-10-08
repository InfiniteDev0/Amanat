import type { ReactNode } from 'react';

/** A step's title (Luxurious Roman, like the auth page) and one line under it. */
export function StepHeader({ title, hint }: { title: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-8 text-center">
      <h1 id="setup-step-title" className="hero text-4xl">{title}</h1>
      {hint ? <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{hint}</p> : null}
    </div>
  );
}
