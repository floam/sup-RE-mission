# Claim app application-source reconstruction

This directory is a semantic reconstruction of the first-party application source
shipped by `claim.superfluid.org`, plus a deliberately small runnable compatibility
application used to validate and extend the recovered behavior.

It is **not** a byte-for-byte recovery. The deployment did not publish usable source
maps, so names and boundaries that cannot be proven are labeled as inference rather
than original private source. `MODULE_MAP.md` is the symbol/evidence ledger.

See `RUNNABILITY.md` for local/Vercel commands, SDK/Wagmi architecture, the CMS OpenAPI
boundary, nonce-bounded pending-event reconciliation, cap behavior, verification, and
limitations.

## Recovered source versus compatibility code

Repository-authored compatibility modules include:

- `client/ClaimExperience.tsx`: staged account review, batched explanation loading,
  client explanation cache, and claim orchestration;
- `client/ClaimCampaignChange.tsx`: current/projected flow, capped-out state, and event
  reconciliation UI;
- `client/claim-chain.ts`: active program, CMS raw/capped target, and Wagmi state assembly;
- `client/program-attribution.ts`: live claim-app attribution parsing and recovered-label fallback merging;
- `client/claim-batch.ts`: strict CMS batch response validation;
- `client/claim-display.ts`, `client/claim-event-breakdown.ts`,
  `client/GroupedEventList.tsx`, and `client/event-groups.ts`: presentation and
  semantic-family grouping of events with equal point amounts;
- `client/flow-projection.ts`: deterministic member-flow projection;
- `client/pending-event-explanations.ts`: client-side batching, signed-balance drift
  checks, nonce reads, and CMS event reconciliation using reviewed point state;
- `lib/cms-client.ts`: typed `openapi-fetch` CMS transport boundary;
- `lib/cms-events.ts`: bounded newest-first event pagination and lazy summation;
- `lib/claim-nonce-window.ts`: signed-snapshot nonce interval derivation.

There is no local pending-event API route or separate server-side Wagmi configuration.
Those layers duplicated public CMS/RPC work already available to the client and added no
private credential, durable cache, authentication, or authority boundary.

The runnable compatibility app replaces the recovered Reown AppKit boundary with a
Base-only Wagmi configuration and a small local wallet dialog. Injected, Coinbase,
WalletConnect, Safe, and Farcaster mini-app connectors remain available without
maintaining duplicate AppKit and Wagmi account state.

These modules are local product/reconstruction work, not recovered private source.

## Evidence used

- Hash-pinned public responses under `recovered/claim.superfluid.org/raw/`.
- Sentry source-catalog names and Next.js route/chunk relationships.
- Same-deployment HAR captures of first-party React Flight responses.
- Public claim-app, SUP subgraph, Base RPC, protocol subgraph, and CMS behavior.
- CMS OpenAPI schemas from `superfluid-org/superfluid.pro` commit
  `a79f0cd7969fbd96f97c7451079a538d8fc7202c`.
- Program-manager nonce semantics checked against `superfluid-org/sup-token` commit
  `91179958d5555ba47f68b0bb9a666cd2ac973e82`.

## Reconstruction policy

- Preserve observed endpoint paths, chain IDs, addresses, ABI members, transaction
  names, argument order, and bigint arithmetic.
- Keep dependency-owned code in dependencies and import SUP contract surfaces from
  `@sfpro/sdk/abi/sup`.
- Keep CMS HTTP access behind `lib/cms-client.ts` and validate batch account/order/arrays.
- Treat the public claim `/api/programs` response as the live source for names, seasons,
  and categories. Keep recovered definitions only as a display fallback; use the SUP
  subgraph for program existence and lifecycle.
- Submit only signed/capped `points`; use `uncappedPoints` only for explanation.
- Let the user choose changed campaigns. Select positive deltas by default, leave
  decreasing deltas clear, lock selection during submission, sign only the checked
  campaign IDs, and preserve explicit exclusions across post-claim refreshes. Treat
  receipt transport errors after submission as indeterminate and require a read-only
  refresh before retrying from stale or uncertain state.
- Treat `getNextValidNonce - 1` as the nonce of the last accepted signed snapshot, not
  the claim transaction's mined timestamp.
- Treat CMS `createdAt` as event occurrence time, not insertion time.
- Show capped campaigns explicitly and skip event additions that cannot increase their
  claim target.
- Update consumers, docs, tests, and provenance together when evidence changes.

## Server-action reconstruction

Browser-visible server actions are semantic reconstructions, not claimed original
bodies. The current evidence supports their inputs, outputs, query structure, and math.
The public Uniswap V3 Base fallback remains an inferred compatible deployment because
the original server-to-server URL is absent from captured browser evidence.

## Validation

The tree is checked for resolvable imports, TypeScript/TSX syntax, deterministic claim
tests, live CMS/SUP smoke tests, and a production Next.js build. The result is readable
audit material and plausible application source, not the original private repository.

## Recovered application name

Generated GraphQL modules expose paths rooted at `/vercel/path0/apps/claim-app`, and
instrumented chunks use the Sentry key `claim-app`. Public metadata says
`Superfluid Claim App`; LiFi uses `superfluid-claim-app`. The unavailable original
`package.json` leaves its exact npm package name unproven.
