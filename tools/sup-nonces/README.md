# SUP nonce scanner

`scan-sup-nonces.js` is an executable Base transaction scanner. It finds
successful FluidLocker claim transactions for one account and a requested set of
program IDs, decodes their calldata, and reports the largest transaction-age
deltas first. It is not production application code.

## Run

```sh
npm run scan:nonces -- \
  --user 0x0000000000000000000000000000000000000000 \
  --program-ids 607,611
```

Use `npm run scan:nonces -- --help` for every option. Important options
include `--rpc-url`, `--from-block`, `--to-block`, `--lookback-days`,
`--chunk-size`, `--limit`, `--min-age-hours`, and `--json`.

The default RPC is `https://rpc-endpoints.superfluid.dev/base-mainnet`; it can be
overridden by `--rpc-url`, `BASE_RPC_URL`, or `RPC_URL`. Proxy environment variables
are supported for Node runs. The generated JavaScriptCore/a-Shell bundle deliberately
does not embed an undici import.

## Validation and limits

```sh
npm run test:nonces
npm run bundle:nonces
```

`test:nonces` is a live CMS and Base RPC smoke test using the current leading S6
Gardens account, so it requires outbound network access and can change as live data
changes. `bundle:nonces` writes the ignored
`scan-sup-nonces.bundle.js` artifact used by the release workflow.

Claim logs do not contain a nonce. The utility first finds claim logs, then decodes
the successful transaction input; batch claim functions use one nonce across all
program IDs in that transaction. Read the dated analysis in
`research/fluid-ep-nonce-staleness-assessment.md` before making security claims.
