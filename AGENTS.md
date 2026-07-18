# Repository agent guidance

Read `CLAUDE.md` for repository-wide structure, commands, conventions, and files to avoid.

## Superfluid points and SPR work

For tasks involving Superfluid points, SPR campaigns, claim programs, point events, claim vouchers, leaderboards, hidden campaign discovery, or SUP nonce research:

1. Load `.agents/skills/superfluid-points-research/SKILL.md`.
2. Open `POINTS-RESEARCH-CONTEXT.md` and load the task-specific research, scripts, generated evidence, and implementation files it identifies.
3. Use the adjacent general `.agents/skills/superfluid` skill for protocol-wide ABIs, selectors, subgraph schemas, SDK guidance, and generic Superfluid architecture.

Do not assume supporting research documents or scripts enter context merely because they exist in the repository. Follow the root context map before drawing conclusions or changing implementation.
