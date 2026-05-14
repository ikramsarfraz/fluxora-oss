# AI Invoice Extraction — Setup Guide

The supplier invoice import pipeline uses AI to fall back to when the deterministic PDF parser has low confidence. The AI step extracts structured invoice data from raw PDF text and optionally matches vendor product names to internal catalog IDs.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AI_PROVIDER` | No | auto-detect | `openai`, `mock`, or unset (auto) |
| `OPENAI_API_KEY` | When using OpenAI | — | OpenAI secret key |
| `OPENAI_INVOICE_MODEL` | No | `gpt-4o-mini` | Model for invoice extraction |
| `OPENAI_PRODUCT_MATCH_MODEL` | No | `gpt-4o-mini` | Model for product matching |
| `AI_MAX_INVOICE_TEXT_CHARS` | No | `30000` | Max PDF text chars sent per call |
| `AI_MAX_PRODUCT_CANDIDATES` | No | `75` | Max products sent for matching |

### Auto-detection logic

- `AI_PROVIDER=openai` — always use OpenAI (error if `OPENAI_API_KEY` missing)
- `AI_PROVIDER=mock` — always use the mock provider (useful in CI)
- Unset — use OpenAI if `OPENAI_API_KEY` is present, mock otherwise

## Local development

Add to `.env.local`:

```
OPENAI_API_KEY=sk-...
# Optional — defaults shown:
# AI_PROVIDER=openai
# OPENAI_INVOICE_MODEL=gpt-4o-mini
# OPENAI_PRODUCT_MATCH_MODEL=gpt-4o-mini
```

Without `OPENAI_API_KEY` the pipeline still runs — it uses the mock provider, which returns an empty result with a warning. The import will use only the deterministic parser output.

## Cost controls

Two hard limits are applied before any API call:

- **Text truncation** — invoice PDF text is capped at `AI_MAX_INVOICE_TEXT_CHARS` (default 30,000). This is enough for very large invoices; real invoices rarely exceed 5,000 characters.
- **Candidate limiting** — at most `AI_MAX_PRODUCT_CANDIDATES` (default 75) products are sent for matching. The caller should pre-sort by relevance (e.g. supplier-specific products first) since only the first N are used.

Token usage is appended to the `warnings` array of every successful extraction result so it shows in the review UI.

## When AI is used

The pipeline always runs the deterministic parser first. AI is invoked only when the deterministic confidence score is below the configured threshold (default 70). If the AI call fails for any reason (network error, malformed response, schema mismatch), the pipeline falls back to the deterministic result — the import is never blocked by an AI failure.

## Running tests

The AI validation utilities are pure (no `server-only` import) and covered by unit tests:

```
node --import tsx --test modules/distribution/supplier-invoices/utils/ai-validation.test.ts
```

Or run the full unit suite:

```
npm run test:unit
```

No real API calls are made in tests — the test file covers `truncateInvoiceText`, `limitProductCandidates`, `safeParseJson`, `validateExtractionResult`, `validateProductMatchResult`, `buildInvoiceExtractionUserMessage`, and `buildProductMatchUserMessage`.

## Security note

The product matching step validates every `suggestedProductId` returned by the AI against the candidate set sent in the request. Any ID not in that set is silently replaced with `null`. This prevents hallucinated product IDs from being written to the database.

## Provider roadmap

The `AiProvider` interface in [services/ai-provider.ts](../modules/distribution/supplier-invoices/services/ai-provider.ts) is designed for multiple backends. Currently implemented:

- `openai` — OpenAI Chat Completions API (gpt-4o-mini by default)
- `mock` — safe no-op (returns empty result with warning)

Planned but not yet implemented: `anthropic`, `gemini`, `local` (OpenAI-compatible local endpoint).

Vercel AI Gateway is intentionally deferred — the direct OpenAI SDK is simpler until multi-provider routing is needed.
