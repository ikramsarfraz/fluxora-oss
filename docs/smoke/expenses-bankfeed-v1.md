# Smoke test plan — Expenses + Bank Feed v1

End-to-end walkthrough covering the surfaces shipped on
`feature/ai-invoice-import` during the v1 audit cleanup. Run as a
single sitting on a tenant with at least:

- 1 admin (or owner) portal user
- 1 accounting role user (for the separation-of-duties check)
- 1 Plaid sandbox connection with ≥ 2 linked bank accounts and recent
  posted transactions (use the standard `ins_109508` / `user_good` /
  `pass_good` flow if you don't already have one)
- 1 open AP supplier invoice the matcher can find (anything posted
  with a known total)

Migration prerequisites: apply through `0064_expense_approval_workflow`
before starting. Confirm `pnpm db:migrate` ran cleanly and the
expenses table has `status` (default `draft` for new rows, backfilled
to `approved` for historical rows).

---

## 0. Pre-flight (5 min)

- [ ] `pnpm install` clean
- [ ] `pnpm build` succeeds
- [ ] `pnpm lint` succeeds (warnings ok)
- [ ] `pnpm test:unit` — all green; **expect 61+ tests including
  `plan-recurring-instances`, `expense-status`, `transfer-pairing`**
- [ ] `pnpm dev` running on the tenant subdomain (e.g.
  `acme.localtest.me:3000`)
- [ ] Console + network panel open

---

## 1. Bank activity — empty state (2 min)

Pre-condition: sign in as an admin in a tenant with **zero** Plaid
connections (use a fresh tenant or disconnect existing ones).

- [ ] Navigate `/bank-activity`.
- [ ] Page shows a single dashed-border card: **"Connect your bank to
  get started"** with a "Connect a bank" CTA.
- [ ] No accounts strip, no filter chips, no transaction list rendered.
- [ ] CTA links to `/settings/integrations/banks`.

---

## 2. Bank activity — connect + sync (5 min)

- [ ] At `/settings/integrations/banks`, link a Plaid sandbox bank
  with 2+ accounts.
- [ ] Wait for `INITIAL_UPDATE` webhook + initial sync.
- [ ] Return to `/bank-activity`.
- [ ] Account tiles render with: institution name, current balance,
  account name + mask, and a **colored health dot** (green = synced
  within 24h, yellow = stale/never, red = requires_reauth). Hover the
  dot — tooltip reads e.g. "Synced 3m ago".
- [ ] Total cash tile = sum of the account balances.
- [ ] Header shows "Synced 3m ago" (or similar) in the meta line.

### Manual sync

- [ ] Click **Sync now**. Button label changes to "Syncing…" with a
  spinning refresh icon.
- [ ] Toast confirms count: e.g. "Synced 1 bank: 3 new, 1 updated."
- [ ] Click **Sync now** again when nothing has changed. Toast reads
  e.g. "Synced 1 bank. No new transactions."
- [ ] As a sales-role user (no `record_payment` or
  `record_supplier_payment`), click Sync now — expect an error toast
  "Forbidden: Your role does not allow reconciling bank transactions."

---

## 3. Bank activity — filter chips + search + sort (5 min)

### State filter chips

- [ ] 6 chips render in order: All / Matched / Pending review /
  Unmatched / Pending settlement / Mystery, each with a count.
- [ ] Click each chip. List filters to that subset. Counts on the
  chips themselves do **not** change as you click.
- [ ] When **Pending settlement** is active, all visible rows show
  the "Pending settlement" badge inline.
- [ ] When **Mystery** is active, every visible row carries the
  "Mystery" red chip.

### Search

- [ ] Type a merchant name fragment in the search input — list
  filters in real time across merchant name + raw description +
  matched invoice number.
- [ ] Clear the search — full filtered list returns.
- [ ] Search with no matches — empty state shows `No transactions
  match "..."` instead of the generic empty copy.

### Sort dropdown

- [ ] Toggle sort: Date (newest) → Date (oldest) → Amount (largest) →
  Amount (smallest). The list reorders client-side without a refetch.
- [ ] Amount sort treats +$X inflow and -$X outflow as the same
  magnitude (a $5,000 deposit and a $5,000 withdrawal sit next to
  each other under "Amount largest first").

### Per-account filter

- [ ] Click one of the account tiles. Tile gets a green border;
  transaction list narrows to that account only.
- [ ] Click **Total cash** — filter clears, all transactions return.

### URL persistence

- [ ] Set filter=mystery, sort=amount-desc, search="amazon", and
  click an account. URL search params reflect all four.
- [ ] **Refresh the page** — same view restored from the URL.
- [ ] Copy URL into a new tab — same view loads for any user with
  access.

---

## 4. Bank activity — bulk mystery dismiss (3 min)

Pre-condition: at least 3 mystery outflows present. (Sandbox accounts
typically have $500+ unmatched outflows that flag as mystery.)

- [ ] Switch to the **Mystery** filter chip.
- [ ] A bulk-action bar appears above the list with `Select all`
  checkbox + a `Dismiss selected` button (disabled until selection).
- [ ] Tick 2 rows individually — bar reads "2 selected"; button
  enables and reads "Dismiss 2".
- [ ] Tick the select-all checkbox — all visible mystery rows
  selected; selected rows have a warning-tone background.
- [ ] Click **Dismiss N** — toast confirms count, selected rows
  disappear from the Mystery view, Mystery chip count drops.
- [ ] Switch to another filter then back to Mystery — selection
  state is reset (no stale selection across filter changes).

---

## 5. Bank activity — re-auth banner (2 min)

Pre-condition: trigger a Plaid sandbox `ITEM_LOGIN_REQUIRED` webhook
(via the sandbox dashboard) or manually flip a `plaid_connection.status`
to `requires_reauth` in the DB.

- [ ] Refresh `/bank-activity`.
- [ ] Yellow banner at the top: "Reconnect required: <institution
  name> — new transactions won't sync until you sign in again."
- [ ] **Reconnect** button links to `/settings/integrations/banks`.
- [ ] The corresponding account tile's health dot is red; tooltip:
  "Reconnect required".

---

## 6. Bank activity — match confirmation + AR honesty (3 min)

- [ ] Find a `pending_review` transaction with a matched supplier
  invoice. Click the row — match detail block expands inline with
  amount / payee / timing factor cards.
- [ ] Click **Confirm match** — toast "Match confirmed. Bill marked
  as paid.", the supplier invoice's status flips to paid, the chip
  count moves Pending → Matched.
- [ ] Find a `pending_review` AR match (inbound bank txn matched to a
  sales invoice). Confirm it. Verify the payments table has a new row
  with `created_by_user_id = current user`; sales invoice
  `amount_paid`, `balance_due`, and `status` updated atomically.
- [ ] **Critical regression check (audit fix):** Inflows that match
  AR invoices should NEVER auto-apply — they all go to pending_review
  until a user confirms. Verify by inducing a fresh AR match (sandbox
  fire-transaction) and confirming it shows up as pending_review, not
  auto_applied.

---

## 7. Bank activity — transfer pairing (3 min)

Pre-condition: 2 linked accounts (account A + account B). Use the
Plaid sandbox to fire a $500 outflow on A and a $500 inflow on B
within 3 days of each other.

- [ ] After sync completes (manual sync if impatient), find both
  transactions on `/bank-activity`.
- [ ] Both rows show the cyan **Transfer** badge inline next to the
  merchant name.
- [ ] Neither row is flagged as a Mystery outflow (the pair detector
  retracts the mystery flag).
- [ ] Inspect the DB: both rows share the same `transfer_pair_id`.

---

## 8. Inbox → bank-activity link (1 min)

Pre-condition: 2+ mystery outflows so the inbox card surfaces
"+N more".

- [ ] At `/inbox`, the Mystery outflow card renders with the largest
  unaddressed mystery.
- [ ] Click the "+N more" link — opens `/bank-activity` in the same
  tab (no broken link).

---

## 9. Expenses listing — filters + CSV export (5 min)

Pre-condition: ≥ 20 expense rows across multiple categories, payment
methods, dates, statuses.

### Filters

- [ ] Open `/expenses`. Filter bar above the table shows: Date from /
  to, Min / Max amount, Method, Type, Status — plus a Clear filters
  button (hidden until something is set).
- [ ] Set Date from = 30 days ago, Date to = today. List narrows to
  that window. Clear button appears.
- [ ] Add Min amount = 50. List narrows further. Empty-state text
  shows correctly if no rows match.
- [ ] Set Method = Cash. Then change Type to "Schedules" — only
  recurring-parent rows show.
- [ ] Set Status = Submitted — list scopes to the approval queue.
- [ ] Click **Clear filters** — all filters reset; URL search params
  cleared.

### Status pill

- [ ] In the Status column, pills render with the new shared
  `StatusPill` palette (matches the orders + supplier-invoices
  listings visually): info-tone for Submitted, success-tone for
  Approved/Paid, danger-tone for Rejected, neutral for Draft.

### CSV export

- [ ] Apply Status = Approved + Date from = Jan 1.
- [ ] Click **Export CSV** in the header. Download triggers; filename
  is `expenses-<YYYY-MM-DD>.csv`.
- [ ] Toast confirms count: e.g. "Exported 14 expenses."
- [ ] Open the CSV — only rows matching the active filters appear.
  Columns include: Expense date, Category, Amount, Payment method,
  Note, Recurrence, Recurrence end, Is schedule, Is auto-generated,
  Created by, Created at.

---

## 10. Expense detail — recurrence visibility (3 min)

Pre-condition: 1 recurring schedule expense (e.g. Monthly rent) +
its materialized instances from the cron.

### On the schedule

- [ ] Open the schedule's detail page.
- [ ] Header badge area shows both the category chip and the status
  pill (e.g. "Draft" or "Approved").
- [ ] **Recurring schedule** section renders with: Repeats / First
  run / Ends / Next due, plus an "Upcoming: <date>, <date>, <date>"
  list.

### On a materialized instance

- [ ] Open one of the instance rows.
- [ ] **Recurring schedule** section reads "Auto-generated by a
  recurring schedule. View schedule" — link navigates back to the
  parent row.

---

## 11. Expense receipts — upload / view / delete (5 min)

Pre-condition: any expense detail page open. R2 credentials configured
in env (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET_NAME`).

### Empty state

- [ ] **Receipts** section renders below Recurrence with a dashed
  empty-state card: "No receipts attached yet" + "Use Upload to
  attach a photo or PDF."
- [ ] "Upload receipt" button shows accepted formats / max size copy
  inline: "JPEG, PNG, WebP, HEIC, or PDF · max 10 MB".

### Happy path upload

- [ ] Click **Upload receipt** → file picker opens with appropriate
  accept filter (no .exe in the picker).
- [ ] Pick a JPEG under 10 MB. Button reads "Uploading…"; toast on
  success "Receipt uploaded."
- [ ] New row appears in the receipts list: filename + size + MIME
  + "uploaded <date>". Two ghost buttons: Download, Remove.
- [ ] Verify R2: object exists under
  `tenants/<tenant-id>/expenses/<expense-id>/<file-id>.jpg`.
- [ ] DB: one `files` row (status=ready) + one `expense_attachments`
  pivot row with the correct tenant_id.

### Download

- [ ] Click **Download**. New tab opens with the signed R2 URL —
  image renders inline.
- [ ] Wait > 5 min, click the same signed URL — receives 403
  (signed URL expired; design intent).
- [ ] Click Download again on the row — fresh signed URL works.

### Remove

- [ ] Click **Remove**. Toast: "Receipt removed."
- [ ] Row disappears from the list.
- [ ] DB: `expense_attachments` pivot row gone, `files` row gone,
  R2 object gone (or scheduled for sweep).

### Validation errors

- [ ] Try uploading a `.zip` or other non-whitelisted MIME — picker
  may block, or upload fails with toast: "Unsupported file type "..."."
- [ ] Try uploading a > 10 MB file — toast: "Receipt is too large
  (max 10 MB)."

### Permission check

- [ ] Sign in as a sales-role user (no `canManageExpenses`). Receipts
  section renders **without** the Upload button and **without** the
  Remove button per row. Download still works.

---

## 12. Approval workflow — full lifecycle (10 min)

Pre-condition: 2 portal users in the same tenant — `alice` (accounting
or admin role) and `bob` (also a manager role).

### Draft → Submitted (alice)

- [ ] Sign in as alice. Create a new expense — verify it lands in
  Draft status (badge + list column).
- [ ] Detail page shows the **Approval** section with timeline copy:
  "This expense is a draft. Submit it for approval to start the
  workflow." Action buttons: only **Submit for approval** is visible.
- [ ] Click **Submit for approval** — toast "Submitted for approval.";
  badge flips to Submitted (info tone); section timeline now reads
  "Submitted on …".

### Same-actor approve guard (alice)

- [ ] Still as alice on the same expense, the **Approve** button is
  visible (alice has the role) but **disabled** with hover tooltip
  "You can't approve an expense you submitted."
- [ ] Click anyway — nothing happens (button disabled).

### Approve (bob)

- [ ] Sign in as bob. Open the same expense. Approve is enabled.
- [ ] Click **Approve** — toast "Expense approved."; badge flips to
  Approved (success tone); timeline reads "Approved on …".
- [ ] Verify DB: `approved_at` populated, `approved_by_user_id = bob`.

### Reject + reason (bob)

- [ ] Create another draft as alice, submit it.
- [ ] As bob, click **Reject**. Modal opens with textarea +
  placeholder example. Reject button is disabled until a reason is
  typed.
- [ ] Type a 5-character reason, click Reject. Toast "Expense
  rejected." Badge flips to Rejected (danger tone). Timeline reads
  "Rejected on …" with a sub-line "Reason: <your text>".

### Return to draft → resubmit (alice)

- [ ] As alice on the rejected expense, **Return to draft** button is
  visible. Click — toast "Returned to draft." Badge flips to Draft.
  The rejection reason text stays visible above the buttons (preserved
  as historical context per the service).
- [ ] Edit the expense (e.g. fix amount), click **Submit for approval**
  again. Verify the row is back in Submitted state and `rejected_at`
  + `rejection_reason` are cleared.

### Mark paid (accounting)

- [ ] Approve the expense again (as bob). Now Approved.
- [ ] **Mark as paid** button is visible. Click — toast "Marked as
  paid." Badge flips to Paid (success tone), `paid_at` +
  `paid_by_user_id` populated.
- [ ] On a Paid row, no action buttons render (terminal state).

### Reject reason length cap

- [ ] In the reject dialog, paste a > 1000-char string. Submit. Server
  error toast: "Rejection reason is too long (max 1000 characters)."

### Status filter in queue view

- [ ] `/expenses?status=submitted` — list scopes to the approval queue.
  Useful as an approver bookmark.
- [ ] Same for `?status=approved` (accounting's to-pay queue).

---

## 13. Materialize-cron sanity (2 min)

- [ ] Hit `/api/cron/materialize-recurring-expenses` (auth as needed).
  Response shape: `{ schedulesProcessed, instancesCreated }`.
- [ ] Verify the cron creates instances only up to today, respects
  `recurrenceEndDate` (returns nothing past it), and the safety cap
  bounds runaway creation (default 36 per schedule).
- [ ] If `unit/plan-recurring-instances.test.ts` passes, the math is
  covered — this is mostly an integration sanity check.

---

## 14. Cross-surface regression (3 min)

- [ ] `/orders`, `/customers`, `/products`, `/suppliers`,
  `/supplier-invoices`, `/inventory`, `/lots`, `/price-chart` —
  navigate each, confirm they still render, list rows visible, no
  console errors.
- [ ] Order detail, customer detail, supplier-invoice detail — open
  each, confirm status pills render with the same palette tones as
  the new expense status pills (consistency check after the
  design-system pass).
- [ ] Settings → integrations → banks — connect / disconnect still
  works.

---

## 15. Bank-activity pagination + design-system pass (3 min)

Added later — verify the post-merge polish on `/bank-activity`.

- [ ] Filter chips render as a `ToggleGroup` (rounded segmented
  control on a `bg-divider` track), not the pre-merge pill row.
- [ ] Account tiles use card-surface tokens; the selected tile shows
  a `ring-success-fg` outline; Total cash tile uses `bg-ink`.
- [ ] "Link to bill" inline button on unmatched outflows is the
  shadcn `Button` primitive (rounded-md, default variant), not the
  pre-merge inline-styled ink pill.
- [ ] Pagination footer at the bottom of the transaction list: Rows
  selector left, "N-M of total" centre, prev/next + page indicator
  right. Default `pageSize=20`; options are 10/25/50/100.
- [ ] `?page=` + `?pageSize=` round-trip through the URL alongside
  `?filter=` / `?sort=` / `?q=` / `?account=`. Refresh keeps the page.
- [ ] Click "Link to bill" — modal opens **centered** (shadcn
  `Dialog`, `sm:max-w-2xl`), not anchored to the bottom of the
  viewport. Inside: proximity tabs are a `ToggleGroup` matching the
  outer filter chips; the exact-match row has a `border-l-success-fg`
  + `bg-success-bg/40` accent; Link buttons are shadcn `Button`s.

---

## 16. Soft-delete / void (3 min)

Added later — verify issue #270 + migrations 0065.

Pre-condition: `pnpm db:migrate` has applied `0065_expense_soft_delete`
(adds `expenses.deleted_at` + `expenses.deleted_by_user_id` +
`expenses_tenant_deleted_at_idx`).

### List action

- [ ] On `/expenses`, the row action menu reads **"Void"** (not
  "Delete"). Confirm dialog title is "Void expense"; body explains
  hidden-from-listing + cron-stops + restorable-from-audit; primary
  button reads "Void"; toast on success reads "Expense voided."
- [ ] After voiding, the row disappears from the listing immediately.
- [ ] Verify in DB: `expenses.deleted_at` is set; `deleted_by_user_id`
  matches the current user.

### Detail action

- [ ] On `/expenses/<id>` (a live row), the header "Delete" button is
  now **"Void"** with the same trash icon; confirm dialog mirrors the
  list dialog's copy ("Void this expense for $X on …"); button reads
  "Void" / "Voiding…"; success toast "Expense voided." and router
  pushes back to `/expenses`.

### Idempotency + 404 behavior

- [ ] Navigate directly to a known-voided expense's URL
  (`/expenses/<id>`) — page should resolve to "Expense not found"
  (the `getExpenseById` filter excludes voided rows).
- [ ] If you can force a double-click on Void (slow network), only
  the first request succeeds. The second receives
  "Expense not found or already voided." in a toast — no duplicate
  audit rows, no second `deleted_at` overwrite.

### Filter + export + cron coverage

- [ ] Apply `?status=submitted` (or any other filter) to `/expenses`
  — voided rows still excluded. Same for "Schedules", "Auto-generated",
  date-range, amount-range, search-text. Counts on the chips reflect
  only live rows.
- [ ] Click **Export CSV** with any filter set. Open the file — no
  voided row appears in any column.
- [ ] If you have a recurring schedule, void it. Wait for the
  materialize cron (or hit
  `/api/cron/materialize-recurring-expenses`). Verify it does **not**
  create new instances for the voided schedule. Existing materialized
  instances stay live (they happened, they're real).

### Activity timeline

- [ ] Void an expense (don't navigate away). Re-fetch its detail page
  is now 404, so the activity timeline isn't directly visible —
  intentional for v1. The `expense.voided` event is captured in the
  `deletedAt` / `deletedByUserId` columns and will surface once the
  voided-expenses view (audit follow-up) ships.

### Cross-tenant / RBAC

- [ ] Sign in as a sales-role user (no `canManageExpenses`). The
  list row action menu does **not** include "Void"; the detail page
  does not render the "Void" button. Confirm a direct POST to the
  delete action also rejects with "Your role does not allow…".

---

## What to file as a bug

If anything in sections 1–16 fails, file under the v1 audit follow-up
backlog. Reference the merge commit `c5c680d8` and the section number.

Known deferred items (NOT bugs — already filed):
- **#258** expense ↔ bank-feed reconciliation match-row integration
- **#287** drizzle/meta/ snapshot drift — `pnpm db:generate` is
  currently blocked; migrations 0065 + 0066 are hand-written
  exceptions until that's fixed.

Recently closed:
- **#269** shipped in 2e7b1f20 (partial unique indexes on
  payment_matches + onConflictDoNothing in matcher) + migration 0066.
- **#270** shipped in 0f87fc32 (soft-delete code) + 885a6af0
  (hand-written 0065 migration).

Known cosmetic warnings (pre-existing):
- `bankAccounts`, `desc`, `sum`, `between`, etc. unused-import
  warnings in plaid services — predate this work.
