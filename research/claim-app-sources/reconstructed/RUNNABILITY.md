# Running and deploying the recovered claim app

## Status

The reconstruction is now a runnable, client-first Next.js application. It has
an app-local dependency lock, TypeScript configuration, production build, basic
responsive styling, campaign explorer, injected-wallet connection, eligibility
display, Base claim submission, and the recovered feature routes.

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
variable is necessarily public because Reown and injected-wallet chain metadata
consume the resulting URLs in the browser.

## Data paths and compatibility boundary

| Behavior             | Browser data source                                  | Why                                        |
| -------------------- | ---------------------------------------------------- | ------------------------------------------ |
| Campaign enumeration | SUP Goldsky subgraph                                 | Public GraphQL replaces a server action    |
| Campaign filtering   | Local browser state                                  | No server behavior is needed               |
| Wallet connection    | Injected EIP-1193 provider                           | Accounts never pass through this app       |
| Eligibility display  | CMS, Alchemy, SUP and protocol subgraphs             | Reconstructed entirely in the browser      |
| Voucher creation     | CMS `signed-balance-batch`                           | CMS returns the authorized batch signature |
| Transaction          | Injected provider, Base chain, and the user's locker | Encoded and submitted entirely client side |
| Leaderboard          | Rewritten to claim API                               | Ranking semantics are not public           |
| Delegates            | Rewritten to claim API                               | Production projection is not recovered     |
| Mystery box          | Rewritten to claim API                               | Eligibility and issuance are a black box   |
| Bonus flows          | Rewritten to claim API                               | Eligibility and issuance are a black box   |

The claim flow does not proxy `claim.superfluid.org`. It reproduces point states by
joining CMS capped balances to the locker resolved through Alchemy and the locker's
indexed pool-member units. On an explicit claim it requests the selected campaign
set from CMS `signed-balance-batch` and submits that exact signed target. The app
has no `app/api` compatibility routes and sends no account through a Vercel
function.

The recovered read-only server actions remain source-backed implementations. Four
unrecovered API families use explicit Next.js rewrites to the original host so the
retained routes and global providers do not receive local 404 responses. These are
configuration-level pass-throughs, not replacement route handlers. Leaderboard
ranking cannot safely be recreated from point events without its unpublished tie,
cap, and exclusion rules. Delegate response projection is likewise not established
well enough to invent. Mystery-box and bonus-flow eligibility and reward issuance
are known black boxes. Requests and responses for these paths therefore retain the
production behavior; the standalone deployment holds no signing key or copied
business logic.

## Functional scope

- `/` explains the recovered build and links to its working areas.
- `/apps` enumerates all indexed SUP programs and filters by ID or pool address.
- `/claim` connects an injected wallet (or checks a pasted address), displays
  target and onchain units, obtains a voucher only on an explicit claim, switches
  to Base, and submits `FluidLocker.claim` through the wallet.
- `/governance`, `/leaderboard`, `/liquidity`, `/reserve`, `/reserve-names`,
  `/staking`, and `/swap` retain their recovered route implementations.

## Known limitations

- Direct browser fetches depend on CMS and the public subgraphs continuing to
  permit CORS.
- Leaderboard, delegate, mystery-box, and bonus-flow features depend on the live
  claim API through the documented rewrites above.
- The transaction path supports the observed single and batch `claim` forms. The
  recovered disconnect-finished-pools and claim-and-stake variants are not exposed.
- Root-relative artwork from the captured deployment is deliberately not copied.
  The runnable UI uses CSS rather than fabricating or hotlinking missing assets.
- This is a behavioral reconstruction, not the original private source tree or a
  byte-identical recompilation.
