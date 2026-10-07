# Sarrif App – Product Spec

Oct 7, 2026 · @Yussuf

## Overview

Sarrif is a daily operations app for currency exchange shops (*sarrif* is Somali for money exchange). It replaces the paper book and the Excel sheet the owner keeps today.

**Who uses it:** the shop owner, plus staff and partners the owner invites (cashiers, managers, an accountant who only views).

**What it tracks:**

- Exchanges in and out, at rates the owner sets each day
- Where money sits: cash, mobile money (M-Pesa, EVC Plus, Zaad) and bank
- Amanat: money clients leave with the shop for safekeeping
- Debts and credits: who owes the shop, and whom the shop owes
- Expenses
- The daily closing count, and profit for the day

**Core design rule:** every movement of money is one **entry** in a ledger, recorded against an **account**. Balances, the daily closing figure and profit are calculated from entries, never typed in. This also makes the Excel-style view simple: one entry is one row.

**Product principles**

1. Fast entry first. Recording an exchange takes under 10 seconds on a phone.
2. Few pages. Seven items in the sidebar, everything else lives inside them.
3. Nothing is silently changed. Every edit and delete is logged, and closed days are locked.
4. Notifications are a core feature, not an add-on. The owner should know what happened in every shop without opening each one.

## Workspaces (multiple shops)

One login can run many shops. Each shop is a **workspace**, and every record in the app belongs to exactly one workspace.

**How it works**

- A **user** is a person with one login (phone number + OTP).
- A **workspace** is one shop, e.g. "Sarrif – Eastleigh" and "Sarrif – Garissa". It has its own accounts, rates, clients, entries and closings.
- A **membership** links a user to a workspace with a role. Roles are per workspace, so a cashier can be Editor in Eastleigh and have no access to Garissa.
- The person who creates a workspace is its **Owner**. An owner can create as many workspaces as they want.
- Every table in the database carries a `workspace_id`. Every query is filtered by it. This is what keeps shops apart.

**Switching shops**

- A switcher sits at the top of the sidebar (on mobile: tap the shop name in the top bar).
- The app remembers the last shop used and opens there.
- Users with one shop never see the switcher's list, only the shop name.

**All shops view (owners only)**

- Owners with two or more shops get an "All shops" option in the switcher.
- It shows a read-only summary: profit today, cash position and closing status per shop, plus combined totals converted to the owner's base currency.
- Entries are never created in "All shops"; you pick a shop first.

**Moving money between shops**

- A **shop transfer** moves money from an account in one shop to an account in another shop with the same owner.
- It creates two linked entries: money out of shop A, money in to shop B. Both shops' balances stay correct.

**Data rules**

- Clients belong to one workspace (simplest, and staff in one shop can't see another shop's clients). See open questions.
- Currencies are global; each workspace picks which ones it trades.
- Deleting a workspace is Owner-only, needs typing the shop name to confirm, and archives rather than erases data for 30 days.

## Entities

Nineteen entities, in four groups. Everything except User and Currency carries a `workspace_id`.

**People and access**

| Entity | What it is | Key fields |
| --- | --- | --- |
| User | A person with a login | name, phone, email (optional), language, created\_at |
| Workspace | One shop | name, base\_currency, location, owner\_id, status (active / archived) |
| Member | A user's access to one workspace | user\_id, workspace\_id, role (Owner / Editor / Viewer), joined\_at |
| Invitation | A pending invite to a workspace | phone or email, role, invited\_by, token, status (pending / accepted / expired), expires\_at |
| Activity Log | Who did what, when | user\_id, action (create / edit / delete / close / reopen), record\_type, record\_id, before, after, created\_at. Append-only. |

**Money and where it sits**

| Entity | What it is | Key fields |
| --- | --- | --- |
| Currency | A currency the app knows | code (USD, KES, SOS, ETB, AED, SAR), name, symbol, decimals |
| Account | A place money sits, in one currency | name, type (Cash / Mobile money / Bank), currency, provider (M-Pesa, EVC, Zaad, bank name), opening\_balance, archived |
| Daily Rate | The owner's buy and sell rate for a day | currency, date, buy\_rate, sell\_rate, set\_by |
| Entry | One money movement on one account (the ledger) | account\_id, date, amount (+ in / − out), source\_type, source\_id, created\_by |

