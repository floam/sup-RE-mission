# Running and deploying the recovered claim app

## Status

The reconstruction is a runnable, client-first Next.js application with a small
server compatibility layer. It has an app-local lockfile, TypeScript configuration,
production build, responsive styling, campaign explorer, Reown/Wagmi wallet
connection, eligibility review, projected SUP flow display, transaction-confirmed
pending-claim explanations, Base claim submission, and the recovered feature routes.

## Local use

```sh
cd research/claim-app-sources/reconstructed
npm ci
npm run dev
```

The production path is `npm run build && npm start`. Vercel can deploy this
directory as the project root using the detected Next.js preset. The checked-in
`package-lock.json` is the dependency authority.

Alchemy provides Base mainnet and Base Sepolia RPC transports. The supplied public
application key is the zero-configuration default; set
`NEXT_PUBLIC_ALCHEMY_API_KEY` in Vercel to rotate it without a code change. This
variable is public because browser wallet/chain configuration consumes the URLs.

## Contract and service stack

The runnable claim path uses:

- `@sfpro/sdk/abi/sup` for `lockerFactoryAddress`, `lockerFactoryAbi`, and `lockerAbi`;
- Wagmi core `readContract` for claim-state and flow reads;
- a Wagmi public client for SDK claim-log verification;
- Wagmi hooks for chain switching and `useWriteContract`;
- `waitForTransactionReceipt` for submitted-transaction confirmation;
- `lib/cms-client.ts` as the sole claim-app CMS transport boundary;
- a narrow local GDA pool ABI for members not exported by `@sfpro/sdk`:
  `getTotalAmountReceivedByMember`, `getMemberFlowRate`, `getTotalUnits`, and
  `getTotalFlowRate`.

Do not add hand-written locker/factory ABIs beside the SDK exports. Do not construct
CMS `/points/*` URLs in claim components or claim-state helpers; add typed operations
to generated `openapi-fetch` client instead.

`@sfpro/sdk` 0.2.3 supplies the contract surface. It does not publish a CMS HTTP
client, so the repository-authored generated `openapi-fetch` client follows the public CMS OpenAPI contracts
and centralizes balance, signature, and event requests.

## Data paths and compatibility boundary

| Behavior | Data source | Why |
| --- | --- | --- |
| Campaign enumeration | SUP Goldsky subgraph | Public GraphQL replaces the original server action for existence/lifecycle. |
| Campaign attribution | Local recovered app definitions and claim-app metadata | Adds names, seasons, categories, and app identity. |
| Wallet connection | Reown AppKit plus Wagmi | Handles injected and configured wallet connectors. |
| CMS target units | `cmsClient.POST("/points/balance-batch", …)` | Returns capped target units and missing-campaign warnings for active programs in batches of 50. |
| Locker and current units | SDK locker/factory ABIs through Wagmi | Resolves `getUserLocker` and `getUnitsPerProgram`. |
| Current member flow | SDK `lockerAbi` through Wagmi | Reads `getFlowRatePerProgram`. |
| Pool totals | Direct GDA pool reads through Wagmi | Supplies `getTotalUnits` and `getTotalFlowRate` for projection. |
| Previous-claim discovery | SUP `FluidStreamClaimEvent` and `ClaimEventUnit` entities | Locates locker claims and the campaign IDs included in them. |
| Previous-claim verification | SDK claim events through Wagmi RPC | Requires an onchain locker claim log with the same transaction hash as the indexed event. |
| Pending event explanation | Local `GET /api/pending-claim-events` | Fetches CMS events whose event time is after a transaction-confirmed prior claim. |
| Voucher creation | `cmsClient.POST("/points/signed-balance-batch", …)` | Returns the authorized capped target units and signature. |
| Transaction | SDK `lockerAbi`, Wagmi, Base, user's locker | Submitted only after an explicit user action. |

The claim flow does not proxy `claim.superfluid.org`. It reconstructs point state by
joining CMS capped balances to SDK/Wagmi locker reads for active SUP programs.
Program lifecycle values are normalized as numeric timestamps (`"0"` means not
stopped), rather than using GraphQL string truthiness. Finished and stopped programs
are not sent to the CMS during normal claim-state review.

Every CMS batch is checked before use: the response account must match the reviewed
wallet, campaign IDs must remain in request order, and all parallel point arrays must
have the expected length. The claim submits only the capped `points`; diagnostic
`uncappedPoints` are validated for shape but never used as target units.

