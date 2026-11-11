# My-Mind-OS — notes for Claude

- Talk to the owner in Algerian Darija / Arabic. Send a single video as MP4 (ZIP only for multi-file packs).
- Never generate the owner's face, avatar, talking head or voice. Real recordings only.

## The agent team (one owner per task)
- Register: `.claude/team/registry.yaml` (truth) → `.claude/team/TEAM.md` (readable, generated).
- Before delegating or hiring: `python3 .claude/team/team.py who "<job>"` and give the job to its owner.
- New agent / «زيد وكيل»: follow the `team-manager` agent's procedure; `python3 .claude/team/team.py table` must say «ok» before committing.
- Video work is led by the `edprod` skill (director); course lessons go to `course-editor`; store → `tassyir-ops`; ads → `ads-analyst`; product strategy → `cod-strategist`.
