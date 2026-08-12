# Claim app client-source recovery

This directory holds human-readable source recovered or synthesized from the public
JavaScript served by `https://claim.superfluid.org`. It deliberately contains no
copied minified chunk.

## Capture

| Field | Value |
| :-- | :-- |
| Capture date | 2026-07-19 |
| Deployment | `dpl_CSoxxmednYKCCZSxAMCUZxSP89CC` |
| Script chunks | 40 referenced; all 40 retrieved and inventoried |
| Integrity marker | Sentry debug ID `131b676a-515c-4305-b4d2-ed8d8eef7317` |
| Source maps | Not published; requesting `<chunk>.map` returned the JavaScript chunk. |

## Contents and confidence

| File | Kind | Confidence | Notes |
| :-- | :-- | :-- | :-- |
| `chunk-inventory.md` | Generated deployment inventory | Exact at capture time | All 40 HTML-referenced chunks, their size, debug ID, and Sentry-declared source filenames. |
| `source-catalog.md` | Generated source-to-chunk index | Exact for exposed Sentry filename metadata | Covers all source filenames revealed across the full 40-chunk capture. |
| `use-claim-transaction.recovered.ts` | Semantic TypeScript reconstruction | High for endpoints, query gating, transaction selection, and arguments | Names, imports, type declarations, and presentation-independent helper boundaries are synthesized. |

The recovered hook is intentionally limited to claim-state retrieval and transaction
assembly. Generated GraphQL client code, third-party dependencies, React compiler
memoization, and presentation components are omitted because they are not original
claim-app business logic and would make the artifact much less useful to audit.

## Reproduce

Run the full-chunk capture utility from the repository root:

```bash
node tools/claim-app-sources/recover-claim-app-sources.mjs \
  --write-inventory research/claim-app-sources/chunk-inventory.md \
  --write-source-catalog research/claim-app-sources/source-catalog.md
```

It reads every public JavaScript chunk referenced by the claim-app HTML in memory, reports the current deployment/chunk/action metadata, and writes only generated Markdown inventories when the output flags are supplied. It never writes downloaded minified JavaScript into the repository. Compare its output with this recovery before updating the pinned sources. The script needs Node.js 22+ and outbound HTTPS access.
