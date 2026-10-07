'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/** "I have read and agree to the Terms and Risk statements", with a filled tick box. */
export function TermsField({
  id,
  checked,
  onChange,
  error,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string | null;
}) {
  const t = useTranslations('auth');
  return (
    <Field data-invalid={Boolean(error)} className="gap-1.5">
      <FieldLabel htmlFor={id} className="text-foreground cursor-pointer gap-3 font-normal">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cn(
            'bg-field peer-focus-visible:bg-field-focus text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-md transition-colors',
            checked && 'bg-primary peer-focus-visible:bg-primary',
          )}
        >
          {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
        </span>
        <span>
          {t.rich('terms', {
            link: (chunks) => (
              <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:opacity-80">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </FieldLabel>
      <FieldError id={`${id}-error`} className="text-xs">
        {error}
      </FieldError>
    </Field>
  );
}
