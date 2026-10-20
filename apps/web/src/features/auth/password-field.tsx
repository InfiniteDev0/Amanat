'use client';

import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ComponentProps, useState } from 'react';

import { Field, FieldLabel } from '@/components/ui/field';
import { FieldAlert } from '@/components/ui/field-alert';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { cn } from '@/lib/utils';

import { passwordStrength } from './password-strength';

/** One colour for all the lit bars, by how many are lit: red, orange, yellow, green. */
const BAR_COLOURS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];

/**
 * A filled password field like TextField, with show / hide at the end. For a
 * new password (`meter`), once something is typed: four bars and how strong
 * it is, plus the rule while the password doesn't meet it yet (the same rule
 * the server applies).
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
  const showMeter = meter && strength !== null;
  const describedBy = [error ? `${id}-error` : null, showMeter ? `${id}-strength` : null].filter(Boolean).join(' ') || undefined;

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

      {showMeter ? (
        // Below the error bubble while there is one (it floats), so they never overlap.
        <div className={cn('animate-in fade-in-0 slide-in-from-top-1 flex flex-col gap-1.5 pt-1 duration-200', error && 'mt-10')}>
          <div aria-hidden className="flex gap-1">
            {[0, 1, 2, 3].map((bar) => (
              <span
                key={bar}
                className={cn('h-1 flex-1 rounded-full transition-colors', bar < strength.bars ? BAR_COLOURS[strength.bars - 1] : 'bg-foreground/10')}
              />
            ))}
          </div>
          <p id={`${id}-strength`} aria-live="polite" className="text-muted-foreground text-xs">
            <span className="text-foreground font-medium">{t(`strength.${strength.label}`)}</span>
            {strength.allowed ? null : ` · ${t('passwordRule')}`}
          </p>
        </div>
      ) : null}
    </div>
  );
}
