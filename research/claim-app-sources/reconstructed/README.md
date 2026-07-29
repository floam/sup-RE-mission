# Claim app application-source reconstruction

This directory is a semantic reconstruction of the first-party application source
shipped by `claim.superfluid.org`, plus a deliberately small runnable compatibility
application used to validate and extend the recovered behavior.

It includes readable TypeScript/TSX route modules, React components and providers,
transaction/data hooks, application configuration, narrow app-owned contract ABI
fragments, inferred domain types, and repository-authored compatibility modules for
the modern claim flow.

It is **not** a byte-for-byte recovery. The deployment did not publish usable source
maps, so names and boundaries that cannot be proven are labeled as inference instead
of being presented as original source. `MODULE_MAP.md` is the canonical symbol table
and evidence ledger for recovered public identities.

See `RUNNABILITY.md` for local/Vercel commands, the current SDK/Wagmi architecture,
CMS OpenAPI client boundary, endpoint boundaries, flow projection, pending-claim behavior,
verification, and remaining limitations.

## Recovered source versus compatibility code

Recovered semantic modules preserve observed production behavior and evidence.
Repository-authored compatibility code is allowed where needed to make the tree
runnable or to implement an explicitly requested product refinement, but it must not
be described as original private source.

Current compatibility modules include:

- `client/ClaimExperience.tsx`: staged account review, ownership-aware claim UX, and
  batch transaction orchestration;
- `client/ClaimCampaignChange.tsx`: per-campaign current/projected flow presentation
  and event-time-bounded reward explanation;
- `client/claim-chain.ts`: active SUP program/CMS state assembly through SDK ABIs,
  Wagmi, and the repository CMS OpenAPI client;
- `client/claim-batch.ts`: strict account, campaign-order, and parallel-array
  validation for CMS batch responses;
- `client/claim-display.ts`: claim-specific formatting and campaign attribution;
- `client/claim-event-breakdown.ts`: pending-event response and UI state types;
- `client/flow-projection.ts`: deterministic member-flow projection;
- `lib/cms-client.ts`: the sole typed transport boundary for public CMS point operations;
- `app/api/pending-claim-events/route.ts`: transaction-confirmed claim boundary plus
  event-time-bounded CMS events;
- `config/server-wagmi.ts`: server-side Base read configuration.

These modules should be documented in `RUNNABILITY.md`, the points-research skill,
and `PROVENANCE.md` when they introduce or alter external interface fragments.

## Evidence used

- The pinned raw production responses under `recovered/claim.superfluid.org/raw/`,
  including factory IDs and literal values. These exact bytes are canonical evidence;
  matching `beautified/` files are verified review aids.
- The Sentry source catalog, which supplies many original source basenames and
  component identities.
- Next.js route payloads and chunk relationships, used to reconnect route shells to
  their client modules.
- The immutable production chunk matching the captured deployment, used to resolve
  factories absent from the local beautified catalog.
- A same-deployment HAR capture of `getProgramApps` and `getProgramPoolInfos` React
  Flight responses. Only first-party claim traffic was used; request headers,
  cookies, and unrelated browsing traffic are not retained.
- Live zero-argument action responses for staking, liquidity, and governance,
  cross-checked against SUP, Superfluid protocol, Uniswap V3, LiFi, and public SUP
  metrics APIs.
- The public CMS OpenAPI registry, schemas, and events route at
  `superfluid-org/superfluid.pro` commit
  `a79f0cd7969fbd96f97c7451079a538d8fc7202c` for current points response contracts
  and event-time semantics.

## Reconstruction policy

- Preserve exact observed endpoint paths, URLs, chain IDs, contract addresses, ABI
  members, transaction names, argument order, fees, durations, storage keys, query
  gates, and bigint arithmetic.
- Simplify webpack factories, export indirection, React compiler memo arrays,
  transpiler helpers, and Next.js runtime machinery into plausible human-written
  React and TypeScript.
- Keep dependency-owned code in dependencies: Radix/shadcn, Wagmi, Reown, TanStack
  Query, Segment, Viem, Uniswap, Superfluid SDK, and generated GraphQL machinery.
