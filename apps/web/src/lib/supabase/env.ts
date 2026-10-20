// The Supabase project the app talks to, from the environment (.env.local on
// your machine, the host's settings on staging and prod). Both values are
// public: the publishable key only does what row-level security allows.

export function supabaseUrl(): string {
  return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabasePublishableKey(): string {
  return required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

// Next inlines NEXT_PUBLIC_* only when written out in full, so each value is
// read above by name and checked here.
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set. Copy apps/web/.env.example to .env.local (see README, "Running locally").`);
  return value;
}
