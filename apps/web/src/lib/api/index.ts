import type { SarrifApi } from '@sarrif/core';

import { mockApi } from './mock/mock-api';

// The one backend the UI talks to. Screens never import the mock, Supabase
// or fetch directly: they use the hooks in features/*/queries.ts, which call
// `api`. When the real backend is ready, it is a second SarrifApi
// implementation (thin wrappers over server actions), and this line changes.
export const api: SarrifApi = mockApi;

/** True while running against the in-browser mock: shows demo hints. */
export const IS_MOCK_API = true;

export { CASHIER_PHONE, DEMO_CODE, DEMO_PHONE } from './mock/seed';
