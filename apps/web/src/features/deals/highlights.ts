// The colours a row of the exchange sheet can be highlighted in. The name is
// what's saved (Exchange.highlight); the hex is drawn as a light tint.

export const HIGHLIGHTS = [
  { name: 'red', hex: '#f87171' },
  { name: 'orange', hex: '#fb923c' },
  { name: 'amber', hex: '#fbbf24' },
  { name: 'yellow', hex: '#facc15' },
  { name: 'lime', hex: '#a3e635' },
  { name: 'green', hex: '#4ade80' },
  { name: 'teal', hex: '#2dd4bf' },
  { name: 'cyan', hex: '#22d3ee' },
  { name: 'blue', hex: '#60a5fa' },
  { name: 'violet', hex: '#a78bfa' },
] as const;

export function highlightHex(name: string | null | undefined): string | null {
  return HIGHLIGHTS.find((colour) => colour.name === name)?.hex ?? null;
}
