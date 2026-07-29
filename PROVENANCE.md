# Provenance

This file records external material and generated artifacts used by SUP Re:Mission.

## Whole-file vendoring

No complete file from the official Superfluid skill is currently vendored in this
repository.

The official skill lives in `superfluid-org/skills` under `skills/superfluid/`. It is
expected to be installed separately and remains the source for protocol-wide ABIs,
selectors, deployed-address information, architecture, SDK guidance, generic
subgraph references, and reusable protocol scripts.

## Embedded external interface fragments

The Wagmi 3 migration types in
`research/claim-app-sources/reconstructed/hooks/useLiquidityTransactions.ts` and
their compile-time regression test adapt the ABI-derived `ContractFunctionName` /
`ContractFunctionArgs`, payable-value gating, and explicit Wagmi handoff-cast
approach from `superfluid-org/superfluid-dashboard` commit
`ee1af4ff25fba76d5ecfebe7cf0a1e3244f40bbd`. The local implementation is limited to
the reconstructed claim app's three liquidity calls and retains its existing hook
lifecycle; no Dashboard source file is vendored.

`tools/sup-nonces/investigate-sup-nonces.js` contains minimal ABI fragments for:

- `FluidLockerFactory.getUserLocker`
- `FluidEPProgramManager.getNextValidNonce`
- `FluidLocker` claim variants and claim events

These fragments describe deployed Superfluid contracts and were checked against the
official contract interfaces and skill references. They are intentionally minimal
because the investigator needs decoding and read calls. Do not replace them with
copied full ABI files.

The runnable claim path does **not** retain hand-written locker/factory ABI fragments.
`research/claim-app-sources/reconstructed/client/claim-chain.ts`,
`client/ClaimExperience.tsx`, and `app/api/pending-claim-events/route.ts` import
`lockerFactoryAddress`, `lockerFactoryAbi`, and `lockerAbi` from
`@sfpro/sdk/abi/sup` version `0.2.3`, then use Wagmi for contract reads, wallet writes,
chain switching, SDK event-log verification, and submitted-transaction receipt
waiting. This is dependency use, not vendored source.

`research/claim-app-sources/reconstructed/contracts/app-contracts.ts` contains a
narrow GDA pool read fragment with four methods:

- `getTotalAmountReceivedByMember(address)`
- `getMemberFlowRate(address)`
- `getTotalUnits()`
- `getTotalFlowRate()`

The installed `@sfpro/sdk` release does not export the Superfluid pool ABI. The first
two methods are required by restored staking/liquidity behavior; the latter two are
required to project the claim result's SUP flow.

The signatures were checked against `superfluid-org/protocol-monorepo`,
`packages/ethereum-contracts/contracts/interfaces/agreements/gdav1/ISuperfluidPool.sol`,
commit `414109689d9041a8b6900b67b947f3f203c1da5d`. The local fragment removes only
documentation, parameter names where unnecessary, named returns, and unrelated
members; selectors and Solidity types are unchanged.

To refresh the GDA fragment:

1. fetch the interface at the intended protocol-monorepo revision;
2. compare all four function signatures with `gdaPoolReadAbi`;
3. update the pinned commit here if the source revision changes;
4. verify Viem `parseAbi`, flow-projection tests, and the production TypeScript build.

No complete pool ABI is vendored.

The Base contract addresses, RPC URLs, subgraph URLs, CMS routes, historical-balance
API URL, metrics URLs, and other service locations are external deployment metadata,
not locally defined protocol configuration.

`tools/point-events/export-point-event-names.ts` contains minimal ABI fragments for:

- `FluidEPProgramManager.getProgramPool`
- GDA pool `getTotalFlowRate`

These are limited to direct RPC verification of SUP `Program` pool addresses and
current pool flow during campaign-history export.

## Repository-authored compatibility code

The following modules are local product/reconstruction work rather than recovered
private source or copied external source:

- `client/ClaimExperience.tsx`
- `client/ClaimCampaignChange.tsx`
- `client/claim-batch.ts`
- `client/claim-chain.ts`
- `client/claim-display.ts`
- `client/claim-event-breakdown.ts`
- `client/GroupedEventList.tsx`
- `client/event-groups.ts`
- `client/flow-projection.ts`
- `config/server-wagmi.ts`
- `lib/cms-sdk.ts`
- `app/api/pending-claim-events/route.ts`

