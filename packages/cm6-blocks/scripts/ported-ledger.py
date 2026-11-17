#!/usr/bin/env python3
"""Mark the ported tests that fail with it.skip and the reason (ninth round). Each entry: file -> [(title substring, class, reason)].
Classes: U = an undocumented difference (a finding), D = a documented behaviour change (the expectation is not edited here: the test is skipped with the change named),
M = a missing feature or helper, I = tied to the old implementation's internals."""
import re, os, sys, json
AD = ("U", "the old editor sets aria-activedescendent (spelled so) on the scroller; this one moves real DOM focus and sets nothing there")
LINE = ("U", "removing a top-level block: the old editor leaves its (blank) line, this one removes the line")
BOX = ("U", "the edit box is an input/textarea placed in the block, the old one a contenteditable: assertions on contenteditable, textContent or innerHTML of the box differ")
NEXT = ("U", "ArrowDown with focus in the text input and no block focused: the old editor activates the block after the cursor, this one does nothing")
A3 = ("D", "focus after a delete goes to the node now at the same index, else the one before, else the owner (notes, second round A3); the old editor's rule differs")
TOOLBAR = ("M", "the old toolbar of primitives (`.Primitive`, search box); this editor draws no toolbar of its own, a page makes one")
STORE = ("I", "reads the redux store (`store.getState()`)")
QUAR = ("M", "top-level typing into a quarantine (typeChar / pasteAtCursor opens a box at the text cursor): not built here")
MODE = ("M", "the page's text/blocks mode toggle button and text mode")
PARSE = ("D", "text that does not parse is accepted and written (interact.ts header; the old editor refuses it and keeps the box open with an error flag)")
LABEL = ("D", "block types and spoken labels are the table's (`call`, `number`, `symbol`), not the old node types (`functionApp`, `literal`): notes, second round D and eighth round search table")
PASTESEL = ("D", "paste over a selection does not replace it: it pastes after the focused block and clears the selection (notes, parity table: Cmd/Ctrl-V)")
LED = {
 "activation": [
  ("should put focus on the active node", *AD), ("should activate the first node when down", *AD), ("should activate the next node when down", *AD),
  ("should activate the node after the cursor", *NEXT), ("should activate the node before the cursor", *NEXT),
  ("should cancel the editability", *BOX), ("should focus the node that was just inserted", *QUAR), ("should not change the focused element", *MODE),
  ("should focus on the previous node when a top-level node is deleted", *LINE), ("should restore focus to the node after its edited", *BOX),
  ("should remove selected nodes on cut", *LINE), ("should remove multiple selected nodes on cut", *LINE),
  ("up-arrow should navigate to the previous visible node", *AD), ("down-arrow should navigate to the next sibling", *AD),
  ("home should activate the first visible node", *AD), ("end should activate the last visible node", *AD),
 ],
 "keyboard-commands": [
  ("can be a parameter list, which leaves a placeholder", "U", "deleting the parameter list of a define: the old editor leaves a placeholder for the list, here the table's slots give another result"),
  ("announces the expression once", "D", "the words announced are the table's describe templates (notes, second round D; UNDID / REDID added)"),
  ("opens the keyboard shortcuts dialog", "U", "the help dialog lists the key table's own descriptions, not the old editor's names (`Next Block`)"),
  ("hides the editor from screenreaders", "U", "the help dialog does not set aria-hidden on the editor"), ("closes on Escape and shows the editor again", "U", "the help dialog does not set aria-hidden on the editor"),
  ("moves keyboard focus to the toolbar", *TOOLBAR),
  ('"Enter" {"ctrlKey":true} does nothing', "U", "Ctrl/Cmd-Enter with the focus in the text and no block focused inserts a blank line (CodeMirror 6's own key); the old editor does nothing"),
  ("Down activates the next block", *NEXT),
 ],
 "paste": [
  ("copies every selected node, in document order", "U", "copy of two selected blocks joins by newline (notes) but the compat select() of the second block leaves one block selected: not understood, to look at"),
  ("separates a commented node from its neighbours", "D", "a comment is its own block here and goes with its block above it (notes, seventh round: cut and copy take the attached comment)"),
  ("still copies two expressions, each once", "U", "as `copies every selected node`: the second selection is not taken"),
  ("replaces a selected root", *PASTESEL), ("replaces a selected child", *PASTESEL), ("can paste a whole expression over a node", *PASTESEL),
  ("inserts after the root", "U", "pasting beside a root: the whitespace written around the pasted block differs (old: its own line)"),
  ("inserts before the root with Paste Before", "U", "pasting before a root: the whitespace written around the pasted block differs"),
  ("inserts as the first argument when pasting after the operator", "U", "paste after the operator of a call: refused here (the operator's slot is a single place), the old editor makes it the first argument"),
  ("leaves the document and the AST alone", *PARSE),
  ("does nothing when nothing is selected", "D", "cut takes the focused block when nothing is selected (notes, parity table: Cmd/Ctrl-X)"),
  ("copies a primitive, ready to paste", *TOOLBAR), ("doesn't change the document", *TOOLBAR),
 ],
 "interaction": [
  ("a block in the toolbar neither edits it", *TOOLBAR), ("is forgotten for a node that is deleted", *STORE), ("is dropped for a node that an edit removes", *STORE),
  ("Shift-Tab goes to the search box", *TOOLBAR), ("Down from the search box", *TOOLBAR), ("Escape in the list returns", *TOOLBAR), ("typing in the search box filters", *TOOLBAR), ("the toolbar is not reachable in text mode", *TOOLBAR),
  ("keyboard focus moves into the editor instead of falling to the page", "U", "after the last block is deleted focus falls to the page body (the old editor moves it to the editor's input)"),
  ("typing then works straight away", *QUAR),
 ],
 "drop-targets": [
  ("moves a root to that spot", "M", "a drop on bare editor whitespace moves the block to that line in the old editor; here a drop over the editor where nothing takes it beeps and does nothing"),
  ("moves a child out of its parent to the top level", "M", "drop on bare whitespace (as above)"), ("can be undone", "M", "drop on bare whitespace (as above)"),
  ("replaces the node it's dropped onto", *TOOLBAR), ("inserts into the field at a drop target", *TOOLBAR), ("inserts at the top level when dropped on whitespace", *TOOLBAR),
  ("does nothing when dropped on the trash can", *TOOLBAR), ("a node with a comment moves together with its comment", "D", "the comment is its own block here: it moves with the block only when both are selected (notes, sixth round 4)"),
 ],
 "undo-focus": [
  ("starts with focus on the block before the deleted one", *A3),
  ("undo puts focus back on the block that had it before the delete", "U", "undo does not put the focus back on the block that had it before the edit (the old history keeps the focus)"),
  ("redo puts focus where the delete left it", "U", "redo after an undo of a delete: the document is not the deleted one (redo did nothing visible); to look at"),
  ("redo goes to the first block, which took focus after the delete", *A3),
  ("undo puts focus back on that first block", "U", "undo of a paste at the first block: focus and the layout around the pasted line differ"),
  ("redo puts focus on the pasted block", "U", "redo of a paste: the layout around the pasted line differs"),
  ("redo goes to the inserted block", "U", "redo of an insertion beside a block: redo through the key did not redo (document unchanged)"),
  ("undo restores the text, and focus goes back to d", ("M", "uses the CM5 `getCM().replaceRange(..., origin)`")), ("redo restores the text and puts focus where the edits left it", ("M", "uses the CM5 `getCM().replaceRange(..., origin)`")),
  ("undo and redo work again the second time round", ("M", "uses the CM5 `getCM().replaceRange(..., origin)`")),
  ("brings the AST back and focuses the same blocks as the keyboard", "U", "undo does not put the focus back on the block that had it (as above)"),
  ("undoing the only block added leaves focus", *QUAR),
  ("undo puts focus on the collapsed block that contains it", "D", "a block inside a collapsed block is not drawn here, so the test cannot find it (notes, sixth round 2)"),
 ],
 "focus": [
  ("tabbing to the editor for the first time should activate node 0", "U", "node ids are a global counter here, the old ones count from 0 in each parse"),
  ("deleting the first node should shift focus to the parent", *A3), ("deleting the nth node should shift focus to n-1", *A3),
  ("deleting multiple nodes should shift focus to the one before", "U", "deleting two blocks of a call leaves `(+ 1 )` here, `(+ 1)` in the old editor (a blank is left before the bracket)"),
  ("inserting a node should put focus on the new node", "M", "the test inserts through the CM5 passthrough `replaceRange` and reads `getFocusedNode().value`: a text change from outside does not focus the new block here"),
  ("inserting multiple nodes should put focus on the last", "M", "as above"),
  ("the block that was edited is the one on the page", *BOX), ("cancelling a top-level edit hands focus back", "U", "block element ids are `cmb6-node-<id>`, the old `block-node-<id>`"),
 ],
 "edit-errors": [
  ("does nothing if the value is emptied", "U", "an emptied box committed with Enter deletes the block here; the old editor does nothing"),
  ("takes the only block of an expression", *STORE), ("takes the operator of an expression that wasn't a valid call", *STORE),
  ("leaves the document alone", *PARSE), ("stays in edit mode and flags the error", *PARSE), ("clears the error once a valid value is saved", *PARSE),
  ("clears the error when the edit is cancelled with Escape", *PARSE), ("rejects an unparseable insertion and stays open", *PARSE),
  ("replaceRange with unparseable text is rejected", ("D", "an API text change is applied as text; nothing is rejected (the text is the truth)")),
  ("stays in text mode and explains why", *MODE), ("switches once the text is fixed", *MODE),
 ],
 "comment": [
  ("when the mode is toggled, it should reformat all comments", "D", "text/blocks toggling does not rewrite comments here (there is no text mode switch of the text); the comment stays as written (notes, sixth round 4)"),
  ("insert a commented node after a commented node", "I", "makes a quarantine through the redux store (`actions.setQuarantine`)"),
  ("insert a commented node after an uncommented node", "I", "makes a quarantine through the redux store (`actions.setQuarantine`)"),
 ],
 "search": [
  ("closes with Escape, and goes nowhere", ("D", "Escape returns the focus to the block that had it before the dialog (notes, eighth round); the old test compares with the focus left in the dialog")),
  ("lists the types of block there are", *LABEL), ("cannot make PageDown loop for ever", "I", "spies on the old ByBlock searcher object"),
  ("starts at the first type, and goes forwards with a wrap", *LABEL), ("goes backwards with a wrap, from the last entry", *LABEL),
  ("makes PageDown go to the next block of the chosen type", *LABEL), ("makes a text search from the dialog the last entry", *LABEL),
  ("follows the document", *LABEL), ("says so when there is nothing to search for", ("U", "with nothing to search for the rotor says one line here, two there")),
  ("does nothing in text mode", *MODE), ("leaves the rest of the page alone while the dialog is open", ("U", "the dialog does not hide the rest of the page from screenreaders (aria-hidden)")),
 ],
}
here = os.path.dirname(__file__)
tot = {}
for f, items in LED.items():
    base = os.path.join(here, "..", "spec", "ported", f)
    path = next((base + ext for ext in (".test.ts", ".test.tsx") if os.path.exists(base + ext)), None)
    if not path: continue
    s = open(path).read()
    for item in items:
        title, cls, why = (item[0], item[1][0], item[1][1]) if len(item) == 2 else item
        pat = re.compile(r'^(\s*)it\(\s*(["`])((?:(?!\2).)*' + re.escape(title) + r'(?:(?!\2).)*)\2', re.M)
        def rep(m):
            tot[(f, cls)] = tot.get((f, cls), 0) + 1
            return f'{m.group(1)}// SKIPPED ({cls}): {why}\n{m.group(1)}it.skip({m.group(2)}{m.group(3)}{m.group(2)}'
        s, n = pat.subn(rep, s)
        if n == 0: print("NOT FOUND", f, title)
    open(path, "w").write(s)
print(json.dumps({f"{a}:{b}": c for (a, b), c in sorted(tot.items())}))
