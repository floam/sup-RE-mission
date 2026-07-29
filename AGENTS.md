# Agent instructions

This repository is **SUP Re:Mission**, a workbench for Superfluid points, claims,
campaigns, event evidence, flow projections, and nonce investigations.

1. Read `skills/superfluid-points-research/SKILL.md` for points-related work.
2. Read `RESEARCH-MAP.md` and load only the material relevant to the task.
3. Read `skills/superfluid-points-research/references/runtime-endpoints.md` before
   changing claim state, pending-event explanations, or runtime service calls.
4. Check `PROVENANCE.md` before modifying externally sourced fragments, ABI
   fragments, deployment metadata, or generated evidence.
5. Treat files under `tools/` as executable investigation utilities, not production
   application code.
6. Distinguish recovered semantic source from repository-authored compatibility code.
   Do not describe `ClaimExperience`, `ClaimCampaignChange`, `claim-chain`,
   `claim-batch`, `flow-projection`, `cms-client`, server Wagmi, or
   `/api/pending-claim-events` as original private source.
7. An indexed claim candidate is not automatically verified. Confirm an SDK-defined
   locker claim event through RPC before treating its timestamp as `lastClaimAt`.
8. For new claim reads/writes, use `@sfpro/sdk/abi/sup` contract exports with Wagmi.
   Do not add duplicate hand-written locker or factory ABIs.
9. Use `research/claim-app-sources/reconstructed/lib/cms-client.ts` for every CMS request
   made by the runnable claim path. Do not construct CMS `/points/*` URLs in components,
   chain-state helpers, or reconstruction API routes.
10. Validate CMS batch account identity, campaign order, and parallel array lengths
    before using returned values.
11. Do not claim the repository generated `openapi-fetch` client comes from `@sfpro/sdk`; version `0.2.3`
    provides contract ABIs/hooks/actions but no CMS HTTP client.
12. CMS event `createdAt` is the public API name for `eventTime`, not record insertion
    time. Describe time-bounded results as events dated after a claim, and preserve the
    backfill limitation.

## Documentation synchronization

When changing endpoints, claim flow, event grouping, flow math, ABI fragments, CMS
SDK operations, or data-source authority, update the relevant files in the same branch:

- `skills/superfluid-points-research/SKILL.md`
- `skills/superfluid-points-research/references/endpoints.md` or
  `references/runtime-endpoints.md`
- `RESEARCH-MAP.md`
- `research/claim-app-sources/reconstructed/README.md`
- `research/claim-app-sources/reconstructed/RUNNABILITY.md`
- `PROVENANCE.md` when external material changes

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
