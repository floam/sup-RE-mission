# Agent instructions

This repository is **SUP Re:Mission**, a workbench for Superfluid points, claims,
campaigns, event evidence, flow projections, and nonce investigations.

1. Read `skills/superfluid-points-research/SKILL.md` for points-related work.
2. Read `RESEARCH-MAP.md` and load only the material relevant to the task.
3. Read `skills/superfluid-points-research/references/runtime-endpoints.md` before
   changing claim state or runtime service calls.
4. Read `skills/superfluid-points-research/references/pending-event-reconciliation.md`
   before changing the runnable claim UI's event explanations. That file is
   authoritative for the current explanation algorithm.
5. Check `PROVENANCE.md` before modifying externally sourced fragments, ABI
   fragments, deployment metadata, or generated evidence.
6. Treat files under `tools/` as executable investigation utilities, not production
   application code.
7. Distinguish recovered semantic source from repository-authored compatibility code.
   Do not describe `ClaimExperience`, `ClaimCampaignChange`, `claim-chain`,
   `claim-batch`, `flow-projection`, `cms-client`, `cms-events`, `claim-nonce-window`,
   or `client/pending-event-explanations.ts` as original private source.
8. For an uncapped pending explanation, compute `uncappedPoints - onchainUnits`, read
   `getNextValidNonce(programId, account) - 1` as the last applied signed snapshot,
   use a fresh signed-balance timestamp as the upper snapshot boundary, and consume
   newest CMS events inside that window until their signed sum equals the delta.
9. Do not describe the nonce snapshot boundary as the claim transaction's mined time.
   Actual transaction history still requires calldata/receipt/log verification.
10. Treat `uncappedPoints !== points` on a signed response, or equivalently unsigned
    `points !== cappedPoints`, as the CMS-declared capped state. Show the cap
    prominently and do not fetch incremental events for that campaign.
11. Reuse the reviewed `ClaimState` when explaining changed uncapped campaigns. Batch
    fresh signed balances at 50 campaigns, read only `getNextValidNonce` onchain, and
    request event pages only for the already-known nonzero uncapped/onchain deltas.
12. For new claim reads/writes, use `@sfpro/sdk/abi/sup` contract exports with Wagmi.
    Do not add duplicate hand-written locker, factory, or program-manager ABIs.
13. Use `research/claim-app-sources/reconstructed/lib/cms-client.ts` for every CMS
    request made by the runnable claim path. Do not construct CMS `/points/*` URLs in
    components, chain-state helpers, or reconstruction API routes.
14. Validate CMS batch account identity, campaign order, and parallel array lengths
    before using returned values.
15. Do not claim the generated `openapi-fetch` client comes from `@sfpro/sdk`; version
    `0.2.3` provides contract ABIs/hooks/actions but no CMS HTTP client.
16. CMS event `createdAt` is the public API name for `eventTime`, not insertion time.
    A backfill can fall outside the nonce-derived event-time window.

## Documentation synchronization

When changing endpoints, claim flow, event grouping, flow math, nonce semantics, ABI
fragments, CMS operations, cap semantics, or data-source authority, update the relevant
files in the same branch:

- `skills/superfluid-points-research/SKILL.md`
- `skills/superfluid-points-research/references/runtime-endpoints.md`
- `skills/superfluid-points-research/references/pending-event-reconciliation.md`
- `RESEARCH-MAP.md`
- `research/claim-app-sources/reconstructed/README.md`
- `research/claim-app-sources/reconstructed/RUNNABILITY.md`
- `PROVENANCE.md` when external or generated material changes

Do not leave exact test counts, deleted component names, obsolete endpoint names,
response statuses, or architecture claims in durable docs.

## Do not duplicate the official Superfluid skill

Assume the official `superfluid` skill is installed separately. Use it for full
protocol ABIs, selectors, deployed addresses, architecture, general SDK guidance,
standard subgraph references, and generic helper scripts.

Do not copy that material into this repository. A narrow external fragment belongs
here only when the investigation needs to modify or pin an exact version. Record
source repository/path, commit or package version, local changes, reason, and refresh
procedure in `PROVENANCE.md`.
