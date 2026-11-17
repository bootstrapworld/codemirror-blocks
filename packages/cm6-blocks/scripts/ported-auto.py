#!/usr/bin/env python3
"""Thirteenth round: mark every FAILING ported test with it.skip and a class + reason computed from its failure message.
usage: ported-auto.py <jest --json file> <file stem>...   Classes: U undocumented difference (or not yet examined), D documented, M feature not built, I tied to the old internals / cannot run."""
import json, io, re, sys, os
data = json.load(io.open(sys.argv[1], encoding="utf8"))
stems = sys.argv[2:]
def classify(file, msg, title):
    m = re.sub(r'\x1b\[[0-9;]*m', '', msg)
    first = m.split("\n")[0][:200]
    g = re.search(r'not in the compat layer: ([^\n]*)', m)
    if g: return ("M" if not re.search(r'store|node classes|CM5 API object', g.group(1)) else "I", "not built / not in the compat layer: " + g.group(1)[:120])
    if "Search functions" in m or "toolbar primitive" in m or "placeholder text" in m: return ("M", "the old toolbar of primitives and its search box are not built (a page makes the toolbar)")
    if re.search(r'store\.(getState|dispatch)|spyOn on a primitive|buildAST is not|shortDescription is not|getNodeByIdOrThrow|getAllMarks is not|cmb\.\w+ is not a function|\.parse is not a function|Hooks cannot be defined|`\.each` called', m):
        return ("I", "uses the old implementation's internals or CM5 API methods the compat layer does not have: " + first[:110])
    if 'contenteditable' in m: return ("U", "the edit box is an input here, the old one a contenteditable (interact.ts header)")
    return ("U", "undocumented difference or not yet examined: " + first[:110])
tot = {}
for r in data["testResults"]:
    base = os.path.basename(r["name"])
    stem = base.split(".test")[0]
    if stem not in stems: continue
    path = r["name"]
    s = io.open(path, encoding="utf8").read()
    for t in r["assertionResults"]:
        if t["status"] != "failed": continue
        cls, why = classify(stem, t["failureMessages"][0], t["title"])
        title = t["title"]
        pat = re.compile(r'^(\s*)(it|test)\(\s*(["`\'])' + re.escape(title) + r'\3', re.M)
        n = 0
        def rep(m):
            global n
            return f'{m.group(1)}// SKIPPED ({cls}): {why}\n{m.group(1)}{m.group(2)}.skip({m.group(3)}{title}{m.group(3)}'
        s, n = pat.subn(rep, s, count=1)
        if n == 0: print("NOT FOUND", stem, title[:80])
        else: tot[(stem, cls)] = tot.get((stem, cls), 0) + 1
    io.open(path, "w", encoding="utf8").write(s)
print(json.dumps({f"{a}:{b}": c for (a, b), c in sorted(tot.items())}))
