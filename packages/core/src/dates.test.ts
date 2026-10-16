import { describe, expect, it } from 'vitest';

import { addDays, monthStart } from './dates';

describe('dates', () => {
  it('finds the first of the month', () => {
    expect(monthStart('2026-10-10')).toBe('2026-10-01');
    expect(monthStart('2026-10-01')).toBe('2026-10-01');
  });

  it('adds days across a month end', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });
});
