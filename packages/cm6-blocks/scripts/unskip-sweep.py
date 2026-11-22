#!/usr/bin/env python3
"""Sweep of the skip markers in spec/ported and e2e/ported (nineteenth round).

  unskip-sweep.py unskip STATE_DIR
      saves every file under STATE_DIR/orig, removes every skip marker (it.skip,
      describe.skip, test.fixme, FIXME sets, SKIPPED_VARIANTS), records each in
      STATE_DIR/items.json (file, kind, title, reason).
  unskip-sweep.py reskip STATE_DIR JEST_JSON [PLAYWRIGHT_JSON]
      restores the originals, then removes only the markers whose tests passed;
      a marker whose test failed stays, with a comment `// first error: ...`.
  (run jest with --json --testLocationInResults, Playwright with --reporter=json)
"""
import io, json, os, re, sys, glob


def open(p, mode="r"):  # always UTF-8
    return io.open(p, mode, encoding="utf8")


ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
JEST_FILES = glob.glob(ROOT + "/spec/ported/**/*.ts*", recursive=True)
E2E_FILES = glob.glob(ROOT + "/e2e/ported/*.ts")
JEST_RE = re.compile(r"\b(it|test|describe)\.skip(\.each)?\(")
TITLE_RE = re.compile(r"""\(\s*(?:\[[^\]]*\]\s*\)\s*\(\s*)?(["'`])(.*?)\1""")


def reason_above(lines, i):
    out = []
    j = i - 1
    while j >= 0 and (lines[j].strip().startswith("//") or not lines[j].strip()):
        if lines[j].strip().startswith("//"):
            out.insert(0, lines[j].strip())
        j -= 1
        if len(out) >= 3:
            break
    return " ".join(out)


def jest_items(path, text):
    lines = text.split("\n")
    items = []
    for i, ln in enumerate(lines):
        m = JEST_RE.search(ln)
        if m:
            t = TITLE_RE.search(ln[m.end() - 1 :]) or TITLE_RE.search(lines[i + 1] if i + 1 < len(lines) else "")
            items.append(dict(file=path, line=i + 1, kind=m.group(1) + ".skip", title=t.group(2) if t else "?", reason=reason_above(lines, i)))
        if "SKIPPED_VARIANTS = " in ln:
            items.append(dict(file=path, line=i + 1, kind="SKIPPED_VARIANTS", title=ln.strip(), reason=reason_above(lines, i)))
    return items


def e2e_items(path, text):
    lines = text.split("\n")
    items = []
    for m in re.finditer(r"test\.fixme\(\s*true,", text):
        ln = text[: m.start()].count("\n") + 1
        items.append(dict(file=path, line=ln, kind="fixme-file", title="(whole file)", reason=re.sub(r"\s+", " ", text[m.start() : m.start() + 300])))
    for m in re.finditer(r'test\.fixme\(\s*"([^"]+)"', text):
        ln = text[: m.start()].count("\n") + 1
        items.append(dict(file=path, line=ln, kind="fixme-test", title=m.group(1), reason=reason_above(lines, ln - 1)))
    b = re.search(r"// FIXME-BEGIN(.*)\n", text)
    s = re.search(r"new Set<string>\(\[(.*?)\]\);", text, re.S)
    if b and s:
        for e in re.finditer(r'"((?:[^"\\]|\\.)*)"', s.group(1)):
            items.append(dict(file=path, line=0, kind="fixme-set", title=e.group(1), reason=b.group(1).strip()))
    return items


def rel(p):
    return os.path.relpath(p, ROOT)


