# Claim app source recovery

This tool captures the live `claim.superfluid.org` Next.js deployment and produces a
provenance-aware source tree. It is an investigation utility, not application code.

Run:

```sh
npm install
npm run recover:claim-sources -- --out /tmp/claim-live-recovery
```

The default output path is `recovered/claim.superfluid.org`, but that location is
the repository's pinned evidence snapshot. Use a separate `--out` directory for
live checks. Recovery will clean an existing output directory only when it contains
the exact `.claim-source-recovery-output-v1` ownership marker created by this tool.
Use `--capture <directory>` to replay a previously collected `pages/` and `assets/`
tree, `--routes <comma-separated routes>` to narrow routes, and `--max-assets <N>`
to set the recursive asset safety cap.

The output contains:

- `raw/`: exact fetched pages, chunks, styles, and any published source maps.
- `beautified/`: formatting-only copies of complete JavaScript chunks.
- `original/`: verbatim `sourcesContent` entries when the deployment publishes source maps.
- `synthesized/`: webpack modules split from deployed chunks and formatted individually.
- `manifest.json`: route and asset URLs, SHA-256 hashes, module records, source-map attempts, and provenance.

The tool's default live route set is `/`, `/reserve`, `/reserve-names`, `/claim`,
`/apps`, `/leaderboard`, `/governance`, `/staking`, `/liquidity`, and `/swap`.
The pinned snapshot intentionally records only the eight routes captured on
2026-07-20; see `recovered/claim.superfluid.org/snapshot-manifest.json` for that
immutable capture rather than using it as a statement about the current deployment.

The pinned capture contains eight route documents, one stylesheet, and 51 JavaScript
chunks (52 assets total). Its deployment-specific source-map behavior and module
counts are historical evidence, not a guarantee for a later live recovery.

Synthesized files preserve deployed function bodies and literals, but inferred filenames, labels, imports, comments, and original file boundaries must not be presented as author source.

## Verify the pinned snapshot

```sh
npm run verify:claim-snapshot
```

The verifier checks exact raw asset coverage, byte counts, SHA-256 hashes, and the
Prettier 3.6.2 raw-to-beautified equivalence. It can compare a live recovery without
mutating the snapshot:

```sh
node tools/claim-source-recovery/verify-snapshot.mjs \
  --live-manifest /tmp/claim-live-recovery/manifest.json \
  --report /tmp/claim-live-recovery/snapshot-diff.json
```
