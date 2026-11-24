#!/usr/bin/env python3
"""Seventeenth round: why each eligible old test is not yet movable.
Usage: ported-blockers.py JEST_JSON [PLAYWRIGHT_JSON]   (jest --json --outputFile; playwright --reporter=json)
Reads the `// SKIPPED (X): reason` comments above each skip in the ported sources, maps reason keywords to a dependency
(first applicable in ORDER), prints the table and writes e2e/ported-blockers.csv."""
import json, re, sys, os, csv, collections, glob, io
open = lambda p, m="r", **k: io.open(p, m, encoding="utf-8", **k)
HERE = os.path.dirname(os.path.abspath(__file__)); PKG = os.path.dirname(HERE)
ORDER = [
 ("TOPLEVEL-TYPING", r"quarantine|top level|top-level|typeChar|pasteAtCursor|type at the top|paste at the top|typing and pasting"),
 ("MODE-TOGGLE", r"mode toggle|text mode|blocks mode|morph|toggle|setBlockMode|lifecycle|onBlockMode|text/blocks|switches? (once|to)|mode button"),
 ("DEFERRED-TOOLBAR", r"toolbar|primitive|\.Primitive|search box|search table"),
 ("WHITESPACE-DROP", r"whitespace|non-value|drop target|dropped on|drop onto|drop on|a drop|drag"),
 ("EDIT-BOX-DOM", r"contenteditable|edit box|the box|input/textarea|innerHTML|textContent"),
 ("COMMENT-AS-BLOCK", r"comment"),
 ("SPOKEN-LABELS", r"label|spoken|describe|announce|aria-label|shortDescription|node api|words"),
 ("SUMMARY-ERROR", r"summary|error notice|error flag|unparse|does not parse|parse error|rejects|refuses"),
 ("FOCUS-RULE", r"focus|activedescendent"),
]
def dep_of(text):
    hits = [d for d, rx in ORDER if re.search(rx, text, re.I)]
    return (hits[0] if hits else "UNDOCUMENTED" if re.search(r"\(U\)", text) else "OTHER"), hits[1:]
def classify(cls, reason):
    t = reason
    if cls in ("N", "I", "D"): return "EXCLUDED-" + cls, []
    if cls == "Q": return ("DEFERRED-TOOLBAR" if re.search(r"toolbar", reason, re.I) else "DESIGN-QUESTION"), []
    d, rest = dep_of(t)
    if d == "OTHER" and cls == "U": d = "UNDOCUMENTED"
    return d, rest
rows = []
def skip_index(path):
    """[(title chunks, class, reason)] from `// SKIPPED (C): reason` followed by a skip line."""
    out = []; lines = open(path).read().split("\n"); pend = None
    for i, l in enumerate(lines):
        m = re.search(r"//\s*SKIPPED \((\w)\)[^:]*:\s*(.*)", l)
        if m: pend = (m.group(1), m.group(2)); continue
        if re.search(r"\.(skip|fixme)\b", l):
            tm = re.search(r"""(?:skip|fixme)(?:\.each\([^)]*\))?\(\s*(["'`])(.*?)\1""", l)
            title = tm.group(2) if tm else ""
            chunks = [c.strip() for c in re.split(r"%\w|\$\{[^}]*\}", title) if c.strip()]
            out.append((chunks, *(pend or ("?", "")), l.strip()[:80]))
        if l.strip() and not l.strip().startswith("//") and not re.search(r"\.(skip|fixme)\b", l): pend = pend if i and re.search(r"^\s*(it|test)", l) else None
    return out
def match(idx, title):
    best = None
    for chunks, c, r, l in idx:
        if chunks and all(ch in title for ch in chunks[:2]) : best = best or (c, r)
        if chunks and chunks[0] and title.startswith(chunks[0]) : return (c, r)
    return best
jest = json.load(open(sys.argv[1])); stat = collections.Counter(); passed = collections.Counter()
for f in jest["testResults"]:
    name = os.path.relpath(f["name"], PKG); src = skip_index(f["name"])
    # file-level variant skip reason (undo-matrix)
    filedefault = next(((c, r) for ch, c, r, l in src if c != "?"), ("?", ""))
    for t in f["assertionResults"]:
        if t["status"] == "passed": passed[("jest")] += 1; continue
        if t["status"] != "pending": continue
        title = t["title"]; m = match(src, title)
        if "undo-matrix" in name and re.search(r"top level", t["fullName"]): m = ("M", "typing and pasting at the top level (no quarantine)")
        elif "undo-matrix" in name and re.search(r"onto whitespace", t["fullName"]): m = ("M", "a drop onto bare whitespace (not built)")
        m = m or filedefault; d, rest = classify(*m)
        rows.append((t["fullName"], name, d, f"({m[0]}) {m[1][:160]}" + (f" | also: {','.join(rest)}" if rest else ""), "jest"))
if len(sys.argv) > 2:
    pw = json.load(open(sys.argv[2]))
    def walk(s, f, path):
        for sub in s.get("suites", []): walk(sub, f, path + ([sub["title"]] if sub["title"] and not sub["title"].endswith((".ts",)) else []))
        for sp in s.get("specs", []):
            for t in sp["tests"]:
                st = t.get("status"); res = t.get("results", [{}])
                full = " › ".join(path + [sp["title"]])
                if st == "skipped":
                    ann = " ".join((a.get("description") or "") for a in t.get("annotations", []))
                    m = re.match(r"\s*([A-Z])\s*:\s*(.*)", ann); cls, why = (m.group(1), m.group(2)) if m else ("?", ann)
                    d, rest = classify(cls, why)
                    rows.append((full, f, d, f"({cls}) {why[:160]}" + (f" | also: {','.join(rest)}" if rest else ""), "pw"))
                elif st in ("expected",): passed["pw"] += 1
                else: stat["pw-" + str(st)] += 1; print("PW NOT PASSING:", st, f, full, (res[-1].get("error", {}).get("message", "") or "").split("\n")[0][:150])
    for s in pw["suites"]: walk(s, s["title"], [])
with open(os.path.join(PKG, "e2e/ported-blockers.csv"), "w", newline="") as fh:
    w = csv.writer(fh); w.writerow(["test", "file", "dependency", "detail", "runner"]); w.writerows(rows)
tab = collections.defaultdict(lambda: [0, 0, set()])
for r in rows: tab[r[2]][0 if r[4] == "jest" else 1] += 1; tab[r[2]][2].add(os.path.basename(r[1]))
print("passed:", dict(passed), dict(stat))
print("dependency | jest | pw | total | files")
for d, (a, b, fs) in sorted(tab.items(), key=lambda x: -(x[1][0] + x[1][1])): print(f"{d} | {a} | {b} | {a+b} | {', '.join(sorted(fs))[:150]}")
print("total skipped:", len(rows))
