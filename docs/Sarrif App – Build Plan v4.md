# Sarrif – Build Plan v4

_Updated: 11 Oct 2026. This file replaces all earlier specs and plans wherever they disagree (see section 13)._

---

## 0. Instructions for the agent reading this

You are checking an existing codebase against this plan.

1. Read this whole file first. Learn the **words** in section 1.1 — use them exactly.
2. Go through the codebase and, for **every checkbox** in section 12 (Build checklist), mark it:
   - `[x]` done and working
   - `[~]` started / partly done — add a short note saying what is missing
   - `[ ]` not started
3. For anything built that **contradicts** this plan (built under an older plan), list it under "Conflicts".
4. Do **not** build anything during the check. Report first.
5. Finish with a report in this shape:

```md
## Status report – <date>
**Done:** n / total
### Done
- ...
### Partly done
- item — what is missing
### Not started
- ...
### Conflicts with v4
- what was built → what v4 says → suggested fix
### Suggested next 5 tasks (in order)
1. ...
```

---

## 1. What the app is

Sarrif (Somali: money exchange) is a daily book for currency exchange businesses. It replaces the paper book / Excel sheet.

**The one promise:** at the end of every day the owner knows exactly what he earned, and **the drawer always adds up**, without the app confusing him.

**Everything is run from Home.** There is no sidebar.

### 1.1 Words (use these exactly, in code and UI)

| Word | Means | Example |
|---|---|---|
| **Shop** | A unit of the business. The owner switches between shops and gives people rights per shop. Every owner has one **Main** shop plus any number of others. | Main, Eastleigh |
| **Main** | The owner's central shop (his own capital, funds the other shops). | — |
| **Account** | Where money sits inside a shop. Every shop has the same 4. | Cash USD, Salaam Bank, Cash KES, M-Pesa |
| **KSH total** | Cash KES + M-Pesa. | — |
| **Today's rate** | One number: KSh per 1 USD (market value), set each morning per shop. | 129.61 |
| **Swap** | Same currency, cash ↔ mobile, earns (or pays) a **%**. | Cash USD → Salaam Bank at 0.8% |
| **Exchange** | USD ↔ KSh at a **rate**; commission measured against today's rate. | Buy 100 USD at 127 |
| **Charges** | Commission earned = Swap charges + Exchange charges. | +160 USD |
| **Net** | Charges − Expenses. | — |
| **Rate change** | Value change of USD held when today's rate differs from yesterday's. Shown, never added to Charges or Net. | — |
| **Move** | Shifting own money between accounts or shops. Never profit. | Main → Eastleigh float |
| **Amanat** | Money held for a client. Never profit. | — |
| **Expense** | Money spent running the shop. | Rent, lunch |

UI never says "workspace", "wallet" or "balance". It says **shop** and **account**.

---

## 2. Decisions

| # | Decision |
|---|---|
| D1 | Every shop has **4 accounts**: Cash USD, Salaam Bank (USD), Cash KES, M-Pesa (KES), plus a KSH total. |
| D2 | Profit comes from 2 places only: **Swap** (% on same-currency cash↔mobile, USD and KSh) and **Exchange** (USD↔KSh rate). Total = **Charges**. |
| D3 | Swap and Exchange are **separate logic and separate tables**, on **one Profit page** (Swaps on top, Exchange below). |
| D4 | **Amanat**: held / returned list. Not profit. Subtracted when counting the drawer. |
| D5 | **Moves**: free, any amount, partial, with/without conversion, between accounts and between shops. Not profit. |
| D6 | **Expenses**: quick action on Home + third table on the Profit page. Net = Charges − Expenses. |
| D7 | **No sidebar.** Home is the hub. A **bottom dock**: Profit · Amanat · Reports on the left, **Activity log** on the right. |
| D8 | **Shop menu** (top-left) holds: Settings, People, switch shops, create shop, language, theme, sign out, Upgrade. |
| D9 | **Date control** (top-right) switches the day for the whole app and holds the **Close day** button. Profit and Reports always show the selected day by default; the date control also allows a **range / multiple months**. |
| D10 | Notifications grouped as **Today**, **Yesterday**, then **"Fri 09/10/2026"** (weekday + dd/mm/yyyy). No "Earlier". |
| D11 | **Today's report** CTA on Home. Reports export **CSV or PDF**, and share to WhatsApp. |
| D12 | Owner and workers; rights **per shop**: Owner, Can edit, Can view. Agents = workers. |
| D13 | **Golden feature (later, paid via Upgrade):** owner sees all shops at once. |
| D14 | Debts: not in v1. |

