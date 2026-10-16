# Sarrif – Profit forms: Sallam + Exchange (exactly as the client described)

_11 Oct 2026. This file overrides SARRIF_PLAN.md v4 sections 3.2, 3.3, 3.4, 7.3 and the earlier version of this file. Ignore any "Swap", "Deal", "Customer gave / You gave", or "M-Pesa ↔ cash for %" idea — those were wrong._

---

## 0. For the agent reading this

1. Read the whole file before changing code.
2. The money logic has **only 3 things**: **Sallam**, **Exchange**, **Move**. Build exactly these. Do not generalise. Do not add other combinations.
3. Run the tests in section 6. Report what you changed.

---

## 1. The client's own words

> **Way 1 – Sallam.** "You have 20,000 USD in cash and 20,000 in Sallam. You sell it to someone who will send you the money to Sallam. You gave it to him for 0.8%, so 20,000 × 0.8% = 160, that's your profit. Your Sallam should show 40,160."
> Sometimes he **buys** Sallam and the market seller takes a small % from him (e.g. 0.1%).

> **Way 2 – Exchange.** "You bought the dollar at 127 and you sell it at the market value 129.61. The difference is your commission." The whole day's commission from people who came to exchange.

> **Move.** "Moving your money from one account to another freely. You move 1.5M KSh from M-Pesa and turn it into USD, now it's in your USD drawer. As much as you want, or partial."

Only Sallam and Exchange make profit. Move never does. Amanat and expenses are separate (unchanged).

---

## 2. Sallam (profit way #1) — dollars only, profit is a %

### Form (plain words, big inputs)
```
SALLAM
  ( Sold )  ( Bought )                       ← two big buttons, Sold selected

  Dollars cash        [ 20,000 ]
  Percent             [ 0.8 ] %              ← pre-filled with last % used

  → Sallam receives   20,160 $               ← calculated
  ✅ Profit           +160 $                 ← calculated, green

  [ + name ]  [ + note ]
  [              SAVE              ]
```

### Maths
| | Cash $ | Sallam $ | Profit |
|---|---|---|---|
| **Sold** (he earns the %) | − amount | + amount × (1 + %) | **+ amount × %** |
| **Bought** (seller takes the %) | − amount | + amount × (1 − %) | **− amount × %** |

Examples:
- Sold 20,000 at 0.8% → Cash −20,000 · Sallam +20,160 · **+160 $**
- Bought 20,000 at 0.1% → Cash −20,000 · Sallam +19,980 · **−20 $**

Accounts are always **$ Cash** and **$ Sallam (Salaam Bank)**. No account choice on this form.

---

## 3. Exchange (profit way #2) — dollars ↔ shillings, profit is the rate difference

### Form
```
EXCHANGE                                today's rate 129.61
  ( Bought $ )  ( Sold $ )                   ← two big buttons

  Dollars             [ 100 ]
  Rate                [ 127.00 ]             ← pre-filled with today's rate

  → Shillings         12,700 KSh             ← calculated
  ✅ Profit           +261 KSh               ← calculated

  Dollars in/out:   ( Cash )  ( Sallam )      ← default Cash
  Shillings in/out: ( Cash )  ( M-Pesa )      ← default Cash
  [ + name ]  [ + note ]
  [              SAVE              ]
```

### Maths (today = today's rate)
| | Dollars | Shillings | Profit (KSh) |
|---|---|---|---|
| **Bought $** (customer brings dollars) | + amount | − amount × rate | **(today − rate) × amount** |
| **Sold $** (customer takes dollars) | − amount | + amount × rate | **(rate − today) × amount** |

Examples (today 129.61):
- Bought 100 $ at 127.00 → $ +100 · KSh −12,700 · **+261 KSh**
- Sold 200 $ at 129.80 → $ −200 · KSh +25,960 · **+38 KSh**

If today's rate is not set: show **"Set today's rate"** button instead of profit; Save disabled until set. Store today's rate on the row at save time.

