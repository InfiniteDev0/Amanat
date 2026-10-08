/** A market rate with enough digits to be useful: 129.61, 3.6725, 0.892949. Latin digits, read left to right. */
export function formatMarket(value: string): string {
  const number = Number(value);
  const options: Intl.NumberFormatOptions =
    number >= 100 ? { maximumFractionDigits: 2 } : number >= 1 ? { maximumFractionDigits: 4 } : { maximumSignificantDigits: 6 };
  return new Intl.NumberFormat('en-US', options).format(number);
}
