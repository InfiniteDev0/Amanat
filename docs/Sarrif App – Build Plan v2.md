# Sarrif – Build Plan v2

_Updated: 9 Oct 2026 (second revision: 4-item sidebar, balances on Home). This file replaces the earlier spec wherever they disagree (see "What changed from v1")._

---

## 1. What the app is

Sarrif (Somali: money exchange) is a daily book for currency exchange shops. It replaces the paper book / Excel sheet.

**The one promise:** at the end of every day the owner knows exactly what he earned, and **the drawer always adds up**, without the app confusing him.

Users: the shop owner (may have many shops) and the workers he invites.

---

## 2. Decisions from the client (9 Oct 2026)

Client: owns 5 shops, knows ~200 sarrif owners in the market.

| # | Decision |
|---|---|
| D1 | Only **3 balances** per shop: **USD Cash**, **USD Sallam** (mobile/EVC), **KSH** (cash + M-Pesa counted as one total). |
| D2 | Profit comes from 2 places only: **Sallam commission** and **exchange commission**. Total commission for the day is called **"Charges"**. |
| D3 | **Amanat** is money held for clients, usually collected the same day. It is **not** profit and must not affect profit. It must still be subtracted when counting the drawer. |
| D4 | **Moves**: owner moves money freely between his own balances, any amount, partial, with or without conversion (e.g. 1.5M KSh → USD cash). Not profit. |
| D5 | Needs an **Exchange page**: a small Excel-like form, rows of what was exchanged, commission per row, **Charges total tallied below**. |
| D6 | Needs **daily, monthly, yearly** reports. |
| D7 | **Debts: not in v1.** He may change his mind; design must allow adding them later. |
| D8 | Reports and invites are sent with a **Share to WhatsApp** button (no WhatsApp API). |
| D9 | Owner can have **workers**; access is shared per shop with roles (see section 5). |
| D10 | **Open:** "main account" and "agents" — waiting for client's answer (section 11). |

---

## 3. Money logic (the brain)

### 3.1 Today's rate
- Each morning the owner sets **today's rate** (KSh per 1 USD, the market value, e.g. `129.61`) per shop.
- All balances are **valued at today's rate** for totals and checks.
- An exchange-rate API may be shown as a **reference only**, next to the owner's rate. The owner's rate is always the one used.

### 3.2 Row types on the Exchange page

