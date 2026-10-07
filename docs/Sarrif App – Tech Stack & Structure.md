# Sarrif App – Tech Stack & Structure

Oct 7, 2026 · @Yussuf

## Tech stack

One TypeScript codebase: a Next.js web app installed on phones as a PWA, backed by Supabase (Postgres). Postgres row-level security keeps each shop's data apart, so workspaces are enforced by the database, not only by app code.

| Layer | Choice | Why it fits Sarrif |
| --- | --- | --- |
| Language | TypeScript | One language front to back; types catch money and currency mix-ups early |
| App framework | Next.js (App Router) | Pages, server actions and API routes in one project; deploys in one step |
| Phone app | PWA (installable web app) | Works on any Android phone from a link; no app store at launch. Expo / React Native later if needed |
| Styling | Tailwind CSS + shadcn/ui (Radix) | Fast to build; logical properties (`ms-`, `me-`) flip cleanly for Arabic RTL |
| Translations | next-intl | Somali, Arabic, English message files; locale in the URL |
| Forms | React Hook Form + Zod | Quick entry forms; the same Zod schema validates on the server |
| Data fetching | TanStack Query | Instant updates after each entry, cache per workspace |
| Excel-style Book | ill decide which ui to use  | Sorting, filters, inline cell editing, keyboard navigation |
| Database | Supabase Postgres | Relational data (ledger, debts, amanat) needs real SQL and transactions |
| ORM / migrations | Drizzle ORM | Typed schema in code, plain SQL migrations |
| Auth | Supabase Auth, phone + OTP | Matches the phone-first auth page; no passwords |
| SMS / OTP | Africa's Talking (via Supabase SMS hook) | Good coverage and pricing in Kenya and the region |
| WhatsApp | WhatsApp Cloud API | Invites, client statements, daily summary |
| In-app notifications | Postgres table + Supabase Realtime | Bell updates live the moment something happens |
| Push | Web Push (VAPID) | Phone notifications from the PWA |
| Scheduled jobs | pg\_cron + Supabase Edge Functions | "Rates not set" at 9:00, "Day not closed", debt due reminders |
| Money maths | decimal.js | No floating-point errors on rates and spreads |
| Excel export | ExcelJS | Real .xlsx files with formatting |
| Charts | Recharts | Profit and volume charts on Reports |
| Hosting | Vercel (app) + Supabase (database) | Free tiers to start; scale without moving |
| Errors | Sentry | See crashes from staff phones |

**If you prefer your own backend later:** swap Supabase for NestJS + Postgres + Redis. The folder structure below keeps database code in one place so this move stays contained.

## Folder structure

A pnpm + Turborepo monorepo. Business rules live in a pure TypeScript package (`packages/core`) that the web app, the mock backend and the real backend all share. Inside the app, it's feature-based: each business thing (exchange, amanat, debt…) owns its form, validation and queries in one folder. Pages in `app/` stay thin and just assemble features. The workspace id sits in the URL, so every page knows which shop it is in.

**UI first, backend plugged in later.** Screens only ever call hooks (`features/*/queries.ts`), and the hooks only call `api`, an object that implements the `SarrifApi` contract in `packages/core/src/api.ts`. Today `api` is an in-browser mock with demo shops; it enforces the same rules (membership, `can()`, schemas, ledger, closed days). The Supabase backend becomes a second implementation of the same contract: thin wrappers over server actions. Swapping it in changes one line, not the screens.

```text
sarrif/
├── packages/
│   └── core/                         # @sarrif/core — no React, no database
│       └── src/
│           ├── api.ts                # SarrifApi: the UI ↔ backend contract, ApiError
│           ├── entities.ts           # the 19 entities as types
│           ├── money.ts              # minor units, parsing, formatting
│           ├── rates.ts              # board rates, quotes, valuation
│           ├── ledger.ts             # entriesFor(record), balances, amanat, debts
│           ├── summary.ts            # Home figures, profit (one function)
│           ├── permissions.ts        # can(role, action)
│           └── schemas.ts            # Zod inputs, shared by forms and server
│
└── apps/web/                         # the Next.js PWA
    ├── messages/                     # en.json, so.json, ar.json
    └── src/
        ├── proxy.ts                  # (Next 16's middleware) locale; auth later
        ├── i18n/                     # next-intl routing, navigation, request
        ├── lib/api/                  # `api` = mock today, Supabase later
        ├── lib/query/keys.ts         # cache keys, all under ['w', workspaceId]
        └── app/

app/
├── [locale]/                     # en | so | ar
│   ├── (auth)/
│   │   ├── page.tsx              # Auth = landing page (phone)
│   │   ├── verify/page.tsx       # OTP code
│   │   └── invite/[token]/page.tsx
│   ├── onboarding/page.tsx       # name, language, first shop, accounts, rates
│   └── (app)/
│       ├── all-shops/page.tsx    # owner overview across shops
│       └── w/[workspaceId]/
│           ├── layout.tsx        # sidebar, top bar, + New, bottom bar
│           ├── page.tsx          # Home (action-first)
│           ├── book/page.tsx
│           ├── clients/page.tsx
│           ├── clients/[clientId]/page.tsx
│           ├── accounts/page.tsx
│           ├── close/page.tsx
│           ├── reports/page.tsx
│           ├── team/page.tsx
│           ├── notifications/page.tsx
│           └── settings/page.tsx
├── api/
│   ├── push/subscribe/route.ts
│   └── webhooks/sms/route.ts
└── manifest.ts                   # PWA manifest

apps/web/src/  (continued)
├── features/
│   ├── exchange/
│   │   ├── components/               # ExchangeForm, ExchangeSheet, ExchangeRow
│   │   ├── actions.ts                # createExchange, editExchange (server)
│   │   ├── schema.ts                 # Zod validation
│   │   └── queries.ts                # reads + TanStack Query hooks
│   ├── expense/
│   ├── amanat/
│   ├── debt/
│   ├── transfer/
│   ├── rates/
│   ├── accounts/
│   ├── clients/
│   ├── closing/
│   ├── book/                         # Excel-style table
│   ├── reports/
│   ├── notifications/                # bell, panel, push, preferences
│   ├── team/                         # members, invites, activity log
│   └── workspaces/                   # switcher, create shop, all-shops
│
├── components/
│   ├── ui/                           # shadcn primitives (button, sheet, dialog…)
│   └── layout/                       # Sidebar, TopBar, BottomBar, NewMenu
│
├── lib/                              # (money, ledger, permissions moved to @sarrif/core)
│   ├── api/                          # index.ts picks the backend; mock/ for now
│   ├── activity.ts                   # writes the activity log
│   ├── notify.ts                     # creates notifications + fans out to push/SMS
│   ├── excel.ts                      # ExcelJS export helpers
│   └── supabase/                     # server + browser clients
│
packages/db/   (later — when the backend starts)
├── src/
│   ├── schema/                       # one Drizzle file per entity group
│   │   ├── people.ts                 # users, workspaces, members, invitations
│   │   ├── money.ts                  # currencies, accounts, rates, entries
│   │   ├── obligations.ts            # clients, amanat, debts, payments
│   │   ├── operations.ts             # exchanges, expenses, transfers, closings
│   │   └── system.ts                 # activity log, notifications, settings
│   ├── migrations/
│   ├── policies.sql                  # row-level security per workspace
│   └── seed.ts                       # demo shop with sample data
│
supabase/functions/   (later)
├── send-notification/                # push, SMS, WhatsApp delivery
└── scheduled/                        # rates-reminder, day-not-closed, debts-due
```

