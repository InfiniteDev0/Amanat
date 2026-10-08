@AGENTS.md

# Sarrif

Read README.md and the two docs in docs/ first. apps/web/AGENTS.md applies to the Next.js app (Next 16: read node_modules/next/dist/docs before using Next APIs).

## How the app is built

- **UI first, backend later.** Screens get data only through hooks in `apps/web/src/features/*/queries.ts`, which call `api` (`apps/web/src/lib/api/index.ts`). `api` implements `SarrifApi` from `packages/core/src/api.ts`. Today it is the in-browser mock (`lib/api/mock`); Supabase will be a second implementation. Never call the mock, fetch or Supabase from a screen.
- **Business rules live in `@sarrif/core`**, pure TypeScript, shared by the mock and the real backend: money (`money.ts`), rate maths (`rates.ts`), entries and balances (`ledger.ts`), Home figures (`summary.ts`), `can(role, action)` (`permissions.ts`), Zod input schemas (`schemas.ts`). Changes there get a test.
- When a screen needs data the contract doesn't have, add it to `SarrifApi` first, then the mock, then the hook.

## Conventions

- Money is integer minor units (`number`, never fractional) and always travels with its currency (`Money`). Rates are decimal strings. All maths with rates goes through decimal.js in core.
- Board rates are "units of currency per 1 base unit"; buy = shop buys the base. See the comment at the top of `rates.ts`.
- Profit uses mid-rate valuation in `exchangeProfit` (summary.ts). It's provisional until the spec's "profit method" question is answered.
- No visible text in components: `t('key')`, with keys in `apps/web/messages/{en,so,ar}.json`. en.json is the typed reference. Somali and Arabic need a native review.
- RTL: logical Tailwind classes only (`ms-`, `pe-`, `start-`, `text-start`); ESLint enforces it. Wrap amounts and phone numbers in `MoneyText` or `ltr()`.
- The workspace comes from the URL (`/w/[workspaceId]`), read through `useWorkspace()`.
- Use `Link` / `useRouter` from `@/i18n/navigation`, not `next/link` / `next/navigation`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