| Type | Example | Balance effect | Commission (Charges) |
|---|---|---|---|
| **Sallam sell** | Give 20,000 USD cash, receive 20,160 on Sallam at 0.8% | USD Cash −20,000; USD Sallam +20,160 | `+ amount × %` = **+160 USD** |
| **Sallam buy** | Receive USD cash, send Sallam; market seller takes 0.1% | USD Sallam −(amount + fee); USD Cash +amount (or the reverse, per how it's entered) | `− amount × %` (a cost, negative) |
| **Buy USD** | Customer sells 100 USD at 127 | USD Cash +100; KSH −12,700 | `(today's rate − rate given) × USD` = (129.61−127)×100 = **+261 KSh** |
| **Sell USD** | Customer buys 200 USD at 129.80 | USD Cash −200; KSH +25,960 | `(rate given − today's rate) × USD` = 0.19×200 = **+38 KSh** |

Rules:
- The user enters: type, amount, rate or %, which balance it came from / went to, optional customer name, note.
- The app calculates the other amount and the commission. The user never types the commission.
- Charges total = sum of all row commissions, shown **per currency** (USD and KSh) plus a combined total in one currency at today's rate.

### 3.3 Moves
- From balance → to balance, amount out, amount in.
- Same currency: amount in = amount out.
- Conversion: user enters the rate used. If it differs from today's rate, the difference is shown as **"Rate difference"** (separate line, not Charges).

### 3.4 Amanat (held for clients)
- Record: client name, currency, amount, which balance it sits in, time. Status: **Held / Returned**.
- Not profit. Not in Charges.
- Drawer check uses: **expected own money = balance − amanat held** in that balance.

### 3.5 Expenses (keep simple)
- Category, amount, currency, paid from which balance, note.
- Shown on the day report. Net = Charges − Expenses.

### 3.6 Rate change between days
- When today's rate differs from yesterday's, existing USD holdings are worth more/less in KSh. Show as **"Rate change"** line in reports, never mixed into Charges.

### 3.7 The drawer must always add up
For each balance, at any moment:
```
expected = opening balance + all rows in − all rows out (this day)
```
Closing: user counts each balance → app shows `counted − expected`. Zero = green. Not zero = red, note required to close.

### 3.8 Money storage rules
- Amounts as integers in smallest unit (`bigint`, cents). Rates as `numeric(18,6)`. Never JS floats; use `decimal.js`.
- Every amount stored with its currency code.
- All money writes go through one function (`lib/ledger.ts`) in a single DB transaction, which also writes the activity log.
- Nothing is hard-deleted (`deleted_at`). Edits keep before/after in the activity log. Closed days are locked; only the owner can edit them, with a reason.

---

## 4. Shops (workspaces)

- One login can own many shops. Each shop has its own 3 balances, rates, rows, amanat, closings.
- Every table (except users, currencies) has `shop_id`. Row-level security enforces it.
- Shop switcher in the top bar (avatar + shop name + chevron, like the wallet-card reference).
- Owner with 2+ shops sees **All shops**: read-only summary per shop (Charges today, balances, closed yes/no) + combined total.
- Moving money between two shops of the same owner = a Move with from-shop and to-shop.

---

## 5. Users, workers, roles, sharing

```
Owner (one login)
├── Shop: Eastleigh
│   ├── Ahmed – can edit
│   └── Fatuma – can view
├── Shop: Garissa
│   └── Ali – can edit
└── Shop: Mandera
    └── Ahmed – can view   ← same worker, other shop, other role
```

- Roles are **per shop**: **Owner**, **Can edit**, **Can view**.
- Workers only see shops they are invited to. Never "All shops".
- A shop can have more than one Owner (partners). The last Owner can't leave.

**Invite flow** (from **Invite people** on the People page, opened via the shop menu; owners only):
- Invite field: **phone number** + role dropdown (Can view / Can edit) + **shop checkboxes** (invite to one or several shops) + Invite.
- General access: **Only those invited**. No "anyone with link" option — not allowed in a money app.
- People with access: avatar, name, phone, role dropdown, last active, Remove.
- "Send invite on WhatsApp" button (replaces "Copy link"): opens WhatsApp with the invite message + link. The person still logs in with their own phone.

| Action | Owner | Can edit | Can view |
|---|---|---|---|
| See balances, rows, reports | ✓ | ✓ | ✓ |
| Add exchange / Sallam / move / amanat / expense rows | ✓ | ✓ | – |
| Set today's rate | ✓ | ✓ | – |
| Close the day | ✓ | ✓ | – |
| Edit/delete own rows today | ✓ | ✓ | – |
| Edit rows from a closed day / reopen day | ✓ (reason required) | – | – |
| Invite, change roles, remove people | ✓ | – | – |
| Activity log | ✓ all | own only | – |
| Shop settings, create/delete shop | ✓ | – | – |
| Share report to WhatsApp, export Excel | ✓ | ✓ | ✓ |

---

## 6. App flow

- **No landing page.** The auth page is the first screen.
- Auth: phone number → SMS code (OTP) → in. Same flow signs up and logs in. (Alternative if SMS cost is a problem: phone + PIN.)
- Invite link → auth page with banner "You've been invited to <Shop> as <Role>" → after login lands in that shop.
- First-time owner → onboarding: name + language → create shop → opening balances for the 3 balances → today's rate → Home.
- Returning user → last-used shop's Home.
- Daily routine: set rate → record rows all day → Close day → Share report to WhatsApp.

---

## 7. Pages and navigation

**Sidebar (desktop) — 4 items only:**
- **Shop menu** at the top (shop avatar, name, "Owner · Rate 129.61"). Clicking it opens:
  - Shop name + role/plan
  - Buttons: **Settings** · **People**
  - Switch shops (list, ✓ on current) · **All shops** (owners) · **Create shop** (owners)
  - Language · Theme · Sign out
1. Home (balances live here)
2. Exchange (the daily sheet; moves appear here with the "Move" filter)
3. Amanat
4. Reports
— foot —
- **Charges today** block (always visible)
- **Close day** button → opens the closing **sheet** (not a page) from anywhere

Team and Settings are **not** sidebar items; they live in the shop menu. Close day is **not** a page. There is **no Balances page**: balances are on Home.

**Top bar:** search · notification bell · **+ New**.

**+ New menu (same everywhere):** Exchange · Sallam · Move · Amanat · Expense.

**Mobile bottom bar:** Home · Exchange · **+** · Close day (sheet) · More (Amanat, Reports). Shop menu = tap the shop name in the top bar.

### 7.1 Home — action-first, not a report
The owner manages from Home without changing pages; every action opens a sheet over Home.
1. **Shop card** (style of the wallet-card reference): shop switcher, search, bell, total value at today's rate, **eye toggle to hide amounts** (`*******`), Charges-today chip (e.g. `+$124.50`), round buttons: **Exchange · Sallam · Move · Amanat · Expense**.
2. **Today's rate** chip — tap to edit in place; red if not set.
3. **Quick exchange form** always open: type, amount, rate (prefilled), from/to balance → Save. Other amount + commission calculated live.
4. **Balance cards**: Cash USD · Cash KES · M-Pesa · Sallam (USD). Each shows amount, in/out today, amanat held. Under the cards: **KSH total = Cash KES + M-Pesa** (the client's single KSh figure; used in closing and reports). **Tap a card → statement sheet**: every movement in/out with running balance (like an M-Pesa statement) + **Move** button.
5. **Needs attention:** rate not set, yesterday not closed, amanat not yet returned — each with its fix button.
6. **Today's rows** (latest 10) — tap to edit, swipe to delete with 5-second undo.
7. **Close day** bar in the evening.

Hidden-amounts mode applies to everything on Home.

### 7.2 Exchange page
Excel-like sheet for the selected day (default today).
- Columns: Time · Type · Customer · Amount · Rate / % · From · To · Other amount · Commission · By · Note.
- Add rows inline (Tab between cells on desktop; form sheet on mobile).
- Filter chips: All · Buy USD · Sell USD · Sallam · Move · Amanat · Expense.
- **Footer tally:** Charges (USD), Charges (KSh), Charges total, Expenses, Net.
- Closed days show a lock.
- Export to Excel. Share to WhatsApp.

### 7.3 Balance statement (a sheet from Home, not a page)
- Opened by tapping a balance card on Home.
- Opening balance, then every row in/out in time order with running balance.
- **Move** button (same currency, conversion, between shops).
- Moves history = Exchange page with the "Move" filter.

### 7.4 Amanat
- List: client, currency, amount, balance, time, status Held/Returned. Tap "Returned" to clear.
- Total held per currency at the top.

### 7.5 Close day (a sheet, not a page)
- Opened from the sidebar Close day button, Home, or mobile bottom bar.
- Per balance: expected · amanat held · counted (typed) · difference.
- Summary: Charges, expenses, net, rate change.
- Close → day locked → report shown → **Share to WhatsApp** button.
- Past closings (with who closed) live in **Reports**.

### 7.6 Reports
- Daily / Monthly / Yearly tabs + custom range.
- Charges per day (chart), per currency, Sallam vs exchange split, expenses, net, rate change, closing differences.
- Export Excel / PDF. Share to WhatsApp.

### 7.7 People (opened from the shop menu, owners only)
- Tabs: **People | Activity**.
- People table: Name · **Phone** · **Role** (dropdown: Owner / Can edit / Can view) · **Shops** (e.g. "Eastleigh, Garissa") · Last active · Invited by · ⋯ (change role, change shops, remove).
- Filter by shop (replaces "All users"). Search. Export.
- **Invite people**: phone + role + shop checkboxes → invite sent via WhatsApp share.
- Pending invites shown with resend / cancel.
- Activity tab: who did what, filter by person / date / action.

### 7.8 Settings (opened from the shop menu)
- Shop: name, location, opening balances, closing time.
- Rates history.
- Expense categories.
- Notifications preferences.
- Language. Profile. Log out.

---

## 8. Notifications

Channels in v1: **in-app (bell, live)** + **push (PWA)**. No paid SMS alerts. SMS only for the login code. WhatsApp only through the share button.

| Type | When | To |
|---|---|---|
| Rate not set | 09:00, no rate today | Owner, Can edit |
| Day not closed | Shop closing time passed (default 21:00) | Owner, Can edit |
| Closing difference | Day closed with counted ≠ expected | Owner |
| Day closed | A day is closed (summary + share button) | Owner |
| Large row | Row above the shop's limit | Owner |
| Closed day edited | Row in a closed day edited/deleted | All Owners |
| Amanat still held | Amanat not returned by closing | Owner, Can edit |
| Invite accepted | Someone joins | Owner |
| New device login | Account used on a new phone | That user |

Rules: one per type per shop per day (no duplicates), quiet hours 22:00–07:00 for push, written in the receiver's language, kept 90 days, user can choose per shop which types to get.

---

## 9. WhatsApp share

- Text: `https://wa.me/?text=<encoded report>`.
- File (PDF/image of report): Web Share API `navigator.share({ files })`.
- Used on: Close day report, Reports, a single row (customer receipt), invites.

Day report text example:
```
*Eastleigh – 09 Oct 2026*
Rate: 129.61
Charges: 160 USD + 299 KSh
Expenses: 1,200 KSh
USD Cash: 0 | Sallam: 40,160 | KSH: 1,936,500
Amanat held: 0
Drawer: matched ✅
Closed by: Ahmed
```

---

## 10. Tech stack and structure

| Layer | Choice |
|---|---|
| Language | TypeScript |
| App | Next.js (App Router), installed as a PWA |
| UI | Tailwind CSS (logical properties only, for Arabic RTL) + shadcn/ui |
| i18n | next-intl — `en`, `so`, `ar` |
| Forms | React Hook Form + Zod |
| Data | TanStack Query; TanStack Table for the Exchange sheet |
| DB | Supabase Postgres + row-level security per shop |
| ORM | Drizzle |
| Auth | Supabase Auth, phone + OTP (SMS via Africa's Talking) |
| Realtime | Supabase Realtime (live bell, live rows) |
| Push | Web Push (VAPID) |
| Jobs | pg_cron + Supabase Edge Functions |
| Money | decimal.js |
| Export | ExcelJS |
| Charts | Recharts |
| Hosting | Vercel + Supabase |
| Errors | Sentry |

### 10.1 Data model (v2)

| Table | Key fields |
|---|---|
| users | id, name, phone, language |
| shops | id, name, location, owner_id, closing_time, large_row_limit, status |
| members | user_id, shop_id, role (owner / edit / view), last_active_at |
| invitations | phone, shop_ids[], role, invited_by, token, status, expires_at |
| balances | shop_id, kind (USD_CASH / USD_SALLAM / KSH), currency, opening_amount |
| daily_rates | shop_id, date, rate (KSh per USD), set_by |
| rows | shop_id, date, time, type (BUY_USD / SELL_USD / SALLAM_SELL / SALLAM_BUY / MOVE / EXPENSE), customer_name, amount, currency, rate_or_pct, from_balance_id, to_balance_id, other_amount, commission, commission_currency, note, created_by, deleted_at |
| amanat | shop_id, client_name, currency, amount, balance_id, status (held / returned), held_at, returned_at |
| expense_categories | shop_id, name |
| day_closings | shop_id, date, closed_by, closed_at, note |
| day_closing_lines | closing_id, balance_id, expected, amanat_held, counted, difference |
| activity_log | shop_id, user_id, action, record_type, record_id, before, after, created_at (append-only) |
| notifications | user_id, shop_id, type, title, body, link, read_at, created_at |
| notification_settings | user_id, shop_id, type, in_app, push |
| push_subscriptions | user_id, endpoint, keys |

Later (not v1): `debts`, `debt_payments`, `main_account`, `agents`.

---

## 11. Open questions

- [ ] **Agents** — staff in his shops, or outside people in the market? Do they get a morning float and return it at night? Paid by commission share or fixed fee?
- [ ] **Main account** — is it the owner's capital that funds the 5 shops (sits above the shops)?
- [ ] **Sallam buy** — always a %? Which balance does the fee come out of?
- [ ] **Debts** — confirm still out of v1.
- [ ] **Login** — SMS code or phone + PIN?
- [ ] **Offline** — does the market lose internet often enough to need offline entry?
- [ ] **Pricing** — would the client pay ~3,000 KSh / shop / month?

---

## 12. Build checklist (status: see the latest status report)

### Phase 1 – Foundation
- [ ] Next.js + TypeScript project, Tailwind, shadcn/ui set up
- [ ] PWA manifest + icons, installable on Android
- [ ] next-intl with `en`, `so`, `ar`; `<html dir>` switches to RTL for Arabic
- [ ] No hard-coded UI text (all via translation keys)
- [ ] Supabase project connected; Drizzle schema for all v1 tables (10.1)
- [ ] Migrations run cleanly from empty DB
- [ ] Row-level security: every table filtered by membership of `shop_id`
- [ ] `lib/money.ts` with decimal maths + currency formatting
- [ ] Seed script with a demo shop and a sample day

### Phase 2 – Auth, shops, people
- [ ] Auth page is the first screen (no landing page)
- [ ] Phone + OTP login (or PIN, per decision)
- [ ] Onboarding: name, language, create shop, opening balances, today's rate
- [ ] Create more shops; shop switcher in top bar
- [ ] All shops view for owners with 2+ shops
- [ ] Roles per shop: owner / edit / view
- [ ] `can(role, action)` used in UI and in server actions
- [ ] Share popup: invite by phone, role, shop checkboxes
- [ ] Only-invited access (no public link access)
- [ ] Invite sent via WhatsApp share; invite link → auth with banner → joins shop
- [ ] People list: change role, remove, last active
- [ ] Last owner cannot leave

### Phase 3 – Money core
- [ ] 3 balances per shop (USD Cash, USD Sallam, KSH) with opening amounts
- [ ] Today's rate: set, edit, history; red warning when missing
- [ ] Buy USD row with commission `(today − given) × USD`
- [ ] Sell USD row with commission `(given − today) × USD`
- [ ] Sallam sell row with commission `+amount × %`
- [ ] Sallam buy row with commission `−amount × %`
- [ ] Other amount and commission calculated by app, never typed
- [ ] Move: same currency, conversion, between shops; rate difference shown separately
- [ ] Amanat: hold, mark returned, totals held per currency
- [ ] Expenses with categories
- [ ] All writes through `lib/ledger.ts` in one transaction + activity log
- [ ] Soft delete; edits keep before/after
- [ ] Unit tests: every commission formula and the drawer maths (examples in 3.2)

### Phase 4 – Pages
- [ ] Layout: sidebar (4 items), top bar, + New menu, mobile bottom bar
- [ ] Shop menu: Settings + People buttons, switch shops, All shops, Create shop, Language, Theme, Sign out
- [ ] Sidebar foot: Charges today + Close day button
- [ ] No Team / Settings / Close day pages in the sidebar
- [ ] Home: shop card with eye toggle hiding all amounts
- [ ] Home: Charges-today chip
- [ ] Home: 5 round action buttons opening sheets (no page change)
- [ ] Home: today's rate chip editable in place
- [ ] Home: quick exchange form always open
- [ ] Home: 3 balance cards with amanat held
- [ ] Home: needs-attention list with fix buttons
- [ ] Home: today's rows with edit + swipe-delete + undo
- [ ] Exchange page: Excel-like sheet, inline add/edit, filter chips
- [ ] Exchange page: footer tally (Charges USD, KSh, total, expenses, net)
- [ ] Balance cards on Home open a statement sheet (running balance + Move button)
- [ ] KSH total line (Cash KES + M-Pesa) under the cards
- [ ] Rates banner asks for one **today's rate**, not buy and sell
- [ ] No Balances page in the sidebar
- [ ] Amanat page
- [ ] Close day sheet (opens over any page): expected, amanat held, counted, difference per balance
- [ ] Close day: note required when difference ≠ 0; day locked after close
- [ ] Owner can reopen / edit closed day with reason (logged)
- [ ] Reports: daily / monthly / yearly + custom range
- [ ] Reports: charges chart, Sallam vs exchange split, expenses, net, rate change
- [ ] Reports: past closings list with who closed
- [ ] People page (from shop menu): phone column, role dropdown, Shops column, filter by shop, ⋯ actions
- [ ] People page: Activity tab with filters
- [ ] Settings page from shop menu (shop, rates history, categories, notifications, language, profile)

### Phase 5 – Notifications and sharing
- [ ] Notifications table + live bell (Realtime) + panel + mark all read
- [ ] Web Push subscription and delivery
- [ ] Scheduled jobs: rate not set (09:00), day not closed (closing time)
- [ ] Event notifications: closing difference, day closed, large row, closed day edited, amanat still held, invite accepted, new device
- [ ] No duplicates per type/shop/day; quiet hours; receiver's language
- [ ] Notification preferences per user per shop
- [ ] Share to WhatsApp: day report text
- [ ] Share to WhatsApp: report file via Web Share API
- [ ] Share to WhatsApp: single row receipt
- [ ] Export to Excel (Exchange sheet, Reports)

### Phase 6 – Ready for the client
- [ ] Arabic RTL checked on every page
- [ ] Somali translations reviewed by a native speaker
- [ ] Works well on a cheap Android phone (speed, tap sizes)
- [ ] Sentry error tracking
- [ ] Deployed (Vercel + Supabase), custom domain
- [ ] Client's real shop set up and used for one full week
- [ ] Feedback from client collected and triaged

### Later (not v1)
- [ ] Debts and debt payments
- [ ] Main account above shops (after client answer)
- [ ] Agents (after client answer)
- [ ] Offline entry with sync
- [ ] Billing / subscriptions

---

## 13. What changed from v1 (earlier spec)

| v1 said | v2 says |
|---|---|
| Many accounts (Cash per currency, M-Pesa, EVC, Zaad, bank) | 3 balances: USD Cash, USD Sallam, KSH |
| Buy rate + sell rate per currency | One **today's rate** (market value); commission measured against it |
| Profit = spread − expenses, method undecided | Charges = Sallam commission + exchange commission, formulas in 3.2 |
| Amanat as a liability ledger with deposits/withdrawals | Simple held / returned list; subtracted at drawer count only |
| Debts in v1 | Debts later |
| "Book" page | "Exchange" page with Charges tally |
| Clients page with profiles | Customer name is just a field on a row (no client pages in v1) |
| SMS / WhatsApp API alerts | SMS only for login; WhatsApp via share button; alerts in-app + push |
| Transfer | Move |
| Share link options | Only invited people; invite via WhatsApp |
| Sidebar with Balances, Team, Settings, Close day pages | 4-item sidebar (Home, Exchange, Amanat, Reports); balances on Home; Team → People and Settings inside the shop menu; Close day is a sheet |

### Notes from building (kept in step with the code)
- The app keeps the general multi-currency model underneath (any currencies, any accounts): the owner's call. The 3 balances are the accounts whose type and currency match (core `slotOf`: USD cash, USD mobile, KES).
- The routes stay `/w/[workspaceId]` (v2's `/s/[shopId]`); the backend is still the in-browser mock behind `SarrifApi` until Supabase.