---

## 3. Money logic (the brain)

### 3.1 Today's rate
- One number per shop per day: KSh per 1 USD (e.g. `129.61`). Not buy and sell.
- All accounts are valued at today's rate for totals and checks.
- An exchange-rate API may be shown as a reference only, next to the owner's rate.

### 3.2 Swap (same currency, %)

User types: **direction (Earn / Pay)**, **Paid from**, **Amount**, **%**, optional customer, note.
App fills: **Received in** (the other account of the same currency), **Gets**, **Commission**.

| Pair | Paid from → Received in |
|---|---|
| USD | Cash USD ↔ Salaam Bank |
| KSh | Cash KES ↔ M-Pesa |

| Direction | Gets (into Received in) | Commission |
|---|---|---|
| **Earn** (we sell, customer pays the %) | `amount × (1 + %)` | `+ amount × %` |
| **Pay** (we buy, the seller takes the %) | `amount × (1 − %)` | `− amount × %` |

Examples:

| Direction | Paid from | Received in | Amount | % | Gets | Commission |
|---|---|---|---|---|---|---|
| Earn | Cash USD | Salaam Bank | 20,000 | 0.8 | 20,160 USD | **+160 USD** |
| Earn | Salaam Bank | Cash USD | 20,000 | 0.5 | 20,100 USD | **+100 USD** |
| Earn | Cash KES | M-Pesa | 100,000 | 1.0 | 101,000 KSh | **+1,000 KSh** |
| Earn | M-Pesa | Cash KES | 100,000 | 1.0 | 101,000 KSh | **+1,000 KSh** |
| Pay | Cash USD | Salaam Bank | 20,000 | 0.1 | 19,980 USD | **−20 USD** |

### 3.3 Exchange (USD ↔ KSh, rate)

User types: **Buy / Sell**, **Amount (USD)**, **Rate**, optional customer, note.
App fills: accounts (default Cash USD + Cash KES, changeable to Salaam Bank / M-Pesa), **KSh**, **Commission**.

| Type | We pay from | We receive in | KSh | Commission (KSh) |
|---|---|---|---|---|
| **Buy USD** (customer sells USD to us) | Cash KES / M-Pesa | Cash USD / Salaam Bank | `amount × rate` | `(today − rate) × amount` |
| **Sell USD** (customer buys USD from us) | Cash USD / Salaam Bank | Cash KES / M-Pesa | `amount × rate` | `(rate − today) × amount` |

Examples (today 129.61): Buy 100 at 127 → 12,700 KSh, **+261 KSh**. Sell 200 at 129.80 → 25,960 KSh, **+38 KSh**.

### 3.4 Rules for both
- **Gets / KSh** and **Commission** are **locked, calculated cells**. Never typeable.
- Account dropdowns show only accounts allowed for that row, default pre-selected.
- Rate pre-filled with today's rate; % pre-filled with the last % used for that pair.
- If today's rate is not set, Exchange commission shows **"Set today's rate"** (tappable).
- **Record** saves the row; both accounts update instantly.

### 3.5 Totals (Profit page footer, Home strip, day report)
```
Swap charges       per currency
Exchange charges   KSh
Charges total      per currency + combined at today's rate
Expenses           per currency
Net                Charges − Expenses
Rate change        own line, not in Net
```