- Import protocol-wide locker/factory ABIs and deployment addresses from
  `@sfpro/sdk/abi/sup`.
- Keep only narrow app-owned or directly required interfaces locally. The GDA pool
  read fragment exists because the installed `@sfpro/sdk` release does not export a
  pool ABI.
- Keep CMS HTTP access behind `lib/cms-client.ts`; application modules must not construct
  `/points/*` URLs directly.
- Validate CMS batch account identity, campaign order, and parallel array lengths
  before using returned values.
- Do not describe generated `openapi-fetch` client as an `@sfpro/sdk` export. The installed package supplies
  contract ABIs/hooks/actions, while the CMS client is repository-authored against the
  public CMS OpenAPI contract.
- Treat CMS `createdAt` as the API's compatibility name for event occurrence time,
  not record insertion time. Do not claim a time-bounded view proves complete backfill
  coverage.
- When evidence changes a name or shape, update consumers, docs, tests, and symbol
  ledger together. Do not retain stale alternate public aliases.
- Never promote an indexed candidate into a proven claim timestamp without
  transaction-level RPC confirmation.

## Server-action reconstruction

The browser does not contain the original server source, so these are semantic
reconstructions rather than claimed byte-for-byte bodies. The capture and live
deployment expose enough inputs and outputs to restore their contracts and query/math
behavior:

| Client-visible action | Server action ID | Recovered behavior |
| --- | --- | --- |
| `getProgramPoolInfos` | `003f4c4ef5e976bf16920f03d8a97174f1d8ae67e6` | Protocol-pool units and per-unit flow for active apps |
| `getProgramApps` | `0050c3f0d604f9162ceb3faa2d83005031b4be6b5f` | Registry plus contract and live pool data |
| `getStakingStats` | `00a6446d221d62d46ca41e7294731c14ab30fc9053` | Staker pool totals, accrued distribution, and APR |
| `getLiquidityPoolStats` | `00c1274b3226ccdf16c1f187bbdd66ac7c5647b0ae` | Uniswap V3 pool/day TVL, volume, fee, and token metadata |
| `getLiquidityRewardsStats` | `0099a827feb87232328ca49a8aaec8daa5598e5c0c` | LP reward pool accrual and USD-denominated APR |
| `getTotalDelegatedAmount` | `00cfeebe90442ab515b51fba3ba323324474e768b8` | `/v1/total_delegated_score` response projection |

The public Uniswap V3 Base fallback in `lib/endpoints.ts` is an inferred compatible
deployment because a server-to-server URL is absent from browser/HAR evidence.
`UNISWAP_V3_BASE_SUBGRAPH_URL` preserves that configuration boundary. GraphQL
selections, pool/token identities, result fields, cache intervals, bigint accrual,
unit scaling, and APR calculations remain evidence-backed.

The full Reown adapter network/connector list was assembled from third-party exports
in the production bundle. Observable first-party AppKit options are recovered in
`config/app-kit.ts`, while the adapter instance remains an input to
`ContextProvider`.

Sentry-named dependency primitives such as `badge`, `dialog`, `drawer`,
`pagination`, `responsive-dialog`, `sheet`, and `skeleton` are intentionally
excluded. Other cataloged first-party source basenames are represented in the
reconstructed tree.

## Validation

The tree is checked for resolvable relative imports, TypeScript/TSX syntax,
deterministic claim tests, live CMS-SDK/subgraph smoke tests, and a production Next.js
build. The checks operate on the reconstructed source itself, not helper extraction
output.

The result is intended as readable audit material and as source a competent
developer could plausibly have supplied to the bundler. It must not be described as
the original private repository.

## Recovered application name

Generated GraphQL modules expose original build paths rooted at
`/vercel/path0/apps/claim-app`, and instrumented chunks carry the Sentry application
key `claim-app`. Public metadata says `Superfluid Claim App`, while LiFi uses
`superfluid-claim-app`.

- original monorepo workspace/directory and build key: `claim-app`;
- public product name: `Superfluid Claim App`;
- integration slug: `superfluid-claim-app`.

The unavailable original `package.json` means its exact npm package `name` remains
unproven.
