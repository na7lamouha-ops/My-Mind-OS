"""Team registry tool — keeps one owner per task.

  python3 .claude/team/team.py check            # validate registry <-> .claude/agents, no duplicate owners; exit 1 on error
  python3 .claude/team/team.py who "words..."   # who already owns this job? (search keys, roles, descriptions)
  python3 .claude/team/team.py table            # rewrite .claude/team/TEAM.md (the readable register)
"""
import os
import re
import sys

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
AGENTS_DIR = os.path.join(ROOT, ".claude", "agents")
REG = os.path.join(HERE, "registry.yaml")
KEY = re.compile(r"^[a-z]+\.[a-z0-9-]+$")


def load():
    reg = yaml.safe_load(open(REG, encoding="utf-8"))
    files = {}
    for f in sorted(os.listdir(AGENTS_DIR)):
        if not f.endswith(".md"):
            continue
        txt = open(os.path.join(AGENTS_DIR, f), encoding="utf-8").read()
        m = re.match(r"^---\n(.*?)\n---\n", txt, re.S)
        fm = {}
        for line in (m.group(1).splitlines() if m else []):   # loose "key: value" like Claude Code's own loader
            k, _, v = line.partition(":")
            if _ and re.match(r"^[a-z_-]+$", k.strip()):
                fm[k.strip()] = v.strip()
        files[f[:-3]] = {"fm": fm, "body": txt}
    return reg, files


def check(reg, files):
    errs = []
    agents, teams = reg.get("agents", {}), reg.get("teams", {})
    owner = {}
    for name, a in agents.items():
        if name not in files:
            errs.append(f"{name}: in registry but no .claude/agents/{name}.md")
        if a.get("team") not in teams:
            errs.append(f"{name}: unknown team {a.get('team')!r}")
        if not a.get("owns"):
            errs.append(f"{name}: owns nothing")
        for k in a.get("owns", []):
            if not KEY.match(k):
                errs.append(f"{name}: bad task key {k!r} (use area.job)")
            if k in owner:
                errs.append(f"DUPLICATE: {k!r} owned by {owner[k]} AND {name}")
            owner[k] = name
    for name, a in agents.items():
        for k, who in (a.get("never") or {}).items():
            if owner.get(k) != who:
                errs.append(f"{name}: never[{k}] points to {who}, but the owner is {owner.get(k)}")
    for name, f in files.items():
        if name not in agents:
            errs.append(f"{name}.md exists but is not in the registry")
        if f["fm"].get("name") != name:
            errs.append(f"{name}.md: frontmatter name {f['fm'].get('name')!r} != file name")
        if not f["fm"].get("description"):
            errs.append(f"{name}.md: no description")
    return errs, owner


def who(reg, files, words):
    words = [w.lower() for w in words]
    hits = []
    for name, a in reg["agents"].items():
        hay = " ".join([name, a.get("role", ""), " ".join(a.get("owns", [])), a.get("why", ""),
                        str(files.get(name, {}).get("fm", {}).get("description", ""))]).lower()
        score = sum(hay.count(w) for w in words)
        if score:
            hits.append((score, name, a))
    for score, name, a in sorted(hits, key=lambda h: -h[0]):
        print(f"{score:3d}  {name:20s} {a['role']}  ->  {', '.join(a['owns'])}")
    if not hits:
        print("nobody matches: a new agent may be needed (check the list with: team.py table)")


def table(reg, owner):
    L = ["# سجل الفريق", "",
         "> ملف مولَّد من `registry.yaml` — ما تعدّلوش باليد. `python3 .claude/team/team.py table`", "",
         "كل مهمة عندها **مولى واحد**. قبل ما نزيدو وكيل: `team.py who \"...\"`.", ""]
    for t, desc in reg["teams"].items():
        members = [(n, a) for n, a in reg["agents"].items() if a["team"] == t]
        if not members:
            continue
        L += [f"## {desc}", "", "| الوكيل | الدور | المهام اللي يملكها | ما يديرهاش (يعطيها لـ) | تزاد | علاش |", "|---|---|---|---|---|---|"]
        for n, a in members:
            nv = ", ".join(f"{k}→{v}" for k, v in (a.get("never") or {}).items()) or "—"
            L.append(f"| `{n}` | {a['role']} | {', '.join(f'`{k}`' for k in a['owns'])} | {nv} | {a['added']} | {a['why']} |")
        L.append("")
    L += ["## فهرس المهام", "", "| المهمة | المولى |", "|---|---|"]
    L += [f"| `{k}` | `{v}` |" for k, v in sorted(owner.items())]
    open(os.path.join(HERE, "TEAM.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    print("wrote .claude/team/TEAM.md")


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    reg, files = load()
    errs, owner = check(reg, files)
    if cmd == "who":
        who(reg, files, sys.argv[2:])
        return
    for e in errs:
        print("ERROR", e)
    if errs:
        sys.exit(1)
    print(f"ok: {len(reg['agents'])} agents, {len(owner)} tasks, no task has two owners")
    if cmd == "table":
        table(reg, owner)


if __name__ == "__main__":
    main()