`lib/cms-sdk.ts` is a repository-authored typed client for the public CMS points API.
Its request and response shapes were checked against
`superfluid-org/superfluid.pro` commit
`a79f0cd7969fbd96f97c7451079a538d8fc7202c`, specifically:

- `cms/src/domains/points/api/registry.ts`
- `cms/src/domains/points/api/schemas.ts`
- `cms/src/app/(api)/points/events/route.ts`

It is not part of the published `@sfpro/sdk` package. Version `0.2.3` exports contract
ABIs, Wagmi hooks, and Wagmi actions; it does not export a CMS HTTP client.
Application claim code uses this single CMS transport boundary instead of constructing
CMS URLs directly.

The pending-claim-events route combines public data from the SUP subgraph, Base RPC,
and CMS point events obtained through `cmsSdk`. It uses SUP-subgraph
`FluidStreamClaimEvent` and `ClaimEventUnit` entities to locate locker claims
containing a campaign, then verifies the same transaction through SDK-defined
`FluidStreamClaimed` or `FluidStreamsClaimed` logs using a Wagmi public client. Only a
verified claim timestamp becomes `lastClaimAt`; otherwise the route returns no pending
claim events and reports `indexed-claim-unverified` or `no-claim`.

The CMS events endpoint filters and sorts by `eventTime`, but exposes that value under
the compatibility field name `createdAt`. It does not expose the point-event record's
insertion timestamp. Therefore the pending-event view is an event-time-bounded
explanation, not proof that every balance-changing event inserted after the last claim
is present. A backfilled event with an earlier `eventTime` can be omitted.

`balances.superfluid.dev` is retained only as an optional ledger investigation source.
It is not part of the claim-boundary implementation because known locker/SUP queries
can be empty even when indexed and RPC-verifiable locker claims exist.

The points research skill, endpoint notes, claim-voucher injector, event exporter,
nonce investigator, tests, audits, and security assessment were authored and
iterated in this repository.

## Generated material

`tools/point-events/point-event-names.html` is generated by
`tools/point-events/export-point-event-names.ts` from public CMS, claim-app, SUP
subgraph, direct RPC, and protocol-subgraph responses. It is evidence captured at
generation time, not a canonical protocol registry.

### claim.superfluid.org deployment snapshot

`recovered/claim.superfluid.org/raw/` pins unauthenticated public HTTP response bodies
from claim-app deployment `dpl_CSoxxmednYKCCZSxAMCUZxSP89CC`, captured at
`2026-07-20T09:11:15.056Z` by GitHub Actions run `29730392853`, artifact
`8456046548` (artifact digest
`sha256:ae42b5d1174c89c0d209afdf25e940134dede54366cda80a17531b37fc8e0b2f`).
`snapshot-manifest.json` records source URL, byte count, and SHA-256 for every
committed response.

The raw files are unmodified and authoritative. Files under `beautified/` are local
Prettier 3.6.2 derivatives made for review. Run
`npm run verify:claim-snapshot` to verify raw hashes, exact file coverage, and
raw-to-beautified equivalence. The live recovery workflow captures into a separate
temporary output and reports deployment divergence without mutating the pinned
snapshot.

## Adding external material

For every future vendored file or substantial copied fragment, record:

1. source repository and path;
2. exact commit, tag, or package version;
3. reason it must live here instead of the official skill;
4. local modifications;
5. how to refresh or verify it.

## Claim-app source recovery

`research/claim-app-sources/use-claim-transaction.recovered.ts` is a
repository-authored, human-readable semantic reconstruction of part of the public
claim app client. It was derived on 2026-07-19 from deployment
`dpl_CSoxxmednYKCCZSxAMCUZxSP89CC`, specifically public chunk
`/_next/static/chunks/9443-ee8d2452e07f5651.js` (Sentry debug ID
`131b676a-515c-4305-b4d2-ed8d8eef7317`). The deployment did not publish a usable
source map: requesting the `.map` URL returned the JavaScript payload.

No minified JavaScript, whole external source file, or third-party generated GraphQL
client code is committed. The reconstruction preserves observed endpoint paths,
query conditions, method choices, and argument ordering, while naming and type
boundaries are local synthesis. `chunk-inventory.md` and `source-catalog.md` record
all 40 HTML-referenced chunks and Sentry-exposed application filenames from the same
capture; they contain metadata only. Refresh them with
`tools/claim-app-sources/recover-claim-app-sources.mjs` and record changed chunk
identity here.
