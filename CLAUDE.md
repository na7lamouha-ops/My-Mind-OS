# My-Mind-OS — notes for Claude

- Talk to the owner in Algerian Darija / Arabic. Send a single video as MP4 (ZIP only for multi-file packs).
- Never generate the owner's face, avatar, talking head or voice. Real recordings only.

## The agent empire (one owner per task, linked by flows, every job logged once)
- Entry point: the `empire` skill (you are the chief). Video work → the `edprod` director skill.
- `.claude/team/registry.yaml` departments, agents, task keys, links · `flows.yaml` cross-department flows with approval gates
- `.claude/team/LESSONS.md` the owner's standing rules (every agent reads it) · `journal.jsonl` the work log · `TEAM.md` generated view
- `python3 .claude/team/team.py who|flow|claim|done|board|table` — `table` must print «ok» before committing.
- New agent / «زيد وكيل» → the `team-manager` agent.
