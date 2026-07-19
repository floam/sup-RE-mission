# Claim app source recovery

This tool captures the live `claim.superfluid.org` Next.js deployment and produces a provenance-aware source tree.

Run:

```sh
npm install
npm run recover:claim-sources
```

The output contains:

- `raw/`: exact fetched pages, chunks, styles, and any published source maps.
- `beautified/`: formatting-only copies of complete JavaScript chunks.
- `original/`: verbatim `sourcesContent` entries when the deployment publishes source maps.
- `synthesized/`: webpack modules split from deployed chunks and formatted individually.
- `manifest.json`: route and asset URLs, SHA-256 hashes, module records, source-map attempts, and provenance.

The current deployment exposes these routes: `/`, `/reserve`, `/claim`, `/apps`, `/leaderboard`, `/governance`, `/staking`, and `/liquidity`.

A successful live run on July 19, 2026 captured all eight routes and 52 assets, with no failed assets. The deployment published no usable source maps, so the run produced 1,997 synthesized module records instead of verbatim original files.

Synthesized files preserve deployed function bodies and literals, but inferred filenames, labels, imports, comments, and original file boundaries must not be presented as author source.
