# Claim app application-source reconstruction

This directory is a semantic reconstruction of the first-party application source
shipped by `claim.superfluid.org`. It contains 124 readable TypeScript/TSX modules:
10 page routes, the root layout and error boundary, React components and providers,
transaction/data hooks, application configuration, narrow app-owned contract ABI
fragments, and inferred domain types.

It is **not** a byte-for-byte recovery. The deployment did not publish usable source
maps, so names and boundaries that cannot be proven are labeled as inference instead
of being presented as original source. `MODULE_MAP.md` is the canonical global symbol
table and evidence ledger; each public identity has one owning module there.

The audit modules now sit beside a deliberately small, bootable Next.js
compatibility application. See `RUNNABILITY.md` for local/Vercel commands, the
client-side data architecture, exact production-endpoint exceptions, functional
scope, and remaining limitations.

## Evidence used

- The pinned raw production responses under
  `recovered/claim.superfluid.org/raw/`, including factory IDs and literal values.
  These exact bytes are canonical evidence; the matching
  `recovered/claim.superfluid.org/beautified/` files are verified review aids.
- The Sentry source catalog, which supplies many original source basenames and
  component identities.
- Next.js route payloads and chunk relationships, used to reconnect route shells to
  their client modules.
- The immutable production chunk matching the captured deployment, used to resolve
  factories absent from the local beautified catalog (notably claim/delegation,
  account/profile, program schema, Reserve names, and Swap behavior).
- A same-deployment HAR capture of the `getProgramApps` and `getProgramPoolInfos`
  React Flight responses. Only first-party claim traffic was used; request headers,
  cookies, and unrelated browsing traffic are not retained in this tree.
- Live zero-argument action responses for staking, liquidity, and governance,
  cross-checked against the SUP, Superfluid protocol, Uniswap V3, LiFi, and public
  SUP metrics APIs.

## Reconstruction policy

- Exact observed endpoint paths, URLs, chain IDs, contract addresses, ABI members,
  transaction function names, argument order, fees, durations, storage keys, query
  gates, and bigint arithmetic are preserved.
- Webpack factories, export indirection, React compiler memo arrays, transpiler
  helpers, and Next.js runtime machinery are simplified back into plausible
  human-written React and TypeScript.
- Radix/shadcn primitives, wagmi, Reown, TanStack Query, Segment, viem, Uniswap,
  Superfluid SDK, and generated GraphQL machinery remain dependencies. Their
  implementation bodies are not mislabeled as first-party source.
- Protocol-wide Superfluid ABIs remain in `@sfpro/sdk`. The reconstruction includes
  only narrow app-owned or directly consumed ABI fragments embedded in the bundle.
- When later evidence changed a name or shape, all consumers and the symbol ledger
  were updated together. No alternate public aliases are retained.

## Server-action reconstruction

The browser does not contain the original server source, so these are semantic
reconstructions rather than claimed byte-for-byte bodies. The capture and live
deployment nevertheless expose enough inputs and outputs to restore the action
contracts and their query/math behavior:

| Client-visible action      | Server action ID                             | Recovered behavior                                       |
| -------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| `getProgramPoolInfos`      | `003f4c4ef5e976bf16920f03d8a97174f1d8ae67e6` | Protocol-pool units and per-unit flow for active apps    |
| `getProgramApps`           | `0050c3f0d604f9162ceb3faa2d83005031b4be6b5f` | 72-entry registry plus contract and live pool data       |
| `getStakingStats`          | `00a6446d221d62d46ca41e7294731c14ab30fc9053` | Staker pool totals, accrued distribution, and APR        |
| `getLiquidityPoolStats`    | `00c1274b3226ccdf16c1f187bbdd66ac7c5647b0ae` | Uniswap V3 pool/day TVL, volume, fee, and token metadata |
| `getLiquidityRewardsStats` | `0099a827feb87232328ca49a8aaec8daa5598e5c0c` | LP reward pool accrual and USD-denominated APR           |
| `getTotalDelegatedAmount`  | `00cfeebe90442ab515b51fba3ba323324474e768b8` | `/v1/total_delegated_score` response projection          |

The public Uniswap V3 Base fallback in `lib/endpoints.ts` is an inferred compatible
deployment because a server-to-server URL is not present in browser/HAR evidence;
`UNISWAP_V3_BASE_SUBGRAPH_URL` preserves the likely production configuration
boundary. All GraphQL selections, pool/token identities, action result fields,
cache intervals, bigint accrual, unit scaling, and one-decimal APR calculations are
evidence-backed.

The full Reown adapter network/connector list was assembled from third-party exports
in the production bundle. Observable first-party AppKit options are recovered in
`config/app-kit.ts`, while the adapter instance remains an input to
`ContextProvider`.

Sentry-named UI primitives (`badge`, `dialog`, `drawer`, `pagination`,
`responsive-dialog`, `sheet`, and `skeleton`) are dependency-owned boilerplate and
are intentionally excluded. All other cataloged first-party source basenames are
represented in the reconstructed tree.

## Validation

The final tree is checked as a unit for resolvable relative imports, TypeScript/TSX
syntax through an ES2022 ESM transpile, and unique exported symbol ownership. The
checks operate on the reconstructed source itself, not on helper extraction output.

The result is intended as readable audit material and as source a competent
developer could plausibly have supplied to the bundler. It should not be described
as the original private repository.

## Recovered application name

Generated GraphQL modules expose original build paths rooted at
`/vercel/path0/apps/claim-app`, and every instrumented chunk carries the Sentry
application key `claim-app`. The observable public metadata says
`Superfluid Claim App`, while the LiFi integration uses
`superfluid-claim-app`. The strongest conclusion is therefore:

- original monorepo workspace/directory and build key: `claim-app`;
- public product name: `Superfluid Claim App`;
- integration slug: `superfluid-claim-app`.

The unavailable original `package.json` means its exact npm package `name`
field remains unproven.
