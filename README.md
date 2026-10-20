# Sarrif (Amanat)

Daily operations for currency exchange shops. Product: [docs/Sarrif App – Product Spec.md](docs/Sarrif%20App%20–%20Product%20Spec.md). Stack: [docs/Sarrif App – Tech Stack & Structure.md](docs/Sarrif%20App%20–%20Tech%20Stack%20&%20Structure.md).

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Sign in with **+254 700 000 000** (Kenya is the default country, so type `700000000`), code **123456**. That's the owner of two demo shops. `711111111` is a cashier (Editor) in Eastleigh only; any other number is a brand-new user and goes to onboarding.

The backend is a mock that runs in the browser and saves to localStorage. To start over, run `sarrifMock.reset()` in the browser console.

## Running locally

The screens still use the mock above. Supabase runs alongside it, ready for the real backend (Phase 1). You need Node 22, pnpm and Docker Desktop (running).

```bash
pnpm install                        # also installs the Supabase CLI (pnpm exec supabase)
pnpm exec supabase start            # first run downloads the Docker images (several minutes)
pnpm exec supabase status           # the URLs and keys for .env.local
cp apps/web/.env.example apps/web/.env.local   # then paste the URL and keys from status
pnpm dev                            # http://localhost:3000
```

On Windows, run `supabase start` from PowerShell: from Git Bash the CLI can fail to find Docker.

- **Studio** (browse the local database): http://127.0.0.1:54323
- **Stop it:** `pnpm exec supabase stop`. Your data is kept.
- **Start the database over:** `pnpm exec supabase db reset` reruns every migration on an empty database.

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
| Staging | `sarrif-staging` | names in `apps/web/.env.staging.example`, values in Vercel |
| Production | `sarrif-prod` | names in `apps/web/.env.production.example`, values in Vercel |

Real keys never go in git: `.env*` is ignored, except the `*.example` files.

### CI

`.github/workflows/ci.yml` runs on every push and pull request: install, typecheck, lint, test. Run the same before pushing with the commands under Checks.

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
