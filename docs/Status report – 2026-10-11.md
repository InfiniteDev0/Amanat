# Status report – 11 Oct 2026

Checked against **Build Plan v3** (11 Oct 2026). v3 is not in `docs/` yet; `docs/Sarrif App – Build Plan v2.md` is the older plan.

The check read the code against each item in v3 section 12. Nothing was clicked through in the app. Items marked "not checked" are unverified.

**Done: 11 / 74**

We are in **Phase 3 (money core)**, partly built. Before the next screen (Amanat), a few things built under v2 conflict with v3 and should be fixed (see Conflicts).

## Done
- Next.js + TypeScript, Tailwind, shadcn/ui
- next-intl en / so / ar, `<html dir>` switches to RTL for Arabic
- Decimal money maths + formatting (`packages/core/src/money.ts`, not `lib/money.ts`)
- Auth page is the first screen
- Buy USD, Sell USD, Sallam sell: other amount + commission, with tests
- Other amount + Commission are locked, calculated cells
- Shop menu: Settings, People, switch shops, Create shop, Language, Theme, Sign out
- No People / Settings / Close day / Balances items in the sidebar (the sidebar is currently switched off)
- "Today's rate isn't set" banner that asks for one number

## Partly done
- **PWA:** manifest with 192 / 512 px icons (added 11 Oct). No service worker or offline support yet.
- **No hard-coded UI text:** followed as a convention, not enforced by lint.
- **Seed:** the mock has 2 shops + a sample day. No Main, no database seed.
- **Phone + OTP:** the screens work against the mock with a demo code. No real SMS.
- **Onboarding:** creates a shop with accounts + today's rate. Not called Main; still has the "currencies you trade" step.
- **Create more shops:** works. There is no Main, so nothing stops it being deleted.
- **Shop switcher:** works. No ★ Main first.
- **Rights per shop:** owner / edit / view exist. "Main is owner-only" isn't there.
- **`can()`:** used in the UI and the mock backend. No server actions yet.
- **4 accounts:** only because the user sets them up. Accounts are generic, with no fixed 4.
- **Today's rate:** set + edit work. No history.
- **Sallam buy:** built per v2 (see Conflicts).
- **Paid from / Received in:** the default is pre-selected, but the list shows every account instead of the allowed ones.
- **Moves:** within a shop, from the account dialog. The model supports between shops; no UI, no "Rate difference", and moves aren't on the Exchange page.
- **Amanat:** in core + mock as deposits / withdrawals. The page is a placeholder.
- **Expenses:** in core + mock, with categories. No UI.
- **Ledger + activity log:** done in core + mock. No real DB transaction yet.
- **Soft delete:** delete + undo works. Before / after on edits not checked.
- **Unit tests:** 4 worked examples (Sallam buy is the v2 version). No drawer maths or move-between-shops tests.
- **Layout:** top bar has the date + bell. No search, no + New, no mobile bottom bar.
- **Home shop card:** the two totals can be hidden, but not every amount on the page. No Charges chip (removed on request).
- **Home action buttons:** 3 quick actions instead of 5, and two open pages instead of sheets.
- **Home account cards:** 4 cards. The KSH total line was removed on request; the header's "Total KSh" covers it.
- **Tap an account card:** opens the balance / move dialog. No statement with a running balance.
- **Exchange page:** sheet + inline add + Record. Deal rows only, no filter chips, no By / Note columns.
- **Exchange footer:** charges per currency + combined total. No expenses / net.
- **Day lock:** the mock refuses changes on a closed day, but there is no close UI.
- **Notifications:** bell + panel on the mock. No realtime.
- **Rate-not-set / day-not-closed alerts:** the mock works them out when the panel loads. No scheduled jobs.
- **Event notifications:** some types exist. Not checked in detail.
- **No duplicate notifications:** one per type / shop / day. No quiet hours.
- **Excel export:** Exchange page only.
- **Arabic RTL:** logical classes enforced by lint. Not checked page by page.

