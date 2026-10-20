// Sentry, the same on the browser and the server (instrumentation*.ts). On
// only when NEXT_PUBLIC_SENTRY_DSN is set (.env.local, Vercel); the DSN is
// public by design, it only lets events be sent to our project.
//
// Errors only for now: no performance tracing, no session replay, and no
// personal data (IPs, cookies, request bodies) for a finance app's users.

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const sentryOptions = {
  dsn,
  enabled: Boolean(dsn),
  // Vercel says which deployment this is (production / preview); locally, development.
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
  sendDefaultPii: false,
  tracesSampleRate: 0,
};
