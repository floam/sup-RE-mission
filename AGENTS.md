# Agent instructions

This repository is **SUP Re:Mission**, a workbench for Superfluid points, claims,
campaigns, event evidence, flow projections, and nonce investigations.

## Work in this repository

1. For points-related work, read `skills/superfluid-points-research/SKILL.md` and use
   `RESEARCH-MAP.md` to load only the relevant references.
2. Follow the detailed runtime, claim, event-reconciliation, and evidence rules in
   the references selected by the research map. Do not restate those rules here.
3. Check `PROVENANCE.md` before changing external or generated material, including
   ABI fragments and deployment metadata.
4. Treat `tools/` as investigation utilities, not production application code.
5. Keep recovered source distinct from repository-authored compatibility code.
6. Update relevant documentation when behavior, interfaces, evidence, or source
   authority changes. Avoid brittle details such as exact test counts and obsolete
   names or statuses.

## Superfluid protocol material

Use the separately installed official `superfluid` skill for general protocol
material. Do not duplicate it in this repository. If an investigation must pin or
modify a narrow external fragment, record its source, version, local changes, reason,
and refresh procedure in `PROVENANCE.md`.
