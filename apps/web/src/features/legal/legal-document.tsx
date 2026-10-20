import type { ReactNode } from 'react';
import Markdown from 'react-markdown';

// One of docs/legal/*.md as a readable page section. The Markdown is ours (in
// git), and react-markdown renders it without raw HTML.

const COMPONENTS = {
  h1: ({ children }: { children?: ReactNode }) => <h2 className="font-heading text-2xl font-bold tracking-tight">{children}</h2>,
  h2: ({ children }: { children?: ReactNode }) => <h3 className="font-heading mt-8 text-lg font-semibold">{children}</h3>,
  p: ({ children }: { children?: ReactNode }) => <p className="text-foreground/85 mt-3 leading-relaxed">{children}</p>,
  ol: ({ children }: { children?: ReactNode }) => <ol className="text-foreground/85 mt-3 list-decimal space-y-2 ps-6 leading-relaxed">{children}</ol>,
  ul: ({ children }: { children?: ReactNode }) => <ul className="text-foreground/85 mt-3 list-disc space-y-2 ps-6 leading-relaxed">{children}</ul>,
  strong: ({ children }: { children?: ReactNode }) => <strong className="text-foreground font-semibold">{children}</strong>,
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:opacity-80">
      {children}
    </a>
  ),
  hr: () => <hr className="border-foreground/10 my-8" />,
};

export function LegalDocument({ id, markdown }: { id: string; markdown: string }) {
  return (
    // The documents are in English, so they read left to right on the Arabic page too.
    <section id={id} dir="ltr" lang="en" className="scroll-mt-6 text-start">
      <Markdown components={COMPONENTS}>{markdown}</Markdown>
    </section>
  );
}