## Not started
- Supabase + Drizzle schema, migrations, row-level security
- Invite (phone + right + shop checkboxes), only-invited access, invite link with banner, last owner can't leave
- KSH total in closing and reports; "Set today's rate" in the commission cell (shows "—")
- Sidebar foot: Charges today + Close day
- Home: quick exchange form, needs-attention list, today's rows with swipe-delete, All-shops summary on Main
- Amanat page; Close day sheet (only a "coming soon" panel); reopen a closed day; Reports and Reports on Main; People page; Settings page
- Web push, notification preferences, Share to WhatsApp
- Phase 6 (except the RTL item above)

## Conflicts with v3
| What was built | What v3 says | Suggested fix |
|---|---|---|
| **Sallam buy:** paid from Salaam Bank into Cash USD, sends A + %, example −10 USD | Cash USD → Salaam Bank, other = A × (1 − %); 20,000 at 0.1% → 19,980, −20 USD | Change `deals.ts` + test. v3 section 11 still lists Sallam buy as an open question; worth confirming with the client. |
| No Main shop; separate All-shops page | Main created at onboarding, can't be deleted, ★ first, its Home shows the all-shops summary | Add a main flag to shops; onboarding creates Main; drop the All-shops page |
| Generic accounts + "currencies you trade" step | Every shop gets the same 4 accounts | Onboarding creates Cash USD, Salaam Bank, Cash KES, M-Pesa and asks opening amounts; keep multi-currency underneath |
| Amanat as a deposit / withdrawal ledger tied to Clients | Held / returned list with a typed client name | Reshape before building the page |
| Clients route; Debts in core / mock | Customer is a field; Debts later | Remove the Clients route; keep Debts out of the UI |
| Home: greeting, Total USD / Total KSh, split bar with % shares, cards, 3 quick actions; Charges and KSH total line removed (on request) | Action-first: shop card + Charges chip, 5 sheet buttons, quick exchange form, needs-attention, today's rows | **Decision needed: which one wins** |
| Sidebar commented out (on request) | 4-item sidebar, foot with Charges today + Close day | Switch it back on, or keep it off on purpose |
| % shares on account cards use the market rate when today's rate is missing | The API rate is reference only; the owner's rate is always used | Hide shares until today's rate is set |
| "workspace" in code and URL (`/w/[workspaceId]`); the UI already says shop | `/s/[shopId]`; never "workspace" in the UI | The UI is fine; rename the route when the backend goes in |
| Upgrade badge + plans dialog | Billing is later | Harmless as UI; keep or hide |

## Suggested next 5 tasks (in order)
1. Fix the money-core conflicts in core, each with a test: Sallam buy per v3, dropdowns limited per type, "Set today's rate" in the commission cell.
2. Main shop + the 4 fixed accounts: onboarding creates Main with Cash USD, Salaam Bank, Cash KES, M-Pesa; ★ Main first in the switcher.
3. Amanat end to end as held / returned: contract → mock → page + a sheet to record one.
4. Close day sheet: expected / amanat held / counted / difference per account + KSH total; note required on a difference; day locks; WhatsApp text.
5. Exchange page: Move / Amanat / Expense rows, filter chips, footer with expenses + net. Plus the **+ New** menu.

## Screens that need design direction
In the order they're needed. Reference screenshots, like the ones used for Home, work well.

1. **The record sheet:** one pattern for the + New menu (Exchange, Sallam, Move, Amanat, Expense) and the Home buttons. It's the most-used UI in the app.
2. **Amanat page:** the list (client, currency, amount, account, time, Held / Returned) + totals held per currency.
3. **Close day sheet:** per-account expected / amanat held / counted / difference, the summary, Close, then the report + Share to WhatsApp.
4. **Account statement sheet:** opening, then every row with a running balance, like an M-Pesa statement, + a Move button.
5. **Home, the rest:** the decision above, then needs-attention, today's rows, and Main's All-shops summary.
6. **Reports:** daily / monthly / yearly, a charges chart, Sallam vs exchange, past closings.
7. **People:** the table, the invite popup (phone + right + shop checkboxes), the Activity tab.
8. **Settings.**
9. **Mobile:** bottom bar, top bar with search and + New.
