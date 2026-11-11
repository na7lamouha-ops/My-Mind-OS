"""The agent empire's control tool — one owner per task, linked by flows, every job logged once.

  python3 .claude/team/team.py check                      # registry <-> agent files, one owner per task, flows valid, contract present
  python3 .claude/team/team.py who "words..."             # who owns this job?
  python3 .claude/team/team.py flow <name>                # print a flow as a plan (step · task · owner · gates)
  python3 .claude/team/team.py claim <task> "<subject>" [--flow F]   # open a job; refused if the same job is already open
  python3 .claude/team/team.py done <job-id> [output] / drop <job-id> [reason]
  python3 .claude/team/team.py board                      # open jobs (the work log)
  python3 .claude/team/team.py table                      # rewrite .claude/team/TEAM.md (org chart, departments, flows, index, board)
"""
import datetime as dt
import json
import os
import re
import sys

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
AGENTS_DIR = os.path.join(ROOT, ".claude", "agents")
REG, FLOWS, JOURNAL = (os.path.join(HERE, f) for f in ("registry.yaml", "flows.yaml", "journal.jsonl"))
KEY = re.compile(r"^[a-z]+\.[a-z0-9-]+$")
LEADS_NOT_AGENTS = {"chief", "edprod"}           # the main session and the edprod director skill


# ------------------------------------------------------------------ load
def load():
    reg = yaml.safe_load(open(REG, encoding="utf-8"))
    flows = yaml.safe_load(open(FLOWS, encoding="utf-8")).get("flows", {}) if os.path.exists(FLOWS) else {}
    files = {}
    for f in sorted(os.listdir(AGENTS_DIR)):
        if not f.endswith(".md"):
            continue
        txt = open(os.path.join(AGENTS_DIR, f), encoding="utf-8").read()
        m = re.match(r"^---\n(.*?)\n---\n", txt, re.S)
        fm = {}
        for line in (m.group(1).splitlines() if m else []):   # loose "key: value", like Claude Code's own loader
            k, sep, v = line.partition(":")
            if sep and re.match(r"^[a-z_-]+$", k.strip()):
                fm[k.strip()] = v.strip()
        files[f[:-3]] = {"fm": fm, "body": txt}
    return reg, flows, files


def owners(reg):
    return {k: n for n, a in reg["agents"].items() for k in a.get("owns", [])}


def steps_of(flow):
    """flatten a flow into [(step_no, kind, value)] kind = task | gate."""
    out = []
    for i, s in enumerate(flow["steps"], 1):
        if isinstance(s, dict) and "gate" in s:
            out.append((i, "gate", s["gate"]))
        else:
            for k in (s if isinstance(s, list) else [s]):
                out.append((i, "task", k))
    return out


# ------------------------------------------------------------------ check
def check(reg, flows, files):
    errs = []
    agents, depts = reg.get("agents", {}), reg.get("departments", {})
    owner = {}
    for name, a in agents.items():
        if name not in files:
            errs.append(f"{name}: in registry but no .claude/agents/{name}.md")
        if a.get("dept") not in depts:
            errs.append(f"{name}: unknown department {a.get('dept')!r}")
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
                errs.append(f"{name}: never[{k}] -> {who}, but the owner is {owner.get(k)}")
        for f in a.get("feeds") or []:
            if f not in agents:
                errs.append(f"{name}: feeds unknown agent {f!r}")
    for d, v in depts.items():
        if v.get("lead") not in agents and v.get("lead") not in LEADS_NOT_AGENTS:
            errs.append(f"department {d}: lead {v.get('lead')!r} is not an agent")
    for name, f in files.items():
        if name not in agents:
            errs.append(f"{name}.md exists but is not in the registry")
        if f["fm"].get("name") != name:
            errs.append(f"{name}.md: frontmatter name {f['fm'].get('name')!r} != file name")
        if not f["fm"].get("description"):
            errs.append(f"{name}.md: no description")
        if "TEAM-CONTRACT:start" not in f["body"]:
            errs.append(f"{name}.md: team contract missing")
    for fn, fl in flows.items():
        for i, kind, v in steps_of(fl):
            if kind == "task" and v not in owner:
                errs.append(f"flow {fn} step {i}: task {v!r} has no owner")
    return errs, owner


# ------------------------------------------------------------------ journal (the work log)
def journal():
    if not os.path.exists(JOURNAL):
        return []
    return [json.loads(l) for l in open(JOURNAL, encoding="utf-8") if l.strip()]