Submitted receipts must report `status: success`. If a later batch fails after an
earlier transaction confirmed, the UI refreshes claim state so the successful partial
update is visible instead of leaving all campaigns looking pending.

## SUP flow projection

Each campaign shows:

- current member flow from `FluidLocker.getFlowRatePerProgram`;
- projected member flow after the target unit update;
- projected change in `SUP/month`.

Projection formula:

```text
projectedTotalUnits = poolTotalUnits - currentMemberUnits + targetMemberUnits
projectedFlowRate = poolTotalFlowRate * targetMemberUnits / projectedTotalUnits
```

The UI uses `2,628,000` seconds per average month. The projected rate is an estimate:
funding changes or other member-unit updates before transaction inclusion can change
the final flow.

## Pending claim events route

```text
GET /api/pending-claim-events?account=<address>&campaignId=<id>
GET /api/pending-claim-events?account=<address>&campaignId=<id>&debug=1
```

The route:

1. validates account and campaign;
2. resolves the campaign pool from the SUP program list;
3. resolves the account locker through SDK factory ABI and server Wagmi config;
4. queries SUP-subgraph `fluidStreamClaimEvents` for the locker, newest first;
5. filters derived `ClaimEventUnit` rows to the requested campaign;
6. queries SDK-defined `FluidStreamClaimed` and `FluidStreamsClaimed` logs from the
   locker at each candidate block;
7. accepts a previous claim boundary only when the onchain SDK event transaction hash
   matches the indexed transaction hash;
8. calls `getCmsEventsSince` only after a claim is confirmed;
9. returns grouped-event input or an explicit unverified/no-claim status.

Response status is one of `confirmed-claim`, `indexed-claim-unverified`, `no-claim`, or
`no-locker`. Only `confirmed-claim` can return events. The other statuses return an
empty event list, preventing the pending-claim view from silently degrading into full
campaign history.

The search is intentionally bounded to 1,000 indexed locker claim events and 25 RPC
confirmation attempts. CMS pagination is also bounded; exceeding the event-page cap
fails explicitly instead of returning a silently truncated explanation. Missing
coverage remains explicit through `lastClaimAt: null` and `lastIndexedClaimAt` when an
indexed claim cannot be verified.

The CMS events endpoint filters on `eventTime` and exposes that value under the
compatibility field name `createdAt`. It does not expose record insertion time. The UI
therefore describes these as events **dated** after the last claim. A backfilled event
inserted later with an earlier event time can be absent from this view.

`balances.superfluid.dev` is not part of this boundary path. It can be used for
optional token-ledger investigation, but known locker/SUP queries may be empty even
when claims exist.

## Functional scope

- `/` explains the reconstructed build and links to working areas.
- `/apps` enumerates indexed SUP programs and filters by ID or pool address.
- `/claim` connects a wallet or checks any pasted address; shows current/projected
  flows, campaign target units, transaction-confirmed grouped CMS events, and submits
  a batch claim only when the connected wallet owns the reviewed Reserve.
- `/governance`, `/leaderboard`, `/liquidity`, `/reserve`, `/reserve-names`,
  `/staking`, and `/swap` retain their recovered route implementations.

## Verification

Before describing a branch as ready:

```sh
npm test
npm run test:e2e
npm run build
```

Also exercise:

```text
/claim
/api/pending-claim-events?account=<known-address>&campaignId=<known-campaign>&debug=1
```

A successful build can still emit the known third-party server-render telemetry
warning; distinguish a warning followed by `Build Completed` from a type/build
failure.

## Known limitations

- Direct browser data reads depend on public subgraphs and the CMS OpenAPI client's public API
  origin continuing to permit the configured request path.
- Claim-history coverage depends on the SUP subgraph indexing the locker claim and the
  configured RPC retaining the corresponding log.
- The bounded search may leave an older claim unverified; it deliberately prefers no
  explanation over a false “this claim” history.
- Event-time filtering cannot identify backfilled records whose event time predates
  the last claim.
- Flow projections hold pool total flow constant and can change before execution.
- The transaction path supports observed single and batch `claim` forms. Recovered
  disconnect-finished-pools, claim-and-stake, and future gasless macro variants are
  not exposed by this PR.
- Root-relative artwork from the captured deployment is deliberately not copied.
- This is a behavioral reconstruction, not the original private source tree or a
  byte-identical recompilation.