def cmd_unskip(state):
    os.makedirs(state + "/orig", exist_ok=True)
    # ONLYJEST=1: only the jest files; the items of the Playwright files already in items.json are kept
    only = bool(os.environ.get("ONLYJEST"))
    allitems = [i for i in json.load(open(state + "/items.json")) if not i["file"].startswith("spec/")] if only else []
    for p in JEST_FILES + ([] if only else E2E_FILES):
        t = open(p).read()
        its = jest_items(rel(p), t) if p in JEST_FILES else e2e_items(rel(p), t)
        if not its:
            continue
        allitems += its
        os.makedirs(os.path.dirname(state + "/orig/" + rel(p)), exist_ok=True)
        open(state + "/orig/" + rel(p), "w").write(t)
        open(p, "w").write(apply(t, p in JEST_FILES, lambda it: False, its, drop=False))
    json.dump(allitems, open(state + "/items.json", "w"), indent=1)
    print(len(allitems), "skip markers removed")


def apply(text, is_jest, stays, items, drop=True):
    """Remove each marker unless stays(item). Returns new text."""
    lines = text.split("\n")
    drop_comment = set()
    if is_jest:
        for it in items:
            i = it["line"] - 1
            if stays(it):
                continue
            if it["kind"] == "SKIPPED_VARIANTS":
                lines[i] = re.sub(r"= /.*/;", "= /(?!x)x/;", lines[i])
            else:
                lines[i] = JEST_RE.sub(lambda m: m.group(1) + (m.group(2) or "") + "(", lines[i], count=1)
            drop_comment.add(i)
        out = "\n".join(lines)
    else:
        out = text
        for it in items:
            if stays(it):
                continue
            if it["kind"] == "fixme-file":
                out = re.sub(r"test\.fixme\(\s*true,", "test.fixme(false,", out, count=1)
            elif it["kind"] == "fixme-test":
                out = out.replace('test.fixme("%s"' % it["title"], 'test("%s"' % it["title"], 1)
        # sets: keep only entries that stay
        kept = [it["title"] for it in items if it["kind"] == "fixme-set" and stays(it)]
        has_set = any(it["kind"] == "fixme-set" for it in items)
        if has_set:
            if not kept:
                out = re.sub(r"// FIXME-BEGIN.*?// FIXME-END\n", "", out, flags=re.S)
            else:
                body = "".join('  "%s",\n' % k for k in kept)
                out = re.sub(r"(new Set<string>\(\[)(.*?)(\]\);)", lambda m: m.group(1) + "\n" + body + m.group(3), out, count=1, flags=re.S)
        return out
    # drop stale "// SKIPPED ..." comment lines above removed jest markers (not while sweeping: the lines must stay where they are)
    if not drop:
        return "\n".join(lines)
    res = []
    for i, ln in enumerate(lines):
        res.append((i, ln))
    final = []
    for i, ln in res:
        final.append(ln)
    out_lines = []
    skip_idx = set()
    for i in drop_comment:
        j = i - 1
        while j >= 0 and lines[j].strip() == "":
            j -= 1
        if j >= 0 and re.match(r"\s*// SKIPPED", lines[j]):
            skip_idx.add(j)
            if j + 1 < len(lines) and lines[j + 1].strip() == "":
                skip_idx.add(j + 1)
    return "\n".join(l for i, l in enumerate(lines) if i not in skip_idx)


def clean(s):
    return re.sub(r"\x1b\[[0-9;]*m", "", s)


def failures_jest(path):
    d = json.load(open(path))
    fails = []
    for f in d["testResults"]:
        for a in f["assertionResults"]:
            if a["status"] == "failed":
                msg = (a.get("failureMessages") or [""])[0].strip().split("\n")
                fails.append(dict(file=os.path.relpath(f["name"], ROOT), line=(a.get("location") or {}).get("line"), ancestors=a["ancestorTitles"], title=a["title"], err=clean(msg[0])[:200]))
        if f["status"] == "failed" and not f["assertionResults"]:
            fails.append(dict(file=os.path.relpath(f["name"], ROOT), line=None, ancestors=[], title="(suite)", err=(f.get("message") or "").strip().split("\n")[0][:200]))
    return fails


