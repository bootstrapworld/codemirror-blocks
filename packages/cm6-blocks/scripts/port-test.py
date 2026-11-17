#!/usr/bin/env python3
"""Copy an old spec into spec/ported/ changing ONLY its imports to the compat layer (ninth round). usage: port-test.py <old spec path>"""
import re, sys, os
src = sys.argv[1]
name = os.path.basename(src)
s = open(src).read()
rules = [
  (r'"@bootstrapworld/wescheme"', '"../compat/wescheme"'),
  (r'"@testing-library/react"', '"../compat/testing-library"'),
  (r'"\.\./src/toolkit/test-utils"', '"../compat/test-utils"'),
  (r'"\.\./src/CodeMirrorBlocks"', '"../compat/test-utils"'),
  (r'"\.\./src/ast"', '"../compat/test-utils"'),
  (r'"\./helpers/(gestures|dnd|editing|clipboard)"', r'"../compat/\1"'),
  (r'"\.\./\.\./src/toolkit/test-utils"', '"../compat/test-utils"'),
  (r'"\.\./src/announcer"', '"../compat/announcer"'),
  (r'"\.\./src/utils"', '"../compat/utils"'),
  (r'"\.\./src/ui/searchers/ByBlock"', '"../compat/ByBlock"'),
  (r'"\.\./src/state/actions"', '"../compat/actions"'),
  (r'"\./globalSetup"', '"../compat/global-setup"'),
  # thirteenth round: the old internals a test imports by name get stubs that throw when used (compat/internals.ts)
  (r'import "codemirror/addon/search/searchcursor.js";\n', ''),
  (r'import "@bootstrapworld/example";\n', ''),
  (r'"@bootstrapworld/lambda"', '"../compat/wescheme"'),
  (r'from "codemirror"', 'from "../compat/codemirror"'),
  (r'"\.\./src/state/store"', '"../compat/internals"'),
  (r'"\.\./src/nodes"', '"../compat/internals"'),
  (r'"\.\./src/summary"', '"../compat/internals"'),
  (r'"\.\./src/editor"', '"../compat/internals"'),
  (r'"\.\./src/CodeMirror-api"', '"../compat/internals"'),
  (r'"\.\./src/state/activityLog"', '"../compat/internals"'),
]
s = re.sub(r'import CodeMirrorBlocks, \{ Languages \} from "\.\./src/CodeMirrorBlocks"', 'import CodeMirrorBlocks, { Languages } from "../compat/internals"', s)
for a, b in rules:
    s = re.sub(a, b, s)
header = "// PORTED from packages/codemirror-blocks/spec/%s: only the imports changed (to ../compat/*); see doc/experiments/cm6-direct-tree.md, ninth round.\n" % name
dst = os.path.join(os.path.dirname(__file__), "..", "spec", os.environ.get("PORT_DIR", "ported"), name.replace("-test.", ".test."))
open(dst, "w").write("/** @jest-environment jsdom */\n// @ts-nocheck\n" + header + s)
print(dst)
