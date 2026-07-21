# claim.superfluid.org bundle snapshot

This directory pins the deployed evidence used for the claim-app reconstruction.
The snapshot was captured without authentication from deployment
`dpl_CSoxxmednYKCCZSxAMCUZxSP89CC` at
`2026-07-20T09:11:15.056Z`. Its GitHub Actions provenance and every response
hash are recorded in `snapshot-manifest.json`.

## Which files are authoritative?

- `raw/` contains the exact HTTP response bodies: eight route documents, one
  generated stylesheet, and 51 JavaScript chunks. These bytes are the canonical
  evidence.
- `beautified/` contains Prettier renderings of the 51 raw JavaScript chunks.
  They are convenient review aids, not canonical evidence.
- `research/claim-app-sources/reconstructed/` contains the semantic
  TypeScript/TSX reconstruction. It is the human-readable deliverable, not a
  claim of byte-for-byte original source.

Beautification is normally semantics-preserving for valid JavaScript, and the
committed files exactly equal Prettier 3.6.2's output for this snapshot.
Nevertheless, only keeping beautified output would be a provenance error.
Parse/print bugs, automatic-semicolon-insertion edge cases, literal escaping,
comments, formatter upgrades, and accidental edits can change either semantics
or the evidence representation.

Run:

```sh
npm run verify:claim-snapshot
```

The verifier checks all raw byte counts and SHA-256 values, enforces exact
manifest coverage, regenerates every beautified chunk from its raw counterpart,
and compares the result byte-for-byte. The recovery workflow also captures the
current deployment separately and emits an added/removed/changed asset report.
It never silently refreshes this pinned snapshot.

## Application identity

The strongest recovered identity is `claim-app`:

- generated GraphQL code embeds
  `/vercel/path0/apps/claim-app/src/subgraph-fluid/.graphclient/index.ts` and
  `/vercel/path0/apps/claim-app/src/subgraph-protocol/.graphclient/index.ts`;
- 50 instrumented chunks carry Sentry application key `claim-app` (the
  polyfill chunk is the sole uninstrumented JavaScript file);
- wallet metadata names the product `Superfluid Claim App`;
- the LiFi integration slug is `superfluid-claim-app`.

This proves the monorepo workspace/directory and internal build key were almost
certainly `claim-app`, and the public product name was `Superfluid Claim App`.
It does not prove the exact `name` field of the unavailable original
`package.json`.
