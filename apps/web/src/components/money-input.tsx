'use client';

import type { InputHTMLAttributes } from 'react';

/**
 * A money box that writes the commas as you type: 1250000 shows as 1,250,000.
 * `value` and `onChange` carry the plain figure ("1250000.5"): digits and one
 * point, at most two places after it, never below zero.
 */

/** "1250000.5" → "1,250,000.5", keeping a point or zeros still being typed. */
export function groupDigits(raw: string): string {
  const [whole = '', ...rest] = raw.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return rest.length ? `${grouped}.${rest.join('')}` : grouped;
}

/** What was typed, as a plain figure: commas and anything else dropped, one point, two places. */
export function plainFigure(typed: string): string {
  const cleaned = typed.replace(/[^\d.]/g, '');
  const at = cleaned.indexOf('.');
  if (at === -1) return cleaned.replace(/^0+(?=\d)/, '');
  const whole = cleaned.slice(0, at).replace(/^0+(?=\d)/, '');
  const cents = cleaned.slice(at + 1).replace(/\./g, '').slice(0, 2);
  return `${whole || '0'}.${cents}`;
}

export function MoneyInput({
  value,
  onChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> & { value: string; onChange: (plain: string) => void }) {
  return <input {...props} type="text" inputMode="decimal" autoComplete="off" dir="ltr" value={groupDigits(value)} onChange={(event) => onChange(plainFigure(event.target.value))} />;
}
