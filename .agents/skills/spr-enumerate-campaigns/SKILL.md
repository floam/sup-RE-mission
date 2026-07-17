---
name: spr-enumerate-campaigns
description: Enumerate currently relevant Superfluid Points Rewards (SPR/SUP) campaigns/programs, focusing on Season 5+ and not-ended campaigns, including late-launch exceptions such as S5 Streme/Warplet Gobbler. Use for active campaign tables, season attribution, claim-app program catalogs, SUP subgraph lifecycle checks, CMS campaign discovery, and excluding pre-S5 or ended programs.
---

# SPR enumerate campaigns

Use this skill when asked to list, expand, refresh, or classify current/relevant SPR campaigns.

## Default scope

- Include **Season 5 and newer** claim-app programs by default.
- Exclude pre-Season-5 campaigns unless the user explicitly asks for archaeology or historical coverage.
- Exclude ended/stopped/cancelled campaigns unless the user asks for finished campaign context.
- Keep late-launch exceptions: an older season label can still be relevant if it launched or remained active during a newer season. Known example: **S5 Streme**, later presented as **Warplet Gobbler**, launched during S6 as a one-off.
- Treat `Pool.updatedAtTimestamp` as a pool state update timestamp only. Do **not** call it “last SUP flowed,” because member/unit changes update it too.

## Source order

1. `GET https://claim.superfluid.org/api/programs` for `season`, `appId`, app name, category, pool address, allocation, `onchainInfo`, and claim-app active/finished flags.
2. SUP Goldsky subgraph for canonical onchain program lifecycle (`Program.endDate`, `stoppedDate`, `cancellationDate`, `distributionPool`, amounts).
3. Base protocol subgraph for indexed pool state (`flowRate`, members, units, total distributed), but not for real-time balance math.
4. Base RPC for current `getProgramPool(programId)` and pool current flow reads when freshness matters.
5. CMS `/points/balance-batch` and `/points/campaign` to mark which program IDs also resolve as offchain CMS campaign IDs.

## Active/relevant decision checklist

For each candidate ID, report the evidence rather than relying on one boolean:

- Claim metadata: `season`, `appId`, `name`, `program.id`.
- Claim status: `isFundingStarted`, `isFundingFinished`, `fundingStartDate`, `fundingEndDate`, `fundingFlowRate`, `subsidyFlowRate`.
- SUP subgraph lifecycle: `endDate`, `stoppedDate`, `cancellationDate`.
- Pool state: current/indexed `flowRate` and member count.
- CMS status: resolves or missing from `/points/campaign`.

Default inclusion rule:

```text
include if season >= 5 AND not cancelled AND not stopped/finished/ended,
OR if explicitly known as a late-launch active exception.
```

If a source disagrees, include the row with a `statusConflict` note.

## Useful GraphQL

SUP programs:

```graphql
query SupPrograms($lastId: String!) {
  programs(first: 1000, orderBy: id, orderDirection: asc, where: { id_gt: $lastId }) {
    id
    distributionPool
    fundingAmount
    subsidyAmount
    earlyEndDate
    endDate
    stoppedDate
    cancellationDate
    blockTimestamp
    transactionHash
  }
}
```

Protocol pools:

```graphql
query Pools($pools: [ID!]!) {
  pools(first: 1000, where: { id_in: $pools }) {
    id
    flowRate
    totalMembers
    totalUnits
    totalAmountDistributedUntilUpdatedAt
    updatedAtTimestamp
  }
}
```

## Reporting

Use a table with at least: `ID`, `Season`, `App ID`, `Name`, `Active evidence`, `CMS`, `SUP lifecycle`, `Pool flow`, and `Notes`.

Reference shared endpoint details in `../superfluid-points-research/references/endpoints.md` when exact request/response shapes are needed.
