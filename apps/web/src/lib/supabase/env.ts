// The Supabase project the app talks to, from the environment (.env.local on
// your machine, the host's settings on staging and prod). Both values are
// public: the publishable key only does what row-level security allows.
//
// Next inlines NEXT_PUBLIC_* at build time only when written out in full, so
// each is read by name here.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * True when this build has a Supabase project: sign-in is then real (Phase
 * 1b). Without one (a fresh checkout, a preview with no settings) the app
 * signs in against the in-browser demo instead, so it always runs.
 */
export const SUPABASE_CONFIGURED = Boolean(URL && PUBLISHABLE_KEY);

export function supabaseUrl(): string {
  return required('NEXT_PUBLIC_SUPABASE_URL', URL);
}

export function supabasePublishableKey(): string {
  return required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', PUBLISHABLE_KEY);
}

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set. Copy apps/web/.env.example to .env.local (see README, "Running locally").`);
  return value;
}
