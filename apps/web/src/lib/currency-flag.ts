// The flag shown next to a currency. For a national currency the first two
// letters of the ISO code are the country (KES → KE, USD → US, EUR → EU).
// Shared regional currencies (X…) have no country of their own, so they take
// the flag of their central bank's seat.
const REGIONAL: Record<string, string> = {
  XAF: 'CM', // Central African CFA franc (BEAC, Yaoundé)
  XOF: 'SN', // West African CFA franc (BCEAO, Dakar)
  XCD: 'KN', // East Caribbean dollar (ECCB, St Kitts)
  XCG: 'CW', // Caribbean guilder (Curaçao and Sint Maarten)
  XPF: 'PF', // CFP franc (French Polynesia)
};

export function currencyFlag(code: string): string {
  return REGIONAL[code] ?? code.slice(0, 2);
}