### 3.6 Moves
- From account → to account, same shop or **between shops**.
- Same currency: in = out. Conversion: rate entered; if ≠ today's rate, the difference is shown as **Rate difference** (not Charges).
- Visible in the account statement and the Activity log. Not on the Profit page.

### 3.7 Amanat
- Client name, currency, amount, account it sits in, time. **Held / Returned**.
- Drawer check: **own money = account − amanat held** in that account.

### 3.8 Expenses
- Category, amount, currency, paid from which account, note.

### 3.9 The drawer must always add up
```
expected = opening + rows in − rows out (that day)
```
Close day: count each account → `counted − expected`. Zero = green. Not zero = red, note required. Closed days are locked; only the owner can reopen/edit, with a reason.

### 3.10 Storage rules
- Amounts as integers in smallest unit (`bigint`). Rates and % as `numeric(18,6)`. `decimal.js`, never floats.
- Every amount stored with its currency.
- All money writes through `lib/ledger.ts` in one DB transaction, which also writes the activity log.
- Soft delete only (`deleted_at`). Edits keep before/after.

---

## 4. Shops

```
Owner
└── Main          (owner's central shop)
    ├── Eastleigh
    ├── Garissa
    └── …
```

- Main is created automatically at sign-up and can't be deleted. Owner can create more shops.
- Each shop has its own 4 accounts, today's rate, rows, amanat, expenses, closings.
- Switch shops from the shop menu (Main first, ★).
- Every table (except users) has `shop_id`; row-level security enforces access.
- **All shops at once** = golden feature, later (section 11).

---

## 5. People and rights

- Rights per shop: **Owner**, **Can edit**, **Can view**. Workers (incl. agents) see only their shops. Main is owner-only by default.
- More than one Owner allowed; the last Owner can't leave.
- **People** opens from the shop menu (owners only): Name · Phone · Right · Shops · Last active · Invited by · ⋯.
- Invite: phone + right + shop checkboxes → sent via **Share to WhatsApp**. Only invited people get in; no public links.

| Action | Owner | Can edit | Can view |
|---|---|---|---|
| See Home, Profit, Amanat, Reports of the shop | ✓ | ✓ | ✓ |
| Record swap / exchange / move / amanat / expense | ✓ | ✓ | – |
| Set today's rate | ✓ | ✓ | – |
| Close the day | ✓ | ✓ | – |
| Edit/delete own rows today | ✓ | ✓ | – |
| Reopen / edit a closed day (reason required) | ✓ | – | – |
| Move money to another shop | ✓ | only between shops they can edit | – |
| Invite, change rights, remove people | ✓ | – | – |
| Activity log | ✓ all | own actions | – |
| Shop settings, create/delete shop, Upgrade | ✓ | – | – |
| Export CSV/PDF, share to WhatsApp | ✓ | ✓ | ✓ |

---

## 6. App flow

- No landing page. Auth page first: phone → SMS code → in (or phone + PIN).
- Invite link → auth with banner "You've been invited to <Shop> as <Right>" → that shop's Home.
- First-time owner: name + language → Main created → opening amounts for 4 accounts → today's rate → Home.
- Returning user → last-used shop's Home, today selected.

---

## 7. Screens

### 7.1 Layout (every screen)

```
┌────────────────────────────────────────────────────────────────────┐
│ [E] Ezary shop ⌄                         Today · 11 Oct 2026 📅  🔔 │  ← top bar
├────────────────────────────────────────────────────────────────────┤
│ (rate banner when today's rate is missing)              [Set rate] │
│                                                                    │
│                         page content                               │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ [Profit] [Amanat] [Reports]                        [Activity log] │  ← bottom dock
└────────────────────────────────────────────────────────────────────┘
```

