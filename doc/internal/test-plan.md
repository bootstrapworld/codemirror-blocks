# Test plan: interactions to cover

An inventory of every way a user (or the API) can change the document or the
editor state, with what the test suite covers today. It was built from the
source (`keymap.tsx`, `edits/performEdits.ts`, `state/actions.ts`, the
components, `copypaste.ts` and the API). Coverage comes from existing spec names
and keyword searches, not from reading every test body, so treat it as a first
pass and correct it as specs are written.

Legend: ✅ covered, 🟡 partial, ❌ none.

## 1. Every way the document can change

Each of these is a separate path into `performEdits`/`commitChanges`, or straight
into CodeMirror.

| #   | Entry point                                                                  | Edit used                                                                | Coverage                                          |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| 1   | Delete/Backspace on selected nodes                                           | `edit_delete` per node, root or child                                    | ✅ `keyboard-commands-test`                       |
| 2   | Cut (Ctrl/Cmd-X)                                                             | copy, then `edit_delete`                                                 | ✅ `paste-test`, `undo-matrix-test`               |
| 3   | Paste (Ctrl/Cmd-V) on a node, three cases                                    | replace selected node; overwrite beside a root; insert into parent field | ✅ `paste-test`                                   |
| 4   | Paste Before (Shift-Ctrl/Cmd-V)                                              | same three cases, before the node                                        | ✅ `paste-test`                                   |
| 5   | Edit an existing node (Enter, click, double-click, Cmd-Enter)                | `ReplaceNodeTarget`                                                      | ✅ `edit-errors-test`                             |
| 6   | Insert via Ctrl-[ / Ctrl-] into an adjacent drop target                      | `InsertTarget`                                                           | ✅ `edit-errors-test`                             |
| 7   | Type at top level (whitespace)                                               | quarantine, then `OverwriteTarget`                                       | ✅ `toplevel-input-test`                          |
| 8   | Paste at top level (text-editor paste event)                                 | quarantine with pasted text                                              | ✅ `toplevel-input-test`                          |
| 9   | Drag a node onto another node                                                | delete source plus `ReplaceNodeTarget`                                   | ✅ `drag-test`, `drop-targets-test`, `matrix.e2e` |
| 10  | Drag a node onto a drop target                                               | delete source plus `InsertTarget`                                        | ✅ `drag-test`                                    |
| 11  | Drag a node onto editor whitespace                                           | delete source plus `OverwriteTarget`                                     | ✅ `drop-targets-test`                            |
| 12  | Drag a toolbar primitive onto the same three targets                         | insert only                                                              | ✅ `drop-targets-test`                            |
| 13  | Drag a node to the trash can                                                 | `deleteASTNode`                                                          | ✅ `TrashCan-test`, `trash-can.e2e`               |
| 14  | Undo / redo                                                                  | CodeMirror history plus AST re-commit                                    | ✅ `undo-matrix-test`                             |
| 15  | Public API: `setValue`, `replaceRange`, `replaceSelection(s)`, `undo`/`redo` | direct CodeMirror changes                                                | 🟡 `api-test`                                     |
| 16  | Plain text edits in text mode, then toggling to blocks                       | `setBlockMode` re-parse                                                  | ✅ `lifecycle-test`                               |

## 2. Edit primitives (`performEdits.ts`)

| Case                                                                 | Coverage                                   |
| -------------------------------------------------------------------- | ------------------------------------------ |
| Insert, overwrite, delete and replace on a root node                 | ✅ `performEdits-test`                     |
| Insert, delete and replace on a child node                           | ✅ `performEdits-test`                     |
| Several edits grouped under one ancestor become one text change      | ✅ `performEdits-test`                     |
| Several edits at once, sorted last to first                          | ✅ `performEdits-test`                     |
| Whitespace removal around a deleted node (first, middle, last, only) | ✅ `performEdits-test`                     |
| Nodes with a leading comment, edited or deleted                      | 🟡 `comment-test`                          |
| Focus hint per edit type                                             | ✅ `focus-test`, `undo-matrix-test`        |
| Invalid result is rejected: text and AST both left unchanged         | ✅ `performEdits-test`, `edit-errors-test` |
| Required blank filled, then deleted again                            | ✅ `new-blocks-test`                       |
| `edit_insert("")` (nothing in the editor does this)                  | ✅ pinned: leaves a stray space            |

## 3. Drag-and-drop matrix

Sources: root block, child block, collapsed block, block with a comment,
multi-node selection, toolbar primitive.

Targets: another node, a drop target between children, empty-argument drop
target, editor whitespace, trash can, outside the editor.