**Customers and obligations**

| Entity | What it is | Key fields |
| --- | --- | --- |
| Client | A known customer | name, phone, notes. Optional on exchanges (walk-ins). |
| Amanat | Money a client leaves in safekeeping | client\_id, currency, type (deposit / withdrawal), amount, account\_id, note |
| Debt | Money owed between the shop and a client | client\_id, currency, amount, direction (they owe us / we owe them), due\_date, status (open / partly paid / paid) |
| Debt Payment | A repayment against a debt | debt\_id, amount, account\_id, date |

**Daily operations**

| Entity | What it is | Key fields |
| --- | --- | --- |
| Exchange | One in/out trade | currency\_in, amount\_in, account\_in, currency\_out, amount\_out, account\_out, rate, client\_id (optional), note |
| Expense | Money spent running the shop | category (rent, salary, transport, food, other), amount, currency, account\_id, note |
| Transfer | Moving own money between accounts (same shop or another shop) | from\_account, to\_account, amount\_out, amount\_in, fee |
| Daily Closing | End-of-day count, per account | date, account\_id, expected, counted, difference, closed\_by, closed\_at |
| Notification | A message to one user | user\_id, workspace\_id, type, title, body, link, priority, read\_at, created\_at |
| Notification Setting | What a user wants to hear about | user\_id, workspace\_id, type, in\_app, push, sms |

**How they connect**

