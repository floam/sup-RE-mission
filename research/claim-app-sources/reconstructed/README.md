# Claim app application-source reconstruction

This directory is a semantic reconstruction of the first-party application source
shipped by `claim.superfluid.org`. It contains 120 readable TypeScript/TSX modules:
10 page routes, the root layout and error boundary, React components and providers,
transaction/data hooks, application configuration, narrow app-owned contract ABI
fragments, and inferred domain types.

It is **not** a byte-for-byte recovery. The deployment did not publish usable source
maps, so names and boundaries that cannot be proven are labeled as inference instead
of being presented as original source. `MODULE_MAP.md` is the canonical global symbol
table and evidence ledger; each public identity has one owning module there.

## Evidence used

- The captured production webpack chunks under
  `recovered/claim.superfluid.org/beautified/`, including factory IDs and literal
  values. These files are evidence only and are not part of this deliverable.
- The Sentry source catalog, which supplies many original source basenames and
  component identities.
- Next.js route payloads and chunk relationships, used to reconnect route shells to
  their client modules.
- The immutable production chunk matching the captured deployment, used to resolve
  factories absent from the local beautified catalog (notably claim/delegation,
  account/profile, program schema, Reserve names, and Swap behavior).
- The deployment's observable SuperJSON `/api/programs` response, used only as the
  transport counterpart for the client-visible `getProgramApps` boundary.

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

## Explicit boundaries

Some implementation was never sent to the browser and therefore cannot be honestly
reconstructed. The client referenced these Next.js server actions by stable ID:

| Client-visible action      | Server action ID                             |
| -------------------------- | -------------------------------------------- |
| `getProgramPoolInfos`      | `003f4c4ef5e976bf16920f03d8a97174f1d8ae67e6` |
| `getProgramApps`           | `0050c3f0d604f9162ceb3faa2d83005031b4be6b5f` |
| `getStakingStats`          | `00a6446d221d62d46ca41e7294731c14ab30fc9053` |
| `getLiquidityPoolStats`    | `00c1274b3226ccdf16c1f187bbdd66ac7c5647b0ae` |
| `getLiquidityRewardsStats` | `0099a827feb87232328ca49a8aaec8daa5598e5c0c` |
| `getTotalDelegatedAmount`  | `00cfeebe90442ab515b51fba3ba323324474e768b8` |

Their browser-visible call shapes and consumers are reconstructed; unavailable
server bodies are represented as typed loader/transport boundaries rather than
invented implementations. Likewise, the full Reown adapter network/connector list
was assembled from third-party exports in the production bundle. Observable
first-party AppKit options are recovered in `config/app-kit.ts`, while the adapter
instance remains an input to `ContextProvider`.

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