Test each pair for the result text, the AST, focus afterwards, collapsed state
carried over, and undo. Also:

- Drop inside the source's own subtree (should do nothing).
- Drop on itself.
- Drop onto a locked (non-editable) node.
- Drag cancelled with no drop (Esc, or release elsewhere).
- Dragging while in text mode, or while a quarantine is active.
- `blocks-over-target` class on enter and leave.

Coverage: `drag-test` (node onto node and onto drop targets), `drop-targets-test`
(whitespace, toolbar, self and subtree drops, cancelled drags, comments) and
`TrashCan-test`. `edge-cases-test` covers dragging while a quarantine is open (the
typing is committed first, then the drop: two undo steps) and dragging one of
several selected blocks (only the grabbed block moves; the rest of the selection
stays put). Not covered: locked nodes (only comments are locked, and they have
no interaction).

## 4. Keyboard commands

| Group         | Commands                                                                                           | Coverage                                        |
| ------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Navigation    | Down, Up, Home, End, Left, Right, Shift-Left/Right, Shift-Alt-Left/Right, `Shift-,` (Jump to Root) | ✅ mostly                                       |
| Reading aloud | `\` (Read Ancestors), `Shift-\` (Read Children)                                                    | ✅ `keyboard-commands-test`                     |
| Focus         | Shift-Tab to the toolbar                                                                           | ✅ `keyboard-commands-test`, `interaction-test` |
| Editing       | Enter, Cmd-Enter (Edit Anything), Ctrl-[ / Ctrl-]                                                  | ✅ `edit-errors-test`, `new-blocks-test`        |
| Selection     | Space, Esc, Ctrl-Esc, Alt-Q                                                                        | ✅                                              |
| Delete        | Delete, Backspace                                                                                  | ✅ `keyboard-commands-test`                     |
| Clipboard     | Copy, Cut, Paste, Paste Before                                                                     | ✅ `paste-test`, `copypaste-test`               |
| History       | Undo, Redo (Cmd-Y, Shift-Cmd-Z, Ctrl-Y variants)                                                   | ✅ `undo-matrix-test`                           |
| Help          | Shift-Ctrl-/                                                                                       | ✅ `keyboard-commands-test`                     |
| Search        | PageUp/PageDown, F3, Ctrl-F                                                                        | ✅ keys are inert (`keyboard-commands-test`)    |

Each command is also tested at top level (no node focus, `isNodeEnv` false),
where the node commands do nothing and CodeMirror's own text keys still work
(`keyboard-commands-test`).

## 5. Editing UI

- **Existing node edit:** commit on Enter, blur, and click-away. Cancel on Esc or
  Alt-Q. An unchanged or empty value restores the original. Invalid input sets
  the error id and stays editable. A later valid value clears the error.
- **Top-level quarantine:** typing into empty space, between blocks, at the line
  start and end, on an empty document, with a selection active, and with a
  modifier key pressed. Then commit, cancel and invalid input.
- **Insertion inside an empty node** (`(f)`) and inside empty argument lists.
- **Drop-target editing:** double-click or Ctrl-[ / Ctrl-] activates it, and
  Enter inserts.
- **ContentEditable specifics:** paste of rich text, newlines in the value, a very
  long value, IME input.

Coverage: `edit-errors-test` (edit in place, invalid input, Esc, insertion beside
a child, rejected API edits, failed mode switch), `toplevel-input-test` (typing
and pasting at the top level) and the older specs. Typing over a selected range
and clicking away from an edit need a real browser: `e2e/typing.e2e.ts`.

## 6. Focus and selection

This area has produced the most bugs.

- Focus after every edit type: delete first, last, only, nth; insert; replace;
  drop; undo; redo.
- Focus when the focused block is virtualized out of view by CodeMirror, then
  comes back.
- Focus is never left on `SR_fix_for_slow_dom`; keys always reach a handler.
- Cursor and scroll don't jump after an edit made from a block.
- Mouse click on a block, a literal (enters edit mode), the editor whitespace,
  and a collapsed block.
- Selection pruning when selected nodes are deleted, replaced or undone.
- Toolbar focus and return.

Coverage: `focus-test`, `activation-test`, the invariants (focus never stranded,
never pointing at a missing node), `undo-matrix-test` (focus after every edit and
after undo) and `interaction-test` (clicks, click-away while editing, selection
pruning, toolbar focus). Virtualization and long documents need a real browser
(section 13).

## 7. Clipboard

- **Copy:** single node, selection, no selection (copies the focused node),
  ordering by position, joining with a space, newline joining around commented
  nodes.
- **Cut:** same as copy plus deletion, and the announcement text.
- **Paste:** replacing a selected node, beside a root, into a valid field, into an
  invalid field (beep and message), pasted text that is invalid, multiple
  expressions, empty clipboard, and `navigator.clipboard` missing or failing so
  the `execCommand` fallback runs.
- **Toolbar copy** from `PrimitiveList`.

Coverage: `paste-test` covers copy, cut and every paste case, including the empty
clipboard. Not covered: `navigator.clipboard` failing so the `execCommand`
fallback runs, and toolbar copy.

## 8. Undo and redo

- Per edit type (rows 1 to 13 above), undo then redo restores text, AST, focus,
  collapsed state and marks.
- Multi-step sequences, undo past the beginning, redo after a new edit (redo stack
  cleared), and undo after a mode toggle.
- Annotation persistence on the real history.
- Undo from a block and from the text editor; undo with focus on a block that no
  longer exists.

Coverage: `undo-matrix-test` runs every edit type of section 1 through undo, redo,
API undo, a new edit after undo, and focus after undo; `undo-redo-test`,
`undo-state-test` and `editor-history-test` cover the machinery.
`undo-focus-test` pins which block gets focus afterwards (the saved block number
from the history item, else the block nearest the change, climbing to a collapsed
ancestor; the editor itself when no block is left), and `e2e/undo-focus.e2e.ts`
checks the same in a real browser.
`edge-cases-test` covers undo after a mode toggle (switching replaces the
CodeMirror editor, so the history starts empty).

How focus is restored (`BlockEditor.handleChanges`, `focusAfterUndoOrRedo`): a
block number is a position in one particular document, so an undo (which
restores the document from before the edit) uses the number saved for "before"
and a redo the one saved for "after". Quick `+`-origin changes that CodeMirror
merges into one history item keep the first "before" and the last "after".
Focus moves once, from CodeMirror's `changes` event, after the whole undo or
redo; it used to move from the per-change `change` event, and one history item
can fire several of those (the first used up the saved focus, the rest guessed).
`cmb.undo()` (CodeMirror's own undo, which nothing announces) has no saved
focus and uses the block-nearest-the-change heuristic.

A browser-only hazard sits next to this (`dropDomSelection`, caught by
`matrix.e2e.ts` and `e2e/undo-focus.e2e.ts`, invisible in jsdom): after a click
or typing on a block, the page's text selection can be anchored on the
container of CodeMirror's lines, at an offset equal to the line count. Before
redrawing, CodeMirror saves that selection and a block in the lines as the
active element; if the undo removes a line and that block goes, restoring the
selection throws `IndexSizeError` half way through the undo (and the dev
server's error overlay takes keyboard focus). The old code never hit it only
because it happened to focus a block that survived the redraw; the first
attempt at fixing the saved numbers (the wrong theory then was that focusing
before the redraw was the problem) hit it at once. Blocks don't use the text
selection, so it is dropped before an undo or redo.

## 9. Collapse, comments, other structure

- Collapse and expand: single block, all, current root, via Left and Right keys,
  double-click, and via drag.
- Collapsed state across edits and undo.
- `collapseAll` and `incrementalRendering` options.
- Comments: attached to a node, nested in a child, edited, deleted with the node,
  moved with a drag.
- Locked (`isNotEditable`) nodes: every edit path should refuse.

Coverage: collapse is covered by `activation-test` (keys) and `interaction-test`
(double-click, kept across edits, forgotten on delete, undo). `lifecycle-test`
covers the `collapseAll` and `incrementalRendering` options (both default to
**on** in the React component). Comments are 🟡 (`comment-test`, drag and
performEdits cases). The only locked (`isNotEditable`) nodes in the built-in
languages are comments, which have no interaction to test.

## 10. Mode, lifecycle and API

- Toggle text to blocks and back, with valid code, unparseable code, and a
  quarantine open.
- After a toggle: text, marks, AST, focus, toolbar, trash can, and the editor
  handle used by every handler (a stale handle caused a trash can bug).
- Mount and unmount, multiple editors on a page, re-mounting with a different
  language.
- Public API surface in block mode vs text mode (`api-test`): `getAst`,
  `setBlockMode`, `getBlockMode`, `getCM`, `runMode`.
- Language hooks: `parse` errors, `getExceptionMessage`, `primitivesFn`,
  pretty-printing round-trip.

Coverage: `lifecycle-test` (mode round trips, blocks and toolbar only in block
mode, text-mode edits, repeated switching, two editors on one page, unmounting,
stable pretty-printing of the example programs, mount options),
`edit-errors-test` (failed mode switch) and `undo-matrix-test`, which runs every
edit again after a mode switch. `big-expression.rkt` is skipped: 537 bytes but
~8s to pretty-print. `edge-cases-test` covers unmounting with an open quarantine
or edit, and re-mounting with a different language (the lambda language, which
also has no `primitivesFn`: its toolbar is empty but works).

## 11. Toolbar

Search filter, arrow-key navigation, Esc, copy, drag out, and focus handoff to
the editor. Coverage: `Toolbar-test`, `interaction-test` (Shift-Tab, Down into
the list, Escape back to the search box, filtering, disabled in text mode),
`paste-test` (copy) and `drop-targets-test` (drag out).

## 12. Properties that should hold after every operation

**Status:** implemented in `spec/helpers/invariants.ts` and run after every test
that uses `mountCMB` (see `spec/globalSetup.ts`). Property 8 is enforced for
`console.error` in every test. Randomized operation sequences are in
`spec/random-sequences-test.ts` (jsdom) and `e2e/random.e2e.ts` (browser).

The jsdom spec generates seeded sequences of the operations in section 1 plus
collapsing and mode switches, checks 1 to 6 and 8 after every step, then undoes
everything (the text must be the starting text, or the text after the last mode
switch, which starts a new history) and redoes everything (the final text). A
failure prints the seed, a shrunk sequence with the text after each step, and a
`CMB_RANDOM_REPLAY=...` command. The default run is 12 sequences of 25 steps
(about 6 seconds); set `CMB_RANDOM_RUNS`, `CMB_RANDOM_STEPS` and
`CMB_RANDOM_SEED` for more, with `NODE_OPTIONS=--max-old-space-size=8192` (each
sequence leaves about 40 MB behind in jsdom). The invariants only expect blocks
for roots inside CodeMirror's viewport (a 10-line window in jsdom, except in the random runs, which give lines a height). The browser
spec runs 9 steps of real input per seed (`CMB_E2E_SEEDS` picks the seeds).

Bugs these runs found, all fixed with regression specs: Delete, Cut and Copy
acted on a selected block's children as well as the block (so `(f x y)` in
`(f x y) z` took `z` with it, a `define` could not be deleted, and copying gave
`(f x y) f x y`); a root whose text was rewritten to something that parses the
same lost its block for good; `Node` kept a stale element after an in-place edit
(focus could end up on the "stand by" placeholder); the focus hint after
replacing a block looked in the old parent and threw after the text had changed.
The undo/redo saved-focus problem (a redo focused whatever block sat at the
pre-edit position, `0 ||` skipped the first block, merged history items lost
the saved focus) was found by these runs and fixed afterwards, see section 8.
Found by later runs, also fixed, each with a regression spec
(`spec/focus-recovery-test.ts`, and the two shrunk sequences replayed in
`spec/random-sequences-test.ts`; seed 11 stays in the default seeds of
`e2e/random.e2e.ts`):

- seed 528 (`CMB_RANDOM_RUNS=60 CMB_RANDOM_STEPS=30 CMB_RANDOM_SEED=500` found
  it): focus stranded on the "stand by" placeholder after undoing a toolbar
  drop. It was an artifact of the harness, not an app bug: in jsdom a drag does
  not take focus from an editing box as a real press does, so a box was left
  open without focus and a later undo or redo ran inside it (where Ctrl-Z and
  Ctrl-Y are text edits). The runs now close any open box before walking the
  history, and the sequence stays as a regression case. One quirk was found on
  the way and left alone, since no real scenario reaches it: while a node is
  being edited, `node.element` is still the old, detached span, not the box.
- seed 532: cutting a block, dragging the other to the trash can, pasting at the
  top level and cancelling left Ctrl-Z doing nothing. With no block left to
  focus, cancelling the typing box dropped focus to the page body, so the Esc
  handler in `NodeEditable` now keeps it in the text editor.
- seed 11 (browser only): a press on blank space that became a drag left focus
  on CodeMirror's scroller (it has `tabindex="-1"`), where no key is handled.
  `BlockEditor` now passes focus on from the scroller to the editor's input.
- the toolbar drop (found by making the jsdom `drag` helper realistic, not by a
  seed): pressing a toolbar block gives the toolbar keyboard focus, and a drop
  into the editor left it there, so Ctrl-Z was ignored. `actions.drop` now
  returns focus to the editor when the dropped block came from the toolbar. The
  helper (`pressFocus` in `spec/helpers/dnd.ts`) moves focus to the pressed
  element, or to the page body if nothing focusable is under it, and the random
  runs click back into the editor when a drag that came to nothing leaves focus
  on the toolbar. Regression: `e2e/toolbar-drag.e2e.ts` (the random runs excuse
  focus left on the toolbar, so only the browser spec guards the drop).

- seed 1004 (a harness artifact): focus on the page body after typing at the top
  of a document of more than ten lines. jsdom reports every element as 0 pixels
  tall, so CodeMirror believes every line is at the same height and that only
  the last line is on screen. It draws the last ten lines, and cannot redraw a
  line above them after a change: the block's container was moved into a new
  widget (which drops focus) that never reached the page until a later
  `cm.refresh()`, after the effects that give focus back had run. The random
  runs now give each text line a height (`giveLinesHeight`), so the whole
  document is drawn as in a browser, and the excuse they used to make for
  focus parked on the placeholder while the focused block was undrawn is gone.
  The shrunk sequence is replayed in `spec/random-sequences-test.ts` (it fails
  without the heights), and 40 more browser seeds (20 to 59) pass.

Runs on fresh seeds (`CMB_RANDOM_RUNS=60 CMB_RANDOM_STEPS=30
CMB_RANDOM_SEED=500`, `...=1000`, `...=2000` and `...=3000`, with
`NODE_OPTIONS=--max-old-space-size=8192`) all pass.

Properties to check after every operation:

1. The document text re-parses to exactly the AST in the store.
2. There is one text mark per root block, and each has a connected widget.
3. Rendered blocks equal the AST's nodes (no stale or missing blocks).
4. Node ids are unique and `nid`s are consistent.
5. The focused node exists in the AST and its element is in the DOM.
6. Selections only contain existing nodes.
7. Undoing then redoing any operation returns the same state; undoing everything
   returns the original document.
8. No console errors or React warnings.

The bugs found while modernizing (stale AST after undo, focus lost after delete,
the trash can using a stale editor) would each have been caught by 1, 3 or 5.

## 13. What jsdom can't cover

**Status:** implemented as a Playwright suite in `packages/codemirror-blocks/e2e`
(`npm run test:e2e`, Chromium, driving the example page; its CI job is
`.github/workflows/e2e.yml`).

jsdom has no layout (so CodeMirror never scrolls or drops lines from the page),
reports focus loosely, has no native drag and drop, no real clipboard and no
real selections, and its key and input events are synthetic. The jsdom specs
work around that with mocks (the viewport size, `elementFromPoint`,
`coordsChar`, the clipboard, `hasFocus`), and every mock is a place a spec can
pass without testing the real mechanism. Bugs this found that jsdom could not:
focus and scroll after undoing a delete, the hidden paste buffer keeping
keyboard focus, and focus falling to the page body when the last block goes.

- `matrix.e2e.ts`: the same 16 edit types as `undo-matrix-test.ts`, done with real
  clicks, keys, drops and the real clipboard, each then undone and redone by
  keyboard. A failure here with a passing jsdom twin means jsdom hid a bug.
- `random.e2e.ts`: short seeded sequences of real input (see section 12), with
  uncaught page errors counted as failures. Seed 11 is in the default seeds.
- `undo-focus.e2e.ts`: which block has keyboard focus after an undo and a redo
  (the DOM focus, which jsdom can't check, and no uncaught page errors).
- `delete-undo.e2e.ts`, `trash-can.e2e.ts`, `typing.e2e.ts`: the specific
  regressions, long documents, and real typing at the top level (including
  typing over a selection).
- `toolbar-drag.e2e.ts`: after a real-mouse drag from the toolbar into the
  editor, keyboard focus is back in the editor and Ctrl-Z undoes the drop.
  Pressing a toolbar block gives the toolbar keyboard focus, and the drop used
  to leave it there, so the undo was ignored. jsdom hid this because its `drag`
  helper did not move focus; it does now (`pressFocus` in `spec/helpers/dnd.ts`).

Drags: Playwright's native drag emulation is reliable for the trash can
(`dragWithMouse`) but not for small blocks, so those use `dragWithEvents`, which
dispatches real DOM drag events in the page against the real layout. Not
covered: Firefox and WebKit, touch input, and IME.

## Suggested order

1. The invariant harness (section 12), run after each operation in the existing
   specs.
2. The untested entry points: paste (rows 3, 4, 8), drag to drop target and
   whitespace (10, 11), toolbar drag (12).
3. Keyboard commands with no test, and error recovery (invalid edits).
4. The browser suite for section 13.
