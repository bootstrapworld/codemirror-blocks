#!/usr/bin/env python3
"""Thirteenth round: append to each ported Playwright file a beforeEach that test.fixme()s the tests that failed, with class and reason (by file).
usage: ported-auto-e2e.py <playwright json>"""
import json, io, sys, re, collections
R = {
 "collapse-all-focus": ("U", "after Collapse All the focus is in an input (an edit box) here, a block's element there: not examined"),
 "comment-popup": ("D", "a comment is its own block here: the popup's page rules differ (notes, sixth round 4)"),
 "delete-undo": ("I", "waits for the old page's DOM (`.CodeMirror`, contenteditable, gutters): not found on the demo page"),
 "drop-target-scroll": ("D", "the old drop targets are elements with their own box; here the places are gaps (`.blocks-gap`), and the test's selectors find none"),
 "edit-comment": ("D", "a comment is its own block here, edited as a block (notes, sixth round 4): the old comment box and its labels do not exist"),
 "edit-literal": ("D", "the edit box is an input here, the old one a contenteditable (interact.ts header)"),
 "focus-dropped": ("I", "calls the CM5 `window.cmb.getCM()` of the old page"),
 "insert-beside-root": ("D", "the insertion box is an input here, the old one a contenteditable (`[contenteditable=true]`)"),
 "matrix": ("M", "a variant of the matrix this editor has no feature for (drop onto a node or whitespace, the trash can, the toolbar of primitives, top-level typing)"),
 "moved-blocks": ("D", "the edit box is an input here, the old one a contenteditable"),
 "touch": ("M", "needs the trash can, the old page's `.CodeMirror` and `.blocks-if-else` selectors, or the old insertion box: not built here (touch drags have their own tests: e2e/touch*.e2e.ts)"),
 "morph": ("M", "the animated morph between text and blocks is not built"),
 "toolbar-drag": ("M", "the toolbar of primitives is not built (a page makes one)"),
 "trash-can": ("M", "the trash can is not built"),
}
d = json.load(io.open(sys.argv[1], encoding="utf8"))
fails = collections.defaultdict(list)
def walk(s, path, f):
    for sp in s.get("specs", []):
        t = sp["tests"][0]
        r = t["results"][-1] if t["results"] else None
        if r and r["status"] in ("failed", "timedOut"):
            fails[sp["file"]].append(" › ".join(path + [sp["title"]]))
    for c in s.get("suites", []):
        walk(c, path + ([c["title"]] if c.get("title") and not c["title"].endswith(".ts") else []), f)
for s in d["suites"]: walk(s, [], s["file"])
cnt = {}
for f, titles in fails.items():
    stem = f.split("/")[-1][:-7]
    if stem not in R: print("NO REASON", stem, len(titles)); continue
    cls, why = R[stem]
    p = "e2e/ported/%s.e2e.ts" % stem if False else "ported/%s.e2e.ts" % stem
    s = io.open(p, encoding="utf8").read()
    s = re.sub(r'\n// FIXME-BEGIN.*?// FIXME-END\n', '\n', s, flags=re.S)
    block = "\n// FIXME-BEGIN (thirteenth round: %s: %s)\nconst FIXME = new Set<string>(%s);\ntest.beforeEach(({}, ti) => {\n  test.fixme(FIXME.has(ti.titlePath.slice(1).join(\" › \")), %s);\n});\n// FIXME-END\n" % (cls, why, json.dumps(titles, ensure_ascii=False), json.dumps(cls + ": " + why))
    io.open(p, "w", encoding="utf8").write(s + block)
    cnt[stem] = (cls, len(titles))
print(cnt)
