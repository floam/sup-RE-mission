---
name: spr-query-campaign
description: Query one specific Superfluid Points Rewards campaign/program across CMS, claim-app, SUP subgraph, protocol subgraph, and onchain/RPC. Use for “query SPR campaign”, campaign ID lookups, season attribution, active/ended status, pool address, flow, members, point events, and claimability details for a single ID.
---

# SPR query campaign

Use this skill when the user asks about one campaign/program ID, app ID, or campaign name.

## Inputs

Accept any of:

- numeric campaign/program ID
- claim `appId` such as `s6-superboring`
- display name plus season
- pool address

Normalize to a numeric program/campaign ID when possible, but keep aliases in the report.

## Query sequence

1. Claim app catalog: `GET https://claim.superfluid.org/api/programs`.
   - Match by `program.id`, `appId`, name, or pool address.
2. CMS metadata: `GET https://cms.superfluid.pro/points/campaign?campaignId=<id>`.
3. SUP subgraph: query `Program` by ID for `distributionPool`, lifecycle dates, amounts, and creation transaction.
4. Protocol subgraph: query pool state for the distribution pool.
5. RPC if needed: verify `FluidEPProgramManager.getProgramPool(programId)` and fresh pool flow/units.
6. Point events only if CMS resolves: `GET /points/events?campaignId=<id>&limit=100&page=...`.
7. Claim state only when an account is provided: claim `/api/points/states` and CMS signed/balance batch.

## Status model

Report source-specific status instead of collapsing everything into one label:

| Status area | Source |
| --- | --- |
| Season/name/app | claim `/api/programs` |
| CMS exists | CMS `/points/campaign` or `/points/balance-batch` |
| Onchain program exists | SUP subgraph / program manager |
| Lifecycle | SUP `endDate`, `stoppedDate`, `cancellationDate` |
| Current/indexed stream | protocol subgraph/RPC pool flow |
| Claimable for account | claim `/api/points/states` + CMS signed batch |

## Output template

- Identification: ID, app IDs, names, season(s), pool.
- Source presence: claim API, CMS, SUP subgraph, protocol pool.
- Lifecycle and active evidence.
- Point-event summary if CMS exists.
- Account claim state if an account was provided.
- Caveats/conflicts.

Reference shared endpoint details in `../superfluid-points-research/references/endpoints.md` when exact request/response shapes are needed.