Ledger and profit maths tests live next to the code in `packages/core/src/*.test.ts` (Vitest).

## Conventions

**Money**

- Amounts are stored as whole numbers in the smallest unit (`bigint`): $12.50 is `1250`. Rates are `numeric(18,6)`; an exchange's effective rate is `numeric(24,10)`, since out-per-in can be tiny (KES → USD). Never JavaScript floats.
- In TypeScript an amount is an integer `number`, not a JS `bigint`. It's exact to 2^53, survives JSON, and the Supabase client returns bigint columns as numbers anyway. `assertMinor` rejects fractions; every calculation with a rate goes through decimal.js in `@sarrif/core`.
- Board rates are "units of currency per 1 unit of the shop's base currency"; buy = the shop buys the base currency. Cross pairs go through the base. Details at the top of `packages/core/src/rates.ts`.
- Every amount travels with its currency code. A bare number is a bug.
- All money changes go through `entriesFor` in `@sarrif/core` (ledger.ts); the backend writes the record, its entries and the activity log in one database transaction.

**Workspaces**

- Every table except users and currencies has `workspace_id`.
- Row-level security policies check membership on every read and write, so a bug in app code cannot leak another shop's data.
- The current workspace comes from the URL (`/w/[workspaceId]`), never from a global variable.

**Permissions**

- One function, `can(role, action)`, used by both the UI (hide buttons) and server actions (block the request).

**Translations and RTL**

- No visible text in components; always `t('key')`.
- Use logical Tailwind classes only (`ms-4`, `pe-2`, `text-start`). `<html dir>` is set from the locale.

**Records are never silently changed**

- Deletes are soft (`deleted_at`). Edits store before/after in the activity log. Closed days reject edits unless an Owner gives a reason.

## Home page (action-first)

Home is where you work, not a report. Every common job (record an exchange, change a rate, take amanat, collect a debt, move money, close the day) happens on Home in a sheet that slides up over the page. Nothing navigates away. Other pages are for looking back and digging in.

**Top to bottom**

1. **Shop card** (from your wallet screenshot)
   - Shop switcher with a coloured avatar: Eastleigh, Garissa, All shops, + New shop
   - Search (clients, entries) and the notification bell with a dot
   - Total balance in base currency, with the eye toggle to hide it (shows `*******`)
   - Profit-today chip: `+$124.50`
   - Five round action buttons: **Exchange · Expense · Amanat · Debt · Transfer**
2. **Today's rates**: one chip per currency showing buy / sell. Tap a chip to edit it in place. It turns red when today's rates are not set.
3. **Quick exchange**: always open on Home. "Customer gives" and "Customer gets" with currency pickers. The rate fills from today's rates and the other amount calculates itself. Pick the account, then press Save. This is the single most-used action, so it needs zero taps to reach.
4. **Needs attention**: alerts with their fix on the card, e.g. "Rates not set → Set now", "Ali owes $300, 3 days late → Record payment / Send reminder", "Yesterday not closed → Close".
5. **Accounts strip**: Cash USD, Cash KES, M-Pesa, EVC, Bank as swipeable cards with live balances. Tap one to transfer from it.
6. **Today's book**: the latest entries. Tap a row to edit it, swipe to delete, with undo for 5 seconds.
7. **Close day bar**: pinned at the bottom in the evening, showing how many accounts still need counting.

**Hidden balance mode** applies everywhere on Home (balance, accounts, profit), useful when customers are standing at the counter.

A working prototype of this screen is published alongside this doc.
