# Repository guidance

This repository is a sparse historical overlay containing the Superfluid claim-voucher Shortcuts injector, the `superfluid-points-research` skill, and focused investigation artifacts.

For points, campaign, claim, event-name, or nonce work:

1. Read `.agents/skills/superfluid-points-research/SKILL.md`.
2. Read `POINTS-RESEARCH-CONTEXT.md` and load only the files mapped to the task.
3. Treat retained `cms/`, `sdk/`, and `website/` paths as individual investigation deltas, not complete upstream applications.
4. Assume the general Superfluid skill is installed separately for protocol-wide ABIs, subgraphs, SDK usage, and architecture.

Do not reintroduce the upstream monorepo. Add an upstream file only when an investigation intentionally modifies or preserves that specific file.
