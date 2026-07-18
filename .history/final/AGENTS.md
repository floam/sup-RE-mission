# Agent instructions

This repository is **SUP Re:Mission**, a workbench for Superfluid points, claim, campaign, event, and nonce investigations.

1. Read `.agents/skills/superfluid-points-research/SKILL.md` for points-related work.
2. Read `RESEARCH-MAP.md` and load only the material relevant to the task.
3. Check `PROVENANCE.md` before modifying externally sourced fragments or generated evidence.
4. Treat files under `tools/` as executable investigation utilities, not production application code.

## Do not duplicate the official Superfluid skill

Assume the official `superfluid` skill is installed separately. Use it for contract ABIs, selectors, deployed addresses, protocol architecture, general SDK guidance, standard subgraph references, and generic helper scripts.

Do not copy that material into this repository. A narrow external fragment belongs here only when the investigation needs to modify it or pin an exact version. Record every such fragment in `PROVENANCE.md`.
