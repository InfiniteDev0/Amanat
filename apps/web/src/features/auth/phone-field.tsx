'use client';

import type { CountryCode } from 'libphonenumber-js';
import { Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';

import { Flag } from '@/components/flag';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/motion/select';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { directionOf } from '@/i18n/routing';

import { dialCode, matchesCountry, PINNED_COUNTRIES, type PhoneCountry, phoneCountries } from './countries';
import type { PhoneInput } from './schemas';

/**
 * Country (flag + dial code) and number in one filled field. The country list
 * has a search (name, code or dial code), the usual countries first, then
 * every other country. Dial code and number read left to right in every
 * language; the list follows the page direction.
 */
export function PhoneField({
  id,
  value,
  onChange,
  onBlur,
  error,
  disabled,
}: {
  id: string;
  value: PhoneInput;
  onChange: (value: PhoneInput) => void;
  onBlur?: () => void;
  /** Already translated. */
  error?: string | null;
  disabled?: boolean;
}) {
  const t = useTranslations('auth');
  const [open, setOpen] = useState(false);
  const pick = (country: CountryCode) => onChange({ ...value, country });

  return (
    <Field data-invalid={Boolean(error)} className="gap-1.5">
      <FieldLabel htmlFor={id} className="sr-only">
        {t('phone')}
      </FieldLabel>
      <InputGroup dir="ltr">
        <InputGroupAddon className="h-full py-0 ps-0">
          {/* `static`: the list opens across the whole field, not under the flag. */}
          <Select
            value={value.country}
            onValueChange={(country) => pick(country as CountryCode)}
            open={open}
            onOpenChange={setOpen}
            disabled={disabled}
            className="static h-full"
          >
            <SelectTrigger className="text-foreground h-full w-auto gap-1.5 rounded-none bg-transparent ps-4 pe-0 font-normal focus-visible:bg-transparent">
              <span className="sr-only">{t('country')}: </span>
              <span className="flex items-center gap-2">
                <Flag code={value.country} />
                <span className="tabular-nums">+{dialCode(value.country)}</span>
              </span>
            </SelectTrigger>
            <SelectContent>
              {/* Built only while open: ~240 countries, named in the browser's language. */}
              {open ? <CountryOptions selected={value.country} onPick={(country) => { pick(country); setOpen(false); }} /> : null}
            </SelectContent>
          </Select>
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={t('phone')} // neutral: an example number would hint at one country
          value={value.number}
          onChange={(event) => onChange({ ...value, number: event.target.value })}
          onBlur={onBlur}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="tabular-nums"
        />
      </InputGroup>
      <FieldError id={`${id}-error`} className="text-xs">
        {error}
      </FieldError>
    </Field>
  );
}

function CountryOptions({ selected, onPick }: { selected: CountryCode; onPick: (country: CountryCode) => void }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const countries = useMemo(() => phoneCountries(locale), [locale]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, []);

  const searching = query.trim() !== '';
  const matches = countries.filter((country) => matchesCountry(country, query));
  const pinned = PINNED_COUNTRIES.map((iso) => countries.find((c) => c.iso === iso)).filter((c) => c !== undefined);
  const rest = countries.filter((c) => !PINNED_COUNTRIES.includes(c.iso));

  // Enter picks the first match instead of submitting the form around us.
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const first = searching ? matches[0] : pinned[0];
    if (first) onPick(first.iso);
  };

  return (
    <div dir={directionOf(locale)}>
      <div className="bg-field mb-1 flex h-10 items-center gap-2 rounded-lg px-3">
        <Search className="text-muted-foreground size-4 shrink-0" />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('searchCountry')}
          aria-label={t('searchCountry')}
          autoComplete="off"
          className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      <div className="scrollbar-pill max-h-64 overflow-y-auto">
        {searching ? (
          matches.length ? (
            matches.map((country) => <CountryOption key={country.iso} country={country} selected={selected} />)
          ) : (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">{t('noResults')}</p>
          )
        ) : (
          <>
            {pinned.map((country) => (
              <CountryOption key={country.iso} country={country} selected={selected} />
            ))}
            <div aria-hidden className="bg-foreground/10 mx-2 my-1 h-px" />
            {rest.map((country) => (
              <CountryOption key={country.iso} country={country} selected={selected} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function CountryOption({ country, selected }: { country: PhoneCountry; selected: CountryCode }) {
  return (
    <SelectItem value={country.iso} className={country.iso === selected ? 'text-foreground' : undefined}>
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <Flag code={country.iso} />
        <span className="truncate">{country.name}</span>
        <span dir="ltr" className="text-muted-foreground ms-auto tabular-nums">
          +{country.dial}
        </span>
      </span>
    </SelectItem>
  );
}
