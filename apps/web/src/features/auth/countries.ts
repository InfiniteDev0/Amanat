import { type CountryCode, getCountries, getCountryCallingCode } from 'libphonenumber-js';

/** Shown first in the country list, in this order (the spec's default, Kenya, leads). */
export const PINNED_COUNTRIES: CountryCode[] = ['KE', 'SO', 'ET', 'DJ', 'UG', 'TZ', 'AE', 'SA', 'GB', 'US'];

export const DEFAULT_COUNTRY: CountryCode = 'KE';

export interface PhoneCountry {
  iso: CountryCode;
  dial: string;
  /** In the user's language, from the browser (Intl.DisplayNames). */
  name: string;
}

/** Every country libphonenumber knows, named in `locale` and sorted by name. */
export function phoneCountries(locale: string): PhoneCountry[] {
  const names = new Intl.DisplayNames([locale], { type: 'region' });
  const collator = new Intl.Collator(locale);
  return getCountries()
    .map((iso) => ({ iso, dial: getCountryCallingCode(iso), name: names.of(iso) ?? iso }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

export function dialCode(country: CountryCode): string {
  return getCountryCallingCode(country);
}

/** Case- and accent-insensitive, so "aland" finds "Åland Islands". */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();
}

/** Matches a name, an ISO code ("ke") or a dial code ("254", "+254"). */
export function matchesCountry(country: PhoneCountry, query: string): boolean {
  const needle = fold(query.trim());
  if (!needle) return true;
  const digits = needle.replace(/^\+/, '');
  if (/^\d+$/.test(digits)) return country.dial.startsWith(digits);
  return fold(country.name).includes(needle) || country.iso.toLowerCase() === needle;
}
