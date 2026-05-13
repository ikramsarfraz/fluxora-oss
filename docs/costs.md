# Monthly cost tracking

Track actual spend per month so the bill doesn't surprise. Update the
`Actual / mo` column the first business day of each month from the
vendor dashboard. Anything outside the expected range gets a one-line
note on why.

## Cadence

- **First of every month**: skim each dashboard, fill the row, flag anomalies.
- **When a new vendor is added**: append a row, set its expected band.
- **When a tier change happens**: update the free-tier and per-overage columns.

## Vendors

| Vendor | Purpose | Free / lowest tier | Cost when exceeded | Actual / mo | Notes |
|---|---|---|---|---|---|
| Vercel | App hosting + cron | Hobby (dev only); Pro $20/mo per seat | $20+/mo + bandwidth/exec usage | _TBD_ | Dashboard: https://vercel.com/dashboard/usage |
| Sentry | Error tracking (Pass 2) | 5K errors/mo | $26/mo for Team | _TBD_ | If we routinely hit 5K, something's broken in prod, not the budget |
| Upstash Redis | Rate limiting (Pass 2) | 10K commands/day | $10–20/mo for paid | _TBD_ | Generic-API limiter does 1 cmd per request — watch this on traffic spikes |
| PostHog | Activation analytics (Pass 3) | 1M events/mo | $0.0001/event after | _TBD_ | Server captures with `flushAt: 1` so events ≈ user actions, not multipliers |
| Better Stack | Uptime + heartbeats + status page | 10 monitors, 10 heartbeats, 1 page | $29/mo Team | _TBD_ | Free tier should cover us through ~50 customers |
| Resend | Transactional email | 100/day, 3K/mo | $20/mo for 50K | _TBD_ | Magic links + bill forwards are the main consumers |
| Anthropic API | PDF invoice parsing | Pay-as-you-go | ~$0.01–0.05 per bill parsed | _TBD_ | **Soft budget alert configured at $50/mo, hard limit TBD** |
| Plaid | Bank connection / sync | $0 sandbox | $0.30–0.60 per active connection per month in prod | _TBD_ | Cost scales linearly with connected tenants × banks |
| Database (Neon) | App DB | Free tier varies | Varies by branch storage + compute | _TBD_ | Long-running compute (e.g. cron jobs) bills separately from request time |

## Alerts configured

- [ ] **Anthropic API** — soft $50/mo notification, hard limit TBD.  Configure at https://console.anthropic.com/settings/billing.
- [ ] **Vercel** — usage alert at 80% of monthly Pro allowance. Configure at https://vercel.com/account/billing.
- [ ] **PostHog** — event quota alert at 80% of 1M/mo. Configure in PostHog project settings.

## Plaid spend awareness

Each connected bank costs Plaid a per-month per-active-connection fee
once we're out of sandbox. Track active connections as a leading
indicator of next month's Plaid bill:

```
estimated_plaid_cost_usd = active_connection_count × ~$0.45 (mid of range)
```

If `SELECT COUNT(*) FROM plaid_connections WHERE status = 'active'`
trends sharply up between checks, expect a matching bill jump.

## Review reminder

Set a recurring calendar event: **"Vendor cost review — first business
day of the month"**. 15 minutes; fills this table.

## What goes wrong

- **Anthropic spike**: usually means a tenant uploaded a stack of
  multi-page PDFs (think bulk-imports). Look at the latest day of
  `pdf.parsed` events in PostHog for tenant breakdown.
- **Vercel function invocation spike**: usually webhook spam (rate
  limiter should have absorbed it — confirm in Vercel logs) or a
  runaway cron.
- **Plaid bill jump without connection growth**: per-product call
  costs (transactions/sync, identity, etc.) — investigate
  `transaction-sync.ts` recent call volume.