- **No sidebar.**
- **Top-left: shop menu** → shop name + right, **Upgrade**, **Settings**, **People**, Switch shops (★ Main first), Create shop, Language, Theme, Sign out.
- **Top-right: date control** → calendar. Pick one day (default today) or a **range / several months**. Bottom of the popover: **Close day** (for the selected open day; shows "Closed ✓ by Ahmed" if already closed). The selected date drives Home, Profit, Amanat, Reports and Activity.
- **Top-right: bell** → notifications panel.
- **Page tabs** (along the top of the main panel, browser-tab style): **Home · Profit · Reports · Amanat**. (Replaces the bottom dock of earlier drafts.)
- **Bottom dock, right:** **Activity log** → opens a right-side drawer.
- Same layout on mobile; dock becomes a bottom bar with icons, Activity log as the last icon.

### 7.2 Home (the hub)
1. Greeting.
2. **Totals:** Total USD and Total KSh, each with an **eye toggle** to hide amounts.
3. **Account bar + 4 account cards** (Cash USD, Salaam Bank, Cash KES, M-Pesa) with share %. **Tap a card → statement sheet** (opening, every movement with running balance, **Move** button).
4. **Today strip:** Swap charges · Exchange charges · Expenses · **Net**, plus **Today's report** button (opens the day report: share WhatsApp, PDF, CSV).
5. **Quick actions (5):** Swap · Exchange · Move · Amanat · Expense. Each opens a sheet; no page change.
6. **Needs attention:** rate not set, previous day not closed, amanat not returned — each with its fix button.
7. **Recent rows** (latest 10): tap to edit, swipe to delete with undo.

### 7.3 Profit
For the selected day (or range from the date control). **Not a spreadsheet:** each section is a small **entry bar** on top and a **read-only list** of recorded rows underneath. The worker types 3–4 things, the app fills the rest.

1. **Swaps**
   - Entry bar: **Earn / Pay** toggle · **Paid from** (Cash USD, Salaam Bank, Cash KES, M-Pesa) · → **Received in** 🔒 (picked and locked: the other account of the same currency) · **Amount** · **%** (pre-filled with the last % for that currency). Customer + Note optional behind a small "more" link.
   - **Gets** and **Commission** show live while typing. **Record** is enabled as soon as the inputs are valid; Enter records too. After recording the bar clears and the row appears in the list.
   - List: Time · Earn/Pay · Paid from → Received in · Amount · % · Gets · Commission · By. Subtotal per currency.
