#!/usr/bin/env python3
"""unskip-one.py FILE TITLE...  : remove the skip marker (and its SKIPPED / first-error comments) of the tests with these titles (prefix match)."""
import io, re, sys
p = sys.argv[1]
s = io.open(p, encoding="utf8").read()
for t in sys.argv[2:]:
    pat = re.compile(r"((?:  )*// SKIPPED[^\n]*\n\n)?((?:  )*// first error \(sweep\)[^\n]*\n)?((?:  )*)(it|test|describe)\.skip(\.each\([^)]*\))?\((\s*)([\"'`])" + re.escape(t))
    s, n = pat.subn(lambda m: m.group(3) + m.group(4) + (m.group(5) or "") + "(" + m.group(6) + m.group(7) + t, s, count=1)
    print(n, t)
io.open(p, "w", encoding="utf8").write(s)
