# Sarrif (Amanat)

Daily operations for currency exchange shops. Product: [docs/Sarrif App – Product Spec.md](docs/Sarrif%20App%20–%20Product%20Spec.md). Stack: [docs/Sarrif App – Tech Stack & Structure.md](docs/Sarrif%20App%20–%20Tech%20Stack%20&%20Structure.md).

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Without Supabase settings (no `apps/web/.env.local`), sign-in is a demo that runs in the browser. Log in with **owner@amanat.demo**, password **amanat2026**: the owner of two demo shops. **cashier@amanat.demo** (same password) is a cashier (Editor) in Eastleigh only. Sign up with any other email to start as a brand-new user. The Log in tab shows these too.

With Supabase settings (see "Running locally"), sign-in is real: email + password with a confirmation email, or Google.

Everything else (shops, records, rates) is still a mock that runs in the browser and saves to localStorage. To start over, run `sarrifMock.reset()` in the browser console.

## Running locally

Sign-in runs on Supabase; the rest of the screens still use the mock above. You need Node 22, pnpm and Docker Desktop (running).

```bash
pnpm install                        # also installs the Supabase CLI (pnpm exec supabase)
pnpm exec supabase start            # first run downloads the Docker images (several minutes)
pnpm exec supabase status           # the URLs and keys for .env.local
cp apps/web/.env.example apps/web/.env.local   # then paste the URL and keys from status
pnpm dev                            # http://localhost:3000
```

On Windows, run `supabase start` from PowerShell: from Git Bash the CLI can fail to find Docker.

- **Studio** (browse the local database): http://127.0.0.1:54323
- **Emails** (sign-up confirmations, password resets): local Supabase doesn't send them; they land in Mailpit at http://127.0.0.1:54324.
- **Stop it:** `pnpm exec supabase stop`. Your data is kept.
- **Start the database over:** `pnpm exec supabase db reset` reruns every migration on an empty database.
- **Back to the demo sign-in:** empty the two `NEXT_PUBLIC_SUPABASE_*` values in `.env.local` and restart `pnpm dev`.
- **Database tests:** `pnpm exec supabase test db` runs `supabase/tests/*.sql` (pgTAP). CI runs them too.
- **Sign-in tests in a browser:** `pnpm --filter @sarrif/web test:e2e` (Playwright, `apps/web/e2e`) with local Supabase running: going offline, a cut-off request, a double click, expired links, a link opened in another browser, Google cancelled, a session that ends, `?next=` to another site, signing out in another tab, forgot password. Not in CI yet (it needs the whole local stack). First time: `pnpm --filter @sarrif/web exec playwright install chromium`.

### Database changes

Every change is a migration file in `supabase/migrations/`, committed to git. Nobody changes tables from the Supabase dashboard.

```bash
pnpm exec supabase migration new <what-it-does>   # creates supabase/migrations/<timestamp>_<what-it-does>.sql
pnpm exec supabase db reset                        # apply it locally
pnpm exec supabase migration list --local          # what's applied
```

### Environments

| | Supabase project | Env file |
|---|---|---|
| Your machine | local (Docker) | `apps/web/.env.local` |
| Staging | `amanat-staging` | names in `apps/web/.env.staging.example`, values in Vercel |
| Production | `amanat-prod` | names in `apps/web/.env.production.example`, values in Vercel |

Real keys never go in git: `.env*` is ignored, except the `*.example` files. Never put a real key in a `.example` file: git uploads those.

**Demo sign-in guard.** Without Supabase settings the app signs in against the public demo (owner@amanat.demo). A production build refuses that: on Vercel's production deployment (or with `APP_ENV=production`), `next build` stops unless `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set. A Vercel project used as staging can set `APP_ENV=staging`.

### Sign-in settings (Phase 1b)

Local Supabase reads these from `supabase/config.toml`. Staging and production need the same settings in the Supabase dashboard of each project:

| Setting | Where in the dashboard | Value |
|---|---|---|
| Confirm email | Authentication → Sign In / Providers → Email | On |
| Minimum password length | same page | 8 |
| Password requirements | same page | Letters and digits |
| Leaked password protection | same page (paid plans only) | On, when available |
| Site URL | Authentication → URL Configuration | `https://<your-domain>` |
| Redirect URLs | same page | `https://<your-domain>/**` (staging: its Vercel URL `/**`) |
| Google | Authentication → Sign In / Providers → Google | On, with the client ID and secret |
| Custom SMTP | Authentication → Emails → SMTP Settings | Resend's SMTP details (below) |
| Confirm signup email | Authentication → Emails → Templates → Confirm signup | The HTML in `supabase/templates/confirmation.html` |
| Reset password email | Authentication → Emails → Templates → Reset password | The HTML in `supabase/templates/recovery.html` |

The password rule must match `passwordSchema` in `packages/core/src/schemas.ts`. Change both together.

**Google sign-in.** In Google Cloud Console → APIs & Services → Credentials, create an **OAuth client ID** (Web application) and add each Supabase callback as an **Authorized redirect URI**:

- Local: `http://127.0.0.1:54321/auth/v1/callback` (put the ID and secret in `supabase/.env`, copied from `supabase/.env.example`)
- Staging: `https://ifhkimbxunshayfbggzk.supabase.co/auth/v1/callback`
- Production: `https://<amanat-prod ref>.supabase.co/auth/v1/callback`

Google sends people back through `/api/auth/callback`, and email links go to `/api/auth/confirm`, which is why the Redirect URLs above end in `/**`.

**Email links work on any device.** The two templates put a one-time token in the link (`token_hash`), which `/api/auth/confirm` checks on the server. Sign up on a laptop, open the email on your phone: it still works. Supabase's default templates use a code that only works in the browser that asked, so staging and production must use ours. The link is built from `{{ .RedirectTo }}`, the address the app sent, so it only works when that address is in Redirect URLs.

**Emails.** Supabase's own email sender allows only a few emails an hour. For staging and production, create a [Resend](https://resend.com) account, verify your domain, and paste Resend's SMTP host, port, user and password (an API key) into the SMTP settings.

### CI

`.github/workflows/ci.yml` runs on every push and pull request: install, typecheck, lint, test, and the database tests. Run the same before pushing with the commands under Checks.

## Layout

```text
apps/web        Next.js app (the PWA): screens, i18n, the mock backend
packages/core   @sarrif/core: money, rates, ledger, permissions, schemas, the API contract
docs/           product spec and tech stack
```

## Checks

```bash
pnpm test         # core: money, rates, ledger, profit, permissions
pnpm typecheck
pnpm lint         # also blocks left/right Tailwind classes (RTL)
pnpm build
```