2. **Exchange**
   - Entry bar: **Buy / Sell** toggle · **Amount (USD)** · **Rate** (pre-filled with today's rate) · accounts default Cash KES / Cash USD (changeable to M-Pesa / Salaam Bank). Customer + Note optional.
   - **KSh** and **Commission** show live; without today's rate the commission says **"Set today's rate"** (tappable).
   - List: Time · Buy/Sell · accounts · Amount USD · Rate · KSh · Commission · By. Subtotal.
3. **Expenses**: list (Time · Category · Amount · Paid from · By · Note) + **Add expense** (opens the expense sheet). Subtotal.
4. **Totals** at the bottom, as in 3.5: Swap charges + Exchange charges = Charges, minus Expenses = Net; Rate change on its own line.
- Lists have no column menus, type icons, checkboxes or horizontal scroll. **Tap a row** → its sheet: every detail, Delete (with undo) while the day is open.
- Gets / KSh / Commission are never typeable anywhere.
- Mobile: tabs **Swaps | Exchange | Expenses**, one section at a time.
- Closed days show a lock and no entry bars. Export CSV/PDF. Share to WhatsApp.

### 7.4 Amanat
- List: client, currency, amount, account, time, Held/Returned. Tap **Returned** to clear. Totals held per currency.

### 7.5 Reports
- Follows the date control: one day by default; range, month(s), year.
- Charges by day (chart), Swap vs Exchange split, expenses, net, rate change, closing differences, past closings (who closed).
- Export **CSV** or **PDF**. Share to WhatsApp.

### 7.6 Activity log (right drawer)
- Who did what, when: recorded, edited, deleted, moved, closed, reopened, invited, changed right.
- Filter by person, action. Follows the date control. Owners see all; Can edit sees own; Can view hidden.

### 7.7 Close day (sheet, from the date control)
- Per account: expected · amanat held · counted · difference. KSH total line.
- Summary: totals as in 3.5.
- Close → day locked → report → Share WhatsApp / PDF / CSV.

### 7.8 People and Settings (from the shop menu)
- People: section 5. Tabs not needed (Activity is in the dock).
- Settings: shop name, location, opening amounts, closing time, large-row limit, rates history, expense categories, notification preferences, language, profile.

### 7.9 Notifications panel
- Grouped: **Today**, **Yesterday**, then one group per older day labelled **"Fri 09/10/2026"**.
- Each item: type, shop name, message, time, action button. Mark all read, Clear all.

---

## 8. Notifications

In-app (live bell) + push (PWA). SMS only for login. WhatsApp only via share.

| Type | Message example | To |
|---|---|---|
| Rate not set | "Ezary shop hasn't set today's rate (KSh per USD)." | Owner, Can edit |
| Day not closed | "Eastleigh: 10 Oct not closed yet." | Owner, Can edit |
| Closing difference | "Garissa closed 50 USD short." | Owner |
| Day closed | "Eastleigh closed. Net ≈ $160." + share | Owner |
| Large row | "Mandera: exchange of 15,000 USD." | Owner |
| Closed day edited | "Owner edited a row on 09/10/2026." | All Owners |
| Amanat still held | "500 USD amanat for Abdi not returned." | Owner, Can edit |
| Money moved between shops | "2,000,000 KSh Main → Eastleigh." | Owner + edit users of both |
| Invite accepted | "Ahmed joined Eastleigh." | Owner |
| New device login | — | That user |

Rules: one per type per shop per day; quiet hours 22:00–07:00 for push; receiver's language; kept 90 days; preferences per shop.

---

## 9. Sharing and export

- WhatsApp text: `https://wa.me/?text=<encoded>`. File: `navigator.share({ files })`.
- Export: **CSV** and **PDF** (Profit, Reports, day report).
- Used on: Today's report, Close day, Reports, a single row (receipt), invites.

---

## 10. Tech stack and structure

| Layer | Choice |
|---|---|
| Language | TypeScript |
| App | Next.js (App Router), PWA |
| UI | Tailwind (logical properties for RTL) + shadcn/ui |
| i18n | next-intl — en, so, ar |
| Forms | React Hook Form + Zod |
| Data | TanStack Query; TanStack Table for Profit tables |
| DB | Supabase Postgres + RLS per shop |
| ORM | Drizzle |
| Auth | Supabase Auth, phone + OTP (Africa's Talking) |
| Realtime | Supabase Realtime |
| Push | Web Push (VAPID) |
| Jobs | pg_cron + Edge Functions |
| Money | decimal.js |
| Export | CSV (papaparse) + PDF (@react-pdf/renderer) |
| Charts | Recharts |
| Hosting | Vercel + Supabase |
| Errors | Sentry |

```text
sarrif/
├── app/[locale]/
│   ├── (auth)/ · onboarding/
│   └── (app)/s/[shopId]/
│       ├── layout.tsx      # top bar (shop menu, date control, bell) + bottom dock + activity drawer
│       ├── page.tsx        # Home
│       ├── profit/ · amanat/ · reports/
│       ├── people/ · settings/
├── features/
│   ├── swap/ · exchange/ · expenses/ · moves/ · amanat/
│   ├── rates/ · accounts/ · closing/ · reports/ · activity/
│   ├── notifications/ · people/ · shops/ · date-control/ · share-export/
├── lib/ money.ts · ledger.ts · commission.ts · permissions.ts · activity.ts · notify.ts · export.ts · whatsapp.ts
├── db/ schema/ · migrations/ · policies.sql · seed.ts
├── supabase/functions/
├── messages/ en.json · so.json · ar.json
└── tests/
```

### 10.1 Entities

**Group A — the business: shops and money**

| Entity | Key fields |
|---|---|
| shops | id, owner_id, name, is_main, location, closing_time, large_row_limit, plan |
| accounts | shop_id, kind (CASH_USD / SALAAM_BANK / CASH_KES / MPESA), currency, opening_amount |
| daily_rates | shop_id, date, rate, set_by |
| swaps | shop_id, date, time, direction (EARN / PAY), from_account_id, to_account_id, currency, amount, pct, gets, commission, customer_name, note, created_by, deleted_at |
| exchanges | shop_id, date, time, side (BUY / SELL), amount_usd, rate, today_rate, from_account_id, to_account_id, kes_amount, commission_kes, customer_name, note, created_by, deleted_at |
| expenses | shop_id, date, time, category_id, amount, currency, account_id, note, created_by, deleted_at |
| expense_categories | shop_id, name |
| moves | from_shop_id, from_account_id, to_shop_id, to_account_id, amount_out, amount_in, rate, rate_difference, note, created_by, deleted_at |
| amanat | shop_id, client_name, currency, amount, account_id, status (HELD / RETURNED), held_at, returned_at |
| day_closings | shop_id, date, closed_by, closed_at, note, reopened_by, reopen_reason |
| day_closing_lines | closing_id, account_id, expected, amanat_held, counted, difference |

**Profit and reports are calculated** from swaps, exchanges, expenses, rates and closings — not stored tables (cache later if slow).

**Group B — people: owner, workers, rights**

| Entity | Key fields |
|---|---|
| users | id, name, phone, language |
| members | user_id, shop_id, right (OWNER / EDIT / VIEW), last_active_at |
| invitations | phone, shop_ids[], right, invited_by, token, status, expires_at |
| activity_log | shop_id, user_id, action, record_type, record_id, before, after, created_at (append-only) |

**Group C — system**

| Entity | Key fields |
|---|---|
| notifications | user_id, shop_id, type, title, body, link, read_at, created_at |
| notification_settings | user_id, shop_id, type, in_app, push |
| push_subscriptions | user_id, endpoint, keys |

---

## 11. Open questions / later

- [ ] **Golden feature:** all shops at once for the owner (paid, behind Upgrade). Design later.
- [ ] Does the client do **KSh swaps** (cash ↔ M-Pesa for %)? Built either way.
- [ ] Does **Main** serve customers itself, or only hold capital?
- [ ] Login: SMS code or phone + PIN?
- [ ] Offline entry needed?
- [ ] Pricing: ~3,000 KSh / shop / month? What's free vs Upgrade?
- [ ] Debts — later.

---

## 12. Build checklist

### Phase 1 – Foundation
- [ ] Next.js + TS, Tailwind, shadcn/ui
- [ ] PWA installable on Android
- [ ] next-intl en/so/ar; RTL for Arabic; no hard-coded text
- [ ] Supabase + Drizzle schema for all entities in 10.1; migrations clean
- [ ] RLS: every table filtered by membership of `shop_id`
- [ ] `lib/money.ts`, `lib/commission.ts`, `lib/ledger.ts`
- [ ] Seed: owner, Main + 1 shop, a sample day

### Phase 2 – Auth, shops, people
- [ ] Auth page first; phone + OTP (or PIN)
- [ ] Onboarding creates Main, opening amounts, today's rate
- [ ] Shop menu: Upgrade, Settings, People, switch shops (★ Main first), Create shop, Language, Theme, Sign out
- [ ] Main cannot be deleted
- [ ] Rights per shop (owner / edit / view); `can(right, action)` in UI and server
- [ ] People page: phone, right, shops, last active, invited by, ⋯
- [ ] Invite via WhatsApp share; invite link → auth banner → shop
- [ ] Last owner cannot leave

### Phase 3 – Money core
- [ ] 4 accounts per shop + KSH total
- [ ] Today's rate: one number per shop per day; set/edit/history
- [ ] Swap: Earn/Pay, same-currency pair auto-picked, gets + commission calculated
- [ ] Swap works for USD (Cash USD ↔ Salaam Bank) and KSh (Cash KES ↔ M-Pesa)
- [ ] Exchange: Buy/Sell, KSh + commission vs today's rate calculated
- [ ] Locked calculated cells; dropdowns limited per row
- [ ] "Set today's rate" shown in commission when rate missing
- [ ] Moves within and between shops; rate difference separate
- [ ] Amanat held / returned
- [ ] Expenses with categories
- [ ] All writes via ledger in one transaction + activity log; soft delete
- [ ] Unit tests: all examples in 3.2 and 3.3, totals in 3.5, drawer maths, move between shops

### Phase 4 – Screens
- [ ] **No sidebar**
- [ ] Top bar: shop menu (left), date control + bell (right)
- [ ] Date control: single day, range, multiple months; drives all screens
- [ ] Date control popover: Close day button / "Closed ✓ by …"
- [ ] Bottom dock: Profit · Amanat · Reports (left), Activity log (right); Home reachable
- [ ] Rate banner says "today's rate", asks for one number
- [ ] Home: greeting, Total USD / Total KSh with eye toggle
- [ ] Home: account bar + 4 cards; tap → statement sheet with Move
- [ ] Home: today strip (Swap charges, Exchange charges, Expenses, Net) + Today's report button
- [ ] Home: 5 quick actions (Swap, Exchange, Move, Amanat, Expense) as sheets
- [ ] Home: needs attention; recent rows with edit / swipe-delete / undo
- [ ] Profit: Swaps table + subtotal
- [ ] Profit: Exchange table + subtotal
- [ ] Profit: Expenses table + subtotal
- [ ] Profit: footer totals (3.5); mobile toggle Swaps | Exchange | Expenses
- [ ] Amanat page
- [ ] Reports: follows date control; charts; Swap vs Exchange; past closings
- [ ] Activity log right drawer with filters
- [ ] Close day sheet: expected, amanat, counted, difference; note if ≠ 0; locks day
- [ ] Owner reopen/edit closed day with reason
- [ ] Settings page

### Phase 5 – Notifications, sharing, export
- [ ] Live bell + panel grouped **Today / Yesterday / "Fri 09/10/2026"**
- [ ] Notification texts as in section 8 (one rate, shop named)
- [ ] Web Push
- [ ] Scheduled: rate not set, day not closed
- [ ] Event notifications in section 8; no duplicates; quiet hours; receiver's language
- [ ] Preferences per shop
- [ ] Export CSV and PDF (Profit, Reports, day report)
- [ ] Share to WhatsApp: day report, receipt, invite

### Phase 6 – Ready for the client
- [ ] Arabic RTL checked everywhere; Somali reviewed by a native speaker
- [ ] Fast on a cheap Android phone
- [ ] Sentry; deployed with custom domain
- [ ] Client's Main + shops used for one full week; feedback triaged

### Later
- [ ] **Golden feature:** all shops at once (Upgrade)
- [ ] Debts
- [ ] Offline entry
- [ ] Billing / plans

---

## 13. What changed from earlier plans

| Earlier | v4 |
|---|---|
| Sidebar (8 items, then 4) | **No sidebar**; bottom dock Profit · Amanat · Reports + Activity log |
| Close day page / sidebar button | Close day inside the **date control** popover |
| Team page / People activity tab | People in the shop menu; **Activity log** in the dock (right drawer) |
| Exchange page, one mixed table | **Profit** page: Swaps, Exchange, Expenses tables + totals |
| Sallam sell / Sallam buy | **Swap** (Earn / Pay), for USD and KSh |
| Buy + sell rates | One **today's rate** |
| Main shows all shops | Main = owner's central shop; **all shops at once = golden feature later** |
| Notifications "Earlier" | Today / Yesterday / "Fri 09/10/2026" |
| Reports Excel/PDF | **CSV / PDF**, date control filters (day, range, months) |
| Workspaces, balances | Shops and accounts |
| One `rows` table | Separate `swaps`, `exchanges`, `expenses`, `moves` tables |