- Exchange, Expense, Transfer, Amanat and Debt Payment each create one or two **Entries**. Entries are never edited by hand; editing the source record rewrites its entries and logs the change.
- Account balance = opening balance + sum of its entries.
- Client amanat balance = deposits − withdrawals, per currency. This money is a liability; it is shown separately from the shop's own cash.
- Debt balance = amount − sum of payments.
- Profit today = exchange spread (measured at the day's rates) − expenses. See open questions on the profit method.

**Not entities (calculated on screen):** exchange today, profit today, cash on hand, amanat held, total owed to us, total we owe.

## Roles and permissions

Three roles, set per workspace. Keep it at three until a real client asks for more.

| Action | Owner | Editor | Viewer |
| --- | --- | --- | --- |
| See Home, entries, clients, reports | Yes | Yes | Yes |
| Record exchanges, expenses, amanat, debts, transfers | Yes | Yes | No |
| Set today's rates | Yes | Yes | No |
| Do the daily closing | Yes | Yes | No |
| Edit or delete an entry from today | Yes | Own entries only | No |
| Edit or delete an entry from a closed day | Yes (logged, needs a reason) | No | No |
| Reopen a closed day | Yes | No | No |
| Add or archive accounts | Yes | No | No |
| Invite people, change roles, remove members | Yes | No | No |
| See the activity log | Yes | Own actions only | No |
| Shop settings, delete shop | Yes | No | No |
| Export to Excel | Yes | Yes | Yes |

A workspace can have more than one Owner (for business partners). The last Owner cannot leave or be removed.

## App flow

There is no landing page: the auth page is the first screen, and one phone + OTP flow both signs up and signs in.

&#91;embedded content: sign-in and onboarding · 2 decisions\]

An invite always wins: an invited person joins that shop directly and never sees shop setup.

**First-time owner (target: under 3 minutes)**

1. Enter phone number, then the OTP code
2. Enter name and pick a language
3. Create the shop: name, location, base currency, currencies traded
4. Add accounts with opening balances (suggested: Cash for each currency, M-Pesa KES)
5. Set today's buy and sell rates
6. Land on Home, with a prompt to invite staff

**Invited staff member**

1. Owner invites by phone; an SMS / WhatsApp link arrives
2. Link opens the auth page with the invite banner
3. Phone + OTP, then name and language
4. Lands on that shop's Home, with only what their role allows

**Daily routine**

1. Morning: open the app → rates reminder if unset → set rates
2. During the day: + New → Exchange (most entries), plus expenses, amanat and debts as they happen
3. Evening: Close day → count each account → close
4. Owner gets the daily summary for each shop

## Navigation

Six main pages and two at the foot of the sidebar. Recording things never needs its own page: it happens from one **+ New** button that is on every screen.

**Sidebar (desktop and tablet)**

| Position | Item | What it is for |
| --- | --- | --- |
| Top | Shop switcher | Current shop name; tap to switch shop, open "All shops" or create a new shop |
| 1 | Home | Today at a glance |
| 2 | Book | Every entry, Excel-style rows: exchanges, expenses, amanat, debts, transfers |
| 3 | Clients | Client list, each with amanat held and debts |
| 4 | Accounts | Cash, mobile money and bank balances; transfers |
| 5 | Close day | The end-of-day count |
| 6 | Reports | Profit, totals and exports over any date range |
| Foot | Team | Members, invitations, activity log (Owner) |
| Foot | Settings | Shop details, currencies, rates history, notification and language settings |

Expenses and exchanges do not get their own sidebar items. They are rows in the Book, with a filter chip for each type, so there is one place to look.

**Top bar (every page)**

- Page title and today's date
- Notification bell with an unread count (opens the notification panel)
- Language switch (EN / SO / AR)
- **+ New** button

**+ New menu** (the same five actions everywhere)

1. Exchange
2. Expense
3. Amanat (deposit or withdrawal)
4. Debt (new debt or repayment)
5. Transfer

**Mobile**

- Bottom bar: Home · Book · **+** (centre, large) · Clients · More
- More opens: Accounts, Close day, Reports, Team, Settings
- Shop switcher: tap the shop name in the top bar

## Pages

Ten screens in total: the auth page, six main pages, Team, Settings and the notification panel.

### Auth (the landing page)

- Logo, one line on what Sarrif is, language switch
- Phone number field (country code defaults to +254) → Send code
- 6-digit OTP field → Continue
- If the user opened an invite link, a banner says "You've been invited to *Shop name* as *Role*"
- No marketing page, no sign-up/sign-in split: the same phone + OTP flow creates or logs in the account

### Home

Answers "how is the shop doing right now?" in one screen.

1. **Alerts strip** (only when something needs action): rates not set, yesterday not closed, debts overdue, closing difference
2. **Today's rates card**: buy / sell per currency, with "Edit rates". If not set yet, this card is the first thing shown and blocks nothing but stays red.
3. **Today in numbers**: exchanged in, exchanged out, profit today, expenses today
4. **Money position**: balance per account, grouped by Cash / Mobile / Bank, with a total in base currency
5. **Obligations**: amanat held for clients, owed to us, we owe
6. **Recent activity**: last 10 entries with who recorded them
7. **Quick buttons**: New exchange (large), Expense, Amanat

In "All shops" mode, Home shows one row per shop (profit today, cash total, closed yes/no) and combined totals.

### Book

The Excel-like page. One row per entry, newest first.

- Columns: time, type, client, currency in, amount in, currency out, amount out, rate, account, recorded by, note
- Filter chips: All · Exchange · Expense · Amanat · Debt · Transfer
- Date picker (defaults to today), search by client or note
- Inline editing on desktop (tab between cells like Excel); tap a row on mobile to open it
- Rows from closed days show a lock icon
- Export the current view to Excel

### Clients

- List: name, phone, amanat balance per currency, net debt, last activity
- Filters: Holds amanat · Owes us · We owe
- Client page: contact details, balances at the top, then their full history (from the Book), plus buttons for Amanat in, Amanat out, New debt, Record payment, Send statement (WhatsApp / SMS)

### Accounts

- Cards per account: name, type, currency, balance, today's in and out
- Tap an account → its entries
- Transfer button (between accounts, or to another shop's account)
- Owner: add or archive an account, set opening balance

### Close day

- One row per account: expected (calculated), counted (typed in), difference
- Difference turns red when it is not zero; a note is required to close with a difference
- Summary: exchanged, profit, expenses for the day
- **Close day** locks the day and sends the daily summary notification
- Past closings listed below, with who closed each

### Reports

- Date range picker (today, this week, this month, custom)
- Profit by day (chart) and by currency
- Volume exchanged per currency
- Expenses by category
- Amanat and debt totals over time
- Export any report to Excel or PDF

### Team

- Members: name, role, last active; change role or remove (Owner)
- Invite: phone or email + role → sends a link by SMS / WhatsApp
- Pending invitations, with resend and cancel
- Activity log: who did what, filter by person, action and date

### Settings

- Shop: name, location, base currency, currencies traded
- Rates history
- Expense categories
- Notifications: what to receive and how (see below)
- Language and number format
- Profile: name, phone, log out

### Notification panel

Opened from the bell. Unread first, grouped Today / Earlier, each item tappable to the record it is about. "Mark all read" at the top. A full Notifications page is reachable from "See all".

## Notifications

Notifications are how an owner runs several shops without standing in each one. Every notification is tied to a workspace and links to the record it is about.

**Channels**

- **In-app**: the bell and panel. Always on, every type.
- **Push** (phone): on by default for High priority.
- **SMS / WhatsApp**: off by default; for the daily summary and critical alerts only. Costs money per message, so it is opt-in.
- Later: email for weekly reports.

**Notification types**

| Type | Triggered when | Goes to | Priority |
| --- | --- | --- | --- |
| Rates not set | 9:00 and rates for today are missing | Owner, Editors | High |
| Day not closed | Closing time set by the shop (default 21:00) passes with no closing | Owner, Editors | High |
| Closing difference | A day is closed with a counted ≠ expected difference | Owner | High |
| Daily summary | A day is closed | Owner (Viewers optional) | Normal |
| Large transaction | An entry above the shop's limit (e.g. $5,000) is recorded | Owner | High |
| Past entry changed | An entry from a closed day is edited or deleted | All Owners | High |
| Entry deleted | Any entry is deleted | Owner | Normal |
| Debt due | A debt reaches its due date | Owner, Editors | Normal |
| Debt overdue | A debt is 3 days past due (repeats weekly) | Owner | High |
| Amanat withdrawal | A client withdraws amanat | Owner | Normal |
| Low balance | An account drops below its set minimum | Owner, Editors | High |
| Invitation accepted | Someone joins the shop | Owner | Low |
| Role changed | Your own role in a shop changes | That user | Normal |
| Signed in on a new device | Your account logs in on a new phone | That user | High |

**Rules**

- Users choose per shop which types they receive and on which channel (Settings → Notifications). High-priority types can't be fully switched off for Owners; only the channel can change.
- No duplicates: one "Rates not set" per shop per day, even if several people are reminded.
- Quiet hours (default 22:00–07:00): push and SMS wait until morning, except new-device sign-ins.
- Each notification is written in the receiver's own language.
- Notifications are kept for 90 days.

**Daily summary content** (sent at closing)

Shop name and date · exchanged in and out per currency · profit · expenses · closing difference (if any) · amanat held · debts owed to us · who closed the day.

## Language and right-to-left

Launch with English, Somali and Arabic. More can be added later without code changes.

- Every label lives in a translation file (`en.json`, `so.json`, `ar.json`); nothing is hard-coded.
- Arabic flips the whole layout right-to-left: the sidebar moves to the right, and arrows and chevrons mirror. Use logical CSS (`margin-inline-start`, not `margin-left`) from day one.
- Numbers and currency codes stay left-to-right inside Arabic text, so amounts read correctly.
- Language is saved per user, not per shop: two people in the same shop can use different languages.
- Client names and notes are stored as typed; they are never translated.

## Open questions

- [ ] **Profit method**: measure each trade against the day's rates, or against the average cost of the currency held? Ask the client how they work it out on paper today.
- [ ] **Clients across shops**: keep clients separate per shop (current plan), or share one client list across an owner's shops?
- [ ] **Base currency**: is USD the right default for reporting, or KES for shops in Kenya?
- [ ] **Closing time**: one fixed time per shop, or can a day be closed whenever the cashier finishes?
- [ ] **Large transaction limit**: what amount should trigger the alert by default?
- [ ] **Offline use**: do shops lose internet often enough that entries must work offline and sync later?
- [ ] **SMS / WhatsApp**: which provider, and who pays for messages?
