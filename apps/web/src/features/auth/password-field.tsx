'use client';

import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ComponentProps, useState } from 'react';

import { Field, FieldLabel } from '@/components/ui/field';
import { FieldAlert } from '@/components/ui/field-alert';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { cn } from '@/lib/utils';

import { passwordStrength, type Strength } from './password-strength';

const LEVELS = ['weak', 'weak', 'fair', 'good', 'strong'] as const;
const BAR_COLOUR: Record<Strength, string> = {
  0: 'bg-foreground/10',
  1: 'bg-destructive',
  2: 'bg-amber-500',
  3: 'bg-emerald-500',
  4: 'bg-emerald-500',
};

/**
 * A filled password field like TextField, with show / hide at the end. For a
 * new password (`meter`), a four-bar strength meter and the rule under it:
 * the same rule the server applies, so the meter never promises what the
 * server refuses.
 */
export function PasswordField({
  id,
  label,
  error,
  meter = false,
  value,
  ...input
}: {
  id: string;
  label: string;
  /** Already translated. */
  error?: string | null;
  meter?: boolean;
  value: string;
} & Omit<ComponentProps<typeof InputGroupInput>, 'id' | 'placeholder' | 'type' | 'value'>) {
  const t = useTranslations('auth');
  const [shown, setShown] = useState(false);
  const strength = passwordStrength(value);
  const describedBy = [error ? `${id}-error` : null, meter ? `${id}-rule` : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-2">
      <Field data-invalid={Boolean(error)} className="relative">
        <FieldLabel htmlFor={id} className="sr-only">
          {label}
        </FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <LockKeyhole />
          </InputGroupAddon>
          <InputGroupInput
            {...input}
            id={id}
            value={value}
            type={shown ? 'text' : 'password'}
            placeholder={label}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              onClick={() => setShown((now) => !now)}
              aria-label={shown ? t('hidePassword') : t('showPassword')}
              aria-pressed={shown}
              className="text-muted-foreground hover:text-foreground rounded-lg"
            >
              {shown ? <EyeOff /> : <Eye />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <FieldAlert id={`${id}-error`}>{error}</FieldAlert>
      </Field>

      {meter ? (
        // Below the error bubble while there is one (it floats), so they never overlap.
        <div className={cn('flex flex-col gap-1.5 px-1', error && 'mt-10')}>
          <div aria-hidden className="flex gap-1.5">
            {[1, 2, 3, 4].map((bar) => (
              <span
                key={bar}
                className={cn('h-1 flex-1 rounded-full transition-colors', strength >= bar ? BAR_COLOUR[strength] : 'bg-foreground/10')}
              />
            ))}
          </div>
          <p id={`${id}-rule`} className="text-muted-foreground flex justify-between gap-3 text-xs">
            <span>{t('passwordRule')}</span>
            {strength > 0 ? <span className="text-foreground shrink-0 font-medium">{t(`strength.${LEVELS[strength]}`)}</span> : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}