def write_journal(rows):
    with open(JOURNAL, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def norm(s):
    return re.sub(r"\s+", " ", s.strip().lower())


def claim(owner, task, subject, flow=None):
    if task not in owner:
        sys.exit(f"no agent owns {task!r} — ask team-manager (team.py who ...)")
    rows = journal()
    for r in rows:
        if r["status"] == "open" and r["task"] == task and norm(r["subject"]) == norm(subject):
            sys.exit(f"ALREADY OPEN: {r['id']} · {task} · {r['subject']} · {r['agent']} — continue that job, do not start a second one")
    jid = f"J{len(rows) + 1:04d}"
    rows.append({"id": jid, "task": task, "agent": owner[task], "subject": subject, "flow": flow,
                 "status": "open", "opened": dt.date.today().isoformat(), "closed": None, "output": None})
    write_journal(rows)
    print(f"{jid} · {task} -> {owner[task]} · {subject}")


def close(jid, status, note):
    rows = journal()
    for r in rows:
        if r["id"] == jid:
            if r["status"] != "open":
                sys.exit(f"{jid} is already {r['status']}")
            r.update(status=status, closed=dt.date.today().isoformat(), output=note)
            write_journal(rows)
            print(f"{jid} {status}")
            return
    sys.exit(f"no job {jid}")


def board():
    rows = [r for r in journal() if r["status"] == "open"]
    if not rows:
        print("no open jobs")
    for r in rows:
        print(f"{r['id']}  {r['opened']}  {r['task']:24s} {r['agent']:18s} {r['subject']}" + (f"  [{r['flow']}]" if r["flow"] else ""))


# ------------------------------------------------------------------ views
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
        print(f"{score:3d}  {name:18s} {a['role']}  ->  {', '.join(a['owns'])}")
    if not hits:
        print("nobody matches: a new agent may be needed (team-manager)")


def flow(flows, owner, name):
    if name not in flows:
        sys.exit(f"flows: {', '.join(flows)}")
    fl = flows[name]
    print(f"{fl['name']}  ·  trigger: {fl['trigger']}")
    for i, kind, v in steps_of(fl):
        print(f"  {i:2d}. ⛔ GATE  {v}" if kind == "gate" else f"  {i:2d}. {v:24s} -> {owner[v]}")


def table(reg, flows, owner):
    A, D = reg["agents"], reg["departments"]
    L = ["# الإمبراطورية — سجل الوكلاء", "",
         "> ملف مولَّد — ما تعدّلوش باليد. المصدر: `registry.yaml` · `flows.yaml` · `journal.jsonl` → `python3 .claude/team/team.py table`", "",
         "كل مهمة عندها **مولى واحد** · كل وكيل يقرا `LESSONS.md` · كل خدمة تتسجل في السجل اليومي مرة وحدة.", "",
         "## الهيكل", "", "```mermaid", "flowchart TB", '  chief(["القيادة · chief"])']
    for d, v in D.items():
        if d == "hq":
            continue
        L.append(f'  chief --> {d}["{v["name"]} · {v["lead"]}"]')
    for n, a in A.items():
        parent = "chief" if a["dept"] == "hq" else a["dept"]
        if n != D[a["dept"]]["lead"]:
            L.append(f'  {parent} --- {n.replace("-", "_")}("{n}")')
    L.append("  %% روابط الخدمة (feeds)")
    for n, a in A.items():
        for f in a.get("feeds") or []:
            src = a["dept"] if n == D[a["dept"]]["lead"] else n.replace("-", "_")
            dst = A[f]["dept"] if f == D[A[f]["dept"]]["lead"] else f.replace("-", "_")
            if src != dst:
                L.append(f"  {src} -.-> {dst}")
    L += ["```", ""]
    for d, v in D.items():
        members = [(n, a) for n, a in A.items() if a["dept"] == d]
        L += [f"## {v['name']} — القائد: `{v['lead']}`", "", f"_{v['mission']}_", "",
              "| الوكيل | الدور | يملك | يعطي خدمتو لـ | ما يديرش (مولاها) | تزاد · علاش |", "|---|---|---|---|---|---|"]
        for n, a in members:
            nv = ", ".join(f"{k}→{w}" for k, w in (a.get("never") or {}).items()) or "—"
            fd = ", ".join(a.get("feeds") or []) or "—"
            L.append(f"| `{n}` | {a['role']} | {', '.join(f'`{k}`' for k in a['owns'])} | {fd} | {nv} | {a['added']} · {a['why']} |")
        L.append("")
    L += ["## التدفقات (كيفاش يتربطو)", ""]
    for fn, fl in flows.items():
        L += [f"### `{fn}` — {fl['name']}", f"يبدا كي: {fl['trigger']}", ""]
        for i, kind, val in steps_of(fl):
            L.append(f"{i}. ⛔ **توقف:** {val}" if kind == "gate" else f"{i}. `{val}` → `{owner[val]}`")
        L.append("")
    L += ["## فهرس المهام", "", "| المهمة | المولى |", "|---|---|"] + [f"| `{k}` | `{v}` |" for k, v in sorted(owner.items())]
    open_rows = [r for r in journal() if r["status"] == "open"]
    L += ["", "## الخدمات المفتوحة", ""]
    L += [f"- `{r['id']}` {r['opened']} · `{r['task']}` → `{r['agent']}` · {r['subject']}" for r in open_rows] or ["_ما كاين حتى خدمة مفتوحة._"]
    open(os.path.join(HERE, "TEAM.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    print("wrote .claude/team/TEAM.md")


def main():
    av = sys.argv[1:]
    cmd = av[0] if av else "check"
    reg, flows, files = load()
    errs, owner = check(reg, flows, files)
    if cmd == "who":
        return who(reg, files, av[1:])
    if cmd == "flow":
        return flow(flows, owner, av[1] if len(av) > 1 else "")
    if cmd == "claim":
        fl = av[av.index("--flow") + 1] if "--flow" in av else None
        return claim(owner, av[1], av[2], fl)
    if cmd in ("done", "drop"):
        return close(av[1], "done" if cmd == "done" else "dropped", av[2] if len(av) > 2 else None)
    if cmd == "board":
        return board()
    for e in errs:
        print("ERROR", e)
    if errs:
        sys.exit(1)
    print(f"ok: {len(reg['departments'])} departments, {len(reg['agents'])} agents, {len(owner)} tasks, {len(flows)} flows — no task has two owners")
    if cmd == "table":
        table(reg, flows, owner)


if __name__ == "__main__":
    main()