---

## 4. Move (never profit)

```
MOVE
  From   ( $ Cash ) ( $ Sallam ) ( KSh Cash ) ( M-Pesa )
  To     ( $ Cash ) ( $ Sallam ) ( KSh Cash ) ( M-Pesa )   ← also other shops, for owners
  Amount [ 1,500,000 ]
  Rate   [ 129.40 ]          ← only appears if From and To are different currencies
  → To receives  11,592 $    ← calculated
  [ SAVE ]
```
- Any account to any account (and to another shop for owners). From ≠ To.
- No profit line. Ever.

---

## 5. Profit page layout

```
PROFIT – Sun 11 Oct                      [ + Sallam ]  [ + Exchange ]

SALLAM
09:12  Sold 20,000 $ cash at 0.8%  → Sallam 20,160 $        +160 $
11:30  Bought 20,000 $ at 0.1%     → Sallam 19,980 $         −20 $
                                             Sallam profit: +140 $

EXCHANGE
10:40  Bought 100 $ at 127.00      → paid 12,700 KSh       +261 KSh
14:05  Sold 200 $ at 129.80        → got 25,960 KSh         +38 KSh
                                          Exchange profit: +299 KSh

EXPENSES                                              [ + Expense ]
13:00  Lunch                                           −600 KSh

──────────────────────────────────────────────────────────────
Profit      +140 $  ·  +299 KSh
Expenses             −600 KSh
Net         +140 $  ·  −301 KSh      ≈ +137.68 $
```
- **+ Sallam** and **+ Exchange** open the forms above as sheets (also from Home quick actions).
- Rows are short sentences. No grid, no column headers, no column menus, no checkboxes.
- Tap a row → same form filled in → edit or delete (logged).
- Home quick actions: **Sallam · Exchange · Move · Amanat · Expense**.

---

## 6. Tests

- [ ] Sallam Sold 20,000 @ 0.8 → Cash −20,000, Sallam +20,160, profit +160 $
- [ ] Sallam Bought 20,000 @ 0.1 → Cash −20,000, Sallam +19,980, profit −20 $
- [ ] Exchange Bought 100 @ 127, today 129.61 → KSh −12,700, profit +261 KSh
- [ ] Exchange Sold 200 @ 129.80, today 129.61 → KSh +25,960, profit +38 KSh
- [ ] Exchange with no today's rate → Save disabled, "Set today's rate"
- [ ] Changing today's rate later does not change saved rows
- [ ] Move 1,500,000 M-Pesa → $ Cash at 129.40 → M-Pesa −1,500,000, $ Cash +11,592.04, no profit
- [ ] Move with From = To → blocked
- [ ] Totals: Sallam profit, Exchange profit, Expenses, Net match the examples in section 5
- [ ] Profit/Gets/Shillings never typeable

_Note (11 Oct, from the build): 1,500,000 ÷ 129.40 = 11,591.96, not 11,592.04; the test uses 11,591.96._

---

## 7. Remove

- Anything called **Swap**, **Deal**, **Earn / Pay**, **Customer gave / You gave**
- Percent-fee deals between **M-Pesa and KSh cash** (not a client feature)
- Grids, column headers/menus, type icons, checkboxes, horizontal scroll on the Profit page

## 8. Data

| Table | Fields |
|---|---|
| `sallam` | shop_id, date, time, side (SOLD / BOUGHT), amount_usd, pct, sallam_amount, profit_usd, customer_name, note, created_by, deleted_at |
| `exchanges` | shop_id, date, time, side (BOUGHT / SOLD), amount_usd, rate, today_rate, kes_amount, usd_account (CASH / SALLAM), kes_account (CASH / MPESA), profit_kes, customer_name, note, created_by, deleted_at |
| `moves` | from_shop_id, from_account_id, to_shop_id, to_account_id, amount_out, rate (nullable), amount_in, note, created_by, deleted_at |

All writes through `lib/ledger.ts` in one transaction + activity log.
