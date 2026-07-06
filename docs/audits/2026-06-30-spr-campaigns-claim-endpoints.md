# SPR endpoint audit for campaigns.superfluid.org and claim.superfluid.org

Date: 2026-06-30

## Scope and method

This audit fetched the public Next.js pages for `https://campaigns.superfluid.org` and `https://claim.superfluid.org`, downloaded their referenced JavaScript chunks to `/tmp/spr-audit`, and searched those chunks for SPR-, points-, claim-, and campaign-related network calls. The downloaded bundles are intentionally not committed.

## Summary

`campaigns.superfluid.org` currently uses one CMS points endpoint related to SPR, while `claim.superfluid.org` uses a separate set of claim-app API routes for SUP/SPR claiming, daily mystery boxes, bonus flows, delegates, and leaderboard lookups.

The only route from these public bundles that maps to this repository's implemented CMS points API is:

- `GET /api/points/balance?account={address}` on `campaigns.superfluid.org`.

The claim app routes below do not appear to be implemented in this repository. They look like app-local routes in the deployed claim app rather than CMS routes under `cms/src/app/(api)/points`.

## campaigns.superfluid.org endpoints

| Endpoint | Method | Evidence from bundle | Purpose inferred from client code | Repo mapping |
| --- | --- | --- | --- | --- |
| `/api/points/balance?account={address}` | GET | `fetch("/api/points/balance?account=".concat(e), { cache: "no-store" })` | Reads an account's campaign points and prefers `cappedPoints` over `points` for UI/account state. | Implemented as CMS `GET /points/balance`; campaigns appears to expose/proxy it under `/api/points/balance`. |
| `/api/markee/leaderboards` | GET | `fetch("/api/markee/leaderboards")` | Reads Markee leaderboard data; not SPR-specific, but present in the campaigns app. | No matching route found in this repository. |
| `https://whois.superfluid.finance/api/resolve/{address}` | GET | `fetch("https://whois.superfluid.finance/api/resolve/".concat(e))` | Resolves Superfluid profile metadata for addresses. | External service. |
| The Graph gateway subgraph ID `BpAX3z73agVd1qabngZrTj2etofZ9SgDdWz1yWyNoXtQ` | POST | `fetch("https://gateway.thegraph.com/api/.../subgraphs/id/BpAX3z73agVd1qabngZrTj2etofZ9SgDdWz1yWyNoXtQ", { method: "POST" ... })` | Campaign/subgraph data used by the public campaigns UI. | External GraphQL endpoint. |

## claim.superfluid.org endpoints

| Endpoint | Method | Evidence from bundle | Purpose inferred from client code | Repo mapping |
| --- | --- | --- | --- | --- |
| `/api/points/states?accountAddress={address}` | GET | `fetch(`/api/points/states?accountAddress=${i}`)` | Checks whether the connected account can claim program points before fetching the claim payload. | No matching route found in this repository. |
| `/api/points/claim?accountAddress={address}` | GET | `fetch(`/api/points/claim?accountAddress=${i}`)` | Returns point-claim transaction data, including single/batch transaction type, program IDs, units, nonce, and Stack signature used for `claim`, `claimAndStake`, `disconnectAndClaim`, or batch variants. | No matching route found in this repository. |
| `/api/mystery-box/check?address={address}` | GET | `fetch(`/api/mystery-box/check?address=${e}`)` | Checks daily mystery-box eligibility/status. | No matching route found in this repository. |
| `/api/mystery-box/claim` | POST | `fetch("/api/mystery-box/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: e, transactionHash: t }) })` | Claims a mystery-box result after a transaction hash is available. | No matching route found in this repository. |
| `/api/bonus-flows/check?address={address}` | GET | `fetch(`/api/bonus-flows/check?address=${e}`)` | Checks bonus-flow eligibility/status. | No matching route found in this repository. |
| `/api/bonus-flows/claim` | POST | `fetch("/api/bonus-flows/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: e }) })` | Claims bonus-flow points/SUP-per-month information; response fields include `points`, `supPerMonth`, and `isBigBonus`. | No matching route found in this repository. |
| `/api/delegates` | GET | `fetch("/api/delegates")` | Retrieves delegates; client warns if `X-Delegates-Source` is `snapshot`, implying a live source with local snapshot fallback. | No matching route found in this repository. |
| `/api/delegates/amount?address={address}` | GET | `fetch(`/api/delegates/amount?address=${n.address}`)` | Retrieves delegated amount for a delegate. | No matching route found in this repository. |
| `/api/leaderboard/search?address={address}` | GET | `fetch(`/api/leaderboard/search?address=${l}`)` | Searches leaderboard data for the connected account. | No matching route found in this repository. |
| `https://superfluid-airdrop.goodworker.workers.dev/?address={address}` | GET | `fetch(`https://superfluid-airdrop.goodworker.workers.dev/?address=${e}`)` | Checks airdrop eligibility/status via a Cloudflare Worker. | External service. |
| `https://superfluid-eligibility-api.s.superfluid.dev/api/referrals` | Not observed as direct fetch in the inspected fragments | Exported as a referrals API base URL in claim-app constants. | External service. |
| `https://sup-metrics-api.superfluid.dev` | Not observed as direct fetch in the inspected fragments | Exported as a SUP metrics API base URL in claim-app constants. | External service. |
| `https://whois.superfluid.finance/api/resolve/{address}` | GET | `fetch(`https://whois.superfluid.finance/api/resolve/${n}`)` | Resolves Superfluid profile metadata for addresses. | External service. |
| `https://api.goldsky.com/api/public/project_clsnd6xsoma5j012qepvucfpp/subgraphs/sup/v2/gn` | GraphQL | Present as the production SUP subgraph endpoint in claim-app bundles. | External GraphQL endpoint. |
| `https://api.goldsky.com/api/public/project_clsnd6xsoma5j012qepvucfpp/subgraphs/sup_test/latest/gn` | GraphQL | Present as the test SUP subgraph endpoint in claim-app bundles. | External GraphQL endpoint. |
| `https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1` | GraphQL | Present as a protocol subgraph endpoint in claim-app bundles. | External GraphQL endpoint. |
| `https://subgraph-endpoints.superfluid.dev/base-sepolia/protocol-v1` | GraphQL | Present as a protocol subgraph endpoint in claim-app bundles. | External GraphQL endpoint. |

## Notes on undocumented points routes

The previous points API review found no functional CMS `/points/*` route missing from the points OpenAPI registry. This bundle audit adds that the public claim app uses `/api/points/states` and `/api/points/claim`, but those are not the same CMS points routes audited earlier and no matching implementation was found under this repository's route files.

If these claim-app routes should be documented alongside the CMS points API, their source likely lives outside this repository or in a separately deployed claim-app package.