def failures_pw(path):
    d = json.load(open(path))
    fails = []

    def walk(s, titles, file):
        for sp in s.get("specs", []):
            for t in sp["tests"]:
                if t["status"] in ("unexpected", "flaky"):
                    r = t["results"][-1]
                    err = ((r.get("error") or {}).get("message") or "").strip().split("\n")[0][:200]
                    fails.append(dict(file="e2e/" + sp["file"] if not sp["file"].startswith("e2e") else sp["file"], line=sp["line"], titlepath=" › ".join(titles + [sp["title"]]), title=sp["title"], err=err))
        for c in s.get("suites", []):
            walk(c, titles + ([c["title"]] if c["title"] != s["title"] and not c["title"].endswith(".ts") else []), file)

    for s in d["suites"]:
        walk(s, [], s["title"])
    return fails


def cmd_reskip(state, jest_json, pw_json):
    items = json.load(open(state + "/items.json"))
    jf = failures_jest(jest_json) if jest_json and os.path.exists(jest_json) else []
    pf = failures_pw(pw_json) if pw_json and os.path.exists(pw_json) else []
    byfile = {}
    for it in items:
        byfile.setdefault(it["file"], []).append(it)
    stale = 0
    kept = 0
    report = []
    for f, its in byfile.items():
        orig = open(state + "/orig/" + f).read()
        is_jest = f.startswith("spec/")
        fail_here = [x for x in jf + pf if x["file"].replace("e2e/e2e/", "e2e/") == f or x["file"].endswith(f.split("/")[-1]) and x["file"].split("/")[0] == f.split("/")[0]]
        for it in its:
            err = None
            for x in fail_here:
                if is_jest:
                    if it["kind"] == "SKIPPED_VARIANTS":
                        if "onto whitespace" in " ".join(x["ancestors"]):
                            err = x["err"]
                    elif it["kind"] == "describe.skip":
                        if it["title"] in x["ancestors"]:
                            err = x["err"]
                    elif x["line"] == it["line"]:
                        err = x["err"]
                else:
                    if it["kind"] == "fixme-file":
                        err = x["err"]
                    elif it["kind"] == "fixme-test":
                        if x["title"] == it["title"]:
                            err = x["err"]
                    elif it["kind"] == "fixme-set":
                        if x["titlepath"] == it["title"]:
                            err = x["err"]
                if err:
                    break
            it["err"] = err
            if err:
                kept += 1
            else:
                stale += 1
            report.append(it)
        text = apply(orig, is_jest, lambda it: it.get("err") is not None, its)
        if is_jest:
            # add a first-error comment above each marker that stays
            lines = text.split("\n")
            # lines shifted by removed comments: locate by marker text instead
            for it in its:
                if it.get("err") and it["kind"] != "SKIPPED_VARIANTS":
                    pass
        else:
            notes = [it for it in its if it.get("err")]
            if notes:
                text = text.rstrip("\n") + "\n" + "".join("// first error (sweep): %s => %s\n" % (it["title"], it["err"].replace("\n", " ")) for it in notes)
        open(ROOT + "/" + f, "w").write(text)
    # jest: write first-error comments directly above markers that stay
    for f, its in byfile.items():
        if not f.startswith("spec/"):
            continue
        p = ROOT + "/" + f
        lines = open(p).read().split("\n")
        for it in its:
            if not it.get("err"):
                continue
            pat = JEST_RE
            for i, ln in enumerate(lines):
                if pat.search(ln) and (it["title"] in ln or it["title"] in (lines[i + 1] if i + 1 < len(lines) else "") or it["title"] == "?") and not ln.strip().startswith("// first"):
                    if i > 0 and lines[i - 1].strip().startswith("// first error"):
                        continue
                    lines.insert(i, "  // first error (sweep): " + it["err"].replace("\n", " "))
                    break
        open(p, "w").write("\n".join(lines))
    json.dump(report, open(state + "/report.json", "w"), indent=1)
    print("stale (un-skipped, passing):", stale, " kept skipped:", kept)


if __name__ == "__main__":
    a = sys.argv
    if a[1] == "unskip":
        cmd_unskip(a[2])
    else:
        cmd_reskip(a[2], a[3], a[4] if len(a) > 4 else None)
