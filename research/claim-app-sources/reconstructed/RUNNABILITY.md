# Run readiness and remaining gaps

## Current status

The reconstructed tree is **not yet a bootable standalone application**.
It is coherent audit source: its relative imports resolve, its TS/TSX syntax
transpiles, and the reconstructed read-only server actions can be exercised in
isolation. A successful syntax/transpile check is not a Next.js production
build or a browser smoke test.

## Hard blockers

| Blocker                       | Evidence in this tree                                                                                                                                                     | Runtime effect                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Missing application scaffold  | No app-local `package.json`, lockfile, `tsconfig.json`, Next configuration, PostCSS/Tailwind configuration, build scripts, or pinned dependency versions                  | There is no supported install/build/start command, and package/API compatibility is untested   |
| Missing root bootstrap        | `app/layout.tsx` does not mount `ContextProvider`; `ContextProvider` requires a `wagmiConfig` that is never constructed; no recovered `createAppKit`/adapter setup exists | Wallet, Query, expected-chain, Farcaster, and Reserve consumers fail or remain disconnected    |
| Missing server routes         | No `app/api/**/route.ts` modules exist for the ten client-consumed endpoints below                                                                                        | Claim, leaderboard, governance-directory, mystery-box, and bonus-flow features cannot complete |
| Missing visual source         | No global CSS/Tailwind source, local-font wiring, or `public/` tree exists; reconstructed code references 91 root-relative images/SVGs                                    | The app is unstyled and most imagery 404s                                                      |
| Unproven server configuration | The Uniswap V3 server endpoint is an inferred fallback; RPC/cache/deployment settings and production error policy are not fully recovered                                 | Read-only statistics can differ or fail by environment                                         |
| No integrated validation      | The tree has not passed a real `next build`, local boot, route smoke test, wallet connection, or transaction test                                                         | Additional framework-boundary and behavior defects should be expected                          |

The missing client-consumed API routes are:

| Method and route              | Consumer                   | What is missing                                            |
| ----------------------------- | -------------------------- | ---------------------------------------------------------- |
| `GET /api/points/states`      | claim transaction hook     | Offchain capped points joined to onchain pool-member units |
| `GET /api/points/claim`       | claim transaction hook     | Claim voucher/call data assembly                           |
| `GET /api/leaderboard`        | leaderboard page           | Paginated leaderboard projection                           |
| `GET /api/leaderboard/search` | navigation and claim UI    | Address rank lookup                                        |
| `GET /api/delegates`          | governance UI              | Delegate directory/profile projection                      |
| `GET /api/delegates/amount`   | governance UI              | Per-delegate amount lookup                                 |
| `GET /api/mystery-box/check`  | daily mystery-box provider | Eligibility and pending-result check                       |
| `POST /api/mystery-box/claim` | daily mystery-box provider | Reward issuance/claim response                             |
| `GET /api/bonus-flows/check`  | bonus modal                | Eligibility check                                          |
| `POST /api/bonus-flows/claim` | bonus modal                | Bonus issuance/claim response                              |

Several read paths can be reconstructed from public CMS, Snapshot, subgraph,
metrics, and RPC sources. The reward-issuing paths may also depend on
server-held signing authority, anti-abuse state, or private configuration that
was never sent to the browser. A locally usable compatibility build could proxy
the still-live production endpoints; an independent deployment must replace
those authorities rather than invent them.

## What is already usable

- The 124 reconstructed modules provide readable route, component, hook,
  provider, type, contract-fragment, and server-query logic.
- The 72-entry application/program registry and six server-action contracts
  have observable-response and public-source backing.
- Exact addresses, endpoints, ABI members, fees, durations, transaction
  argument order, storage keys, query gates, and bigint behavior are retained
  where observed.
- The pinned raw bundle snapshot and verifier now make formatter drift and
  deployment asset drift machine-detectable.

## Shortest path to a working compatibility build

1. Recover or create the Next.js/package/Tailwind scaffold with versions
   compatible with the captured chunks.
2. Reconstruct the Reown/Wagmi adapter, mount `ContextProvider` from the root
   layout, and restore cookie hydration.
3. Restore the generated CSS, fonts, and 91 referenced public assets (or
   deliberately substitute them).
4. Implement the ten API routes from public sources where possible and
   explicitly configure/proxy the signing-authority routes.
5. Run `next build`, boot all routes, then test disconnected, connected,
   Reserve-created, and transaction states. Only after that should the result
   be described as usable application source.

Byte-for-byte recompilation is not an appropriate success criterion: bundler
versions, module IDs, minification, build timestamps, and server-action IDs
will differ. Behavioral fixtures, exact literals/call arguments, route output,
and transaction simulations are the meaningful divergence checks.
