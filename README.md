# Sarrif (Amanat)

Daily operations for currency exchange shops. Product: [docs/Sarrif App – Product Spec.md](docs/Sarrif%20App%20–%20Product%20Spec.md). Stack: [docs/Sarrif App – Tech Stack & Structure.md](docs/Sarrif%20App%20–%20Tech%20Stack%20&%20Structure.md).

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Sign in with **+254 700 000 000** (Kenya is the default country, so type `700000000`), code **123456**. That's the owner of two demo shops. `711111111` is a cashier (Editor) in Eastleigh only; any other number is a brand-new user and goes to onboarding.

The backend is a mock that runs in the browser and saves to localStorage. To start over, run `sarrifMock.reset()` in the browser console.

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
