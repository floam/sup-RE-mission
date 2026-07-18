# Superfluid points investigations

A sparse historical overlay for the claim-voucher Shortcuts injector and the `superfluid-points-research` skill.

This is not a forked working copy of `superfluid-org/superfluid.pro`. Untouched upstream files are absent. Files inherited from upstream first appear in the commit where this repository changed them, as though the upstream tree had existed locally but remained untracked.

## Main artifacts

- `docs/tools/claim-voucher-shortcuts.js`
- `.agents/skills/superfluid-points-research/SKILL.md`
- `POINTS-RESEARCH-CONTEXT.md`
- `cms/src/scripts/export-point-event-names.ts`
- `sdk/package/scripts/investigate-sup-nonces.js`

## Commands

```sh
npm install
npm run export:point-events
npm run investigate:nonces -- --user 0x... --program-ids 607
npm run test:nonces
npm run bundle:nonces
```
