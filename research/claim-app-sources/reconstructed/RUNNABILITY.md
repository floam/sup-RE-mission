# Running and deploying the recovered claim app

## Status

The reconstruction is a runnable, client-first Next.js application. It has an
app-local dependency lock, TypeScript configuration, production build,
responsive styling, a campaign explorer, AppKit/Wagmi wallet connection,
claim-state inspection, recent CMS point events, and Base claim submission.

The retained source tree is broader than the verified runnable surface. Modules
that still depend on missing private same-origin APIs are preserved for recovery
work but are not represented here as complete features.

## Local use

```sh
cd research/claim-app-sources/reconstructed
npm ci
npm run dev
```

The production path is `npm run build && npm start`. Vercel can deploy this
directory as the project root using the detected Next.js preset. The checked-in
`package-lock.json` is the dependency authority.

Alchemy provides the Base mainnet and Base Sepolia RPC transports. The supplied
public application key is the zero-configuration default; set
`NEXT_PUBLIC_ALCHEMY_API_KEY` in Vercel to rotate it without a code change. This
variable is necessarily public because Reown and wallet chain metadata consume
the resulting URLs in the browser.

## Data paths and compatibility boundary

| Behavior             | Browser data source                              | Why                                         |
| -------------------- | ------------------------------------------------ | ------------------------------------------- |
| Campaign enumeration | SUP Goldsky subgraph                             | Authoritative onchain program enumeration   |
| Campaign attribution | Recovered program-app definitions                | Names, seasons, and categories only         |
| Campaign filtering   | Local browser state                              | No server behavior is needed                |
| Wallet connection    | Reown AppKit and Wagmi connectors                | Uses the active connector, not only injected wallets |
| Eligibility display  | CMS, Alchemy, SUP subgraph, and GDA pools        | Reconstructed entirely in the browser       |
| Recent point events  | CMS `/points/events`                             | Scoped to the inspected account and campaign |
| Voucher creation     | CMS `signed-balance-batch`                       | CMS returns the authorized batch signature  |
| Transaction          | Wagmi wallet client, Base, and the user's locker | Submitted through the connected wallet      |

The claim flow does not proxy `claim.superfluid.org`. It reproduces point states
by enumerating SUP programs, joining CMS capped balances to the locker resolved
through Alchemy, and reading `getUnits(locker)` from each active program's GDA
pool. Programs missing from CMS remain visible but are excluded from claim
batches. Program lifecycle values include stopped, canceled, and early-ended
states and normalize GraphQL timestamp `"0"` as unset.

On an explicit claim, the app verifies that the connected wallet owns the
inspected account, switches through Wagmi to Base, splits selections into CMS's
50-campaign maximum, submits each exact signed target, waits for confirmation,
and refreshes the point state. The submit control remains disabled while this is
in progress.

## Verified runnable scope

- `/` explains the recovered build and links to its working areas.
- `/apps` enumerates every indexed SUP program, preserves shared attribution,
  and filters by status, name, category, ID, or pool address.
- `/claim` can inspect any address, show target and onchain units, display recent
  CMS point events, connect through AppKit, and submit eligible locker updates.
- `/liquidity`, `/reserve`, `/reserve-names`, `/staking`, and `/swap` retain their
  recovered client implementations and share the global wallet control.

## Preserved but incomplete modules

- `/governance` and `/leaderboard` still reference missing same-origin
  `/api/delegates*` and `/api/leaderboard*` routes.
- Bonus-flow and daily-mystery-box providers still reference missing
  `/api/bonus-flows/*` and `/api/mystery-box/*` routes. They are disabled by
  default and can be mounted only with
  `NEXT_PUBLIC_ENABLE_RECOVERED_REWARDS=true` while those APIs are being restored.
- Other recovered read-only actions remain source-backed evidence. Do not invent
  replacement responses merely to make a route appear functional.

## Known limitations

- Direct browser fetches depend on CMS and public subgraphs continuing to permit
  CORS.
- The transaction path supports the observed four-argument batch `claim` form.
  The recovered disconnect-finished-pools and claim-and-stake variants are not
  exposed.
- Root-relative artwork from the captured deployment is deliberately not copied.
  The runnable UI uses CSS rather than fabricating or hotlinking missing assets.
- This is a behavioral reconstruction, not the original private source tree or a
  byte-identical recompilation.
