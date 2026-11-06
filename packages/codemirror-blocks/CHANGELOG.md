# CHANGELOG

How to Update:
http://keepachangelog.com/

## 0.9.0 - 2026-10-30

### Changed

- **Dragging uses pointer events, and works on touch screens.** Blocks and
  toolbar items are dragged with the mouse, a pen, or a finger (press and hold
  briefly, then drag; moving sooner scrolls the page). `react-dnd` and
  `react-dnd-html5-backend` are no longer dependencies.
- **Requires Node 24+ and npm 11+, and React 19.** `CodeMirrorBlocks()` now
  renders with `createRoot`; the returned API object is still filled in before
  the call returns. The dependencies on `react-redux` (9), `redux` (5),
  `redux-thunk` (3), `reselect` (5), `react-tabs` (6) and `react-codemirror2`
  (9, the first version whose peer range allows React 19, so no `overrides`
  entry is needed) were raised to match.
- **The packages are now under the `@bootstrapworld` scope**:
  `@bootstrapworld/codemirror-blocks` and `@bootstrapworld/wescheme-blocks` (the
  toolkit already was `@bootstrapworld/cmb-toolkit`). Change `npm install
codemirror-blocks` to `npm install @bootstrapworld/codemirror-blocks`, and
  every `import ... from "codemirror-blocks"` or `"codemirror-blocks/lib/..."`
  to the scoped name. Workspace commands use the scoped names too, for example
  `npm run build --workspace=@bootstrapworld/codemirror-blocks`.
- **The packages are now under the `@bootstrapworld` scope**:
  `@bootstrapworld/codemirror-blocks` and `@bootstrapworld/wescheme-blocks` (the
  toolkit already was `@bootstrapworld/cmb-toolkit`). Change `npm install
codemirror-blocks` to `npm install @bootstrapworld/codemirror-blocks`, and
  every `import ... from "codemirror-blocks"` or `"codemirror-blocks/lib/..."`
  to the scoped name. Workspace commands use the scoped names too, for example
  `npm run build --workspace=@bootstrapworld/codemirror-blocks`.
- The package now has `types` and `exports` fields. The root entry, every
  `codemirror-blocks/lib/<module>` path, `.less` files, and the
  directory-style entry points (`lib/languages`, `lib/languages/wescheme`,
  `lib/languages/lambda`, `lib/languages/example`) are exported; other paths
  can no longer be imported.
- TypeScript is now checked with `strict` enabled.
- Fixed several keyboard and focus bugs: after undoing a delete the view no
  longer jumps and focus stays on a block; after pasting, focus returns to where
  it was instead of staying in a hidden text area (which broke undo); focus no
  longer falls to the page when the last block is removed; undo and redo keep the
  AST in step with the text; and the trash can no longer edits a stale editor
  after a mode switch.
- Undo and redo give keyboard focus to the block that had it before and after
  the edit (a redo used to focus whatever block was at the old position, and the
  first block was skipped).
- Keyboard focus is no longer lost (so that Ctrl-Z and the other shortcuts
  stopped working) after cancelling the typing box at the top level when no
  block is left, after clicking CodeMirror's scroller, or after dragging a
  block from the toolbar into the editor.
- `cmb.undo()` and `cmb.redo()` in block mode focus the same blocks as Ctrl-Z
  and Ctrl-Y (they used to guess from the change), and `edit_insert` with an
  empty or blank string no longer leaves a stray space.
- Delete, Cut and Copy act on the blocks you selected, not on their children as
  well: deleting `(f x y)` from `(f x y) z` no longer deletes `z`, a `define`
  can be deleted, and copying `(f x y)` no longer gives `(f x y) f x y`.
- A top-level block whose text was replaced by text that parses the same (a
  drag that lands where the block was, deleting a `...` placeholder) is drawn
  again instead of vanishing, and cancelling an edit no longer leaves focus on
  the screenreader placeholder.
- Development uses Node 24 (`.nvmrc`), Jest 30,
  TypeScript 6, webpack-cli 7, webpack-dev-server 6, webpack-bundle-analyzer 5,
  less-loader 13 and ESLint 10 (with `@eslint-react/eslint-plugin`, since
  `eslint-plugin-react` does not support ESLint 10 yet). Editor invariants are
  checked after every jsdom test, and seeded random sequences of edits are run
  and then undone and redone.
- Added a browser test suite (`npm run test:e2e`, Playwright; 72 tests, run in
  CI).
- `Language.getExceptionMessage` may return a `string` or an `Error`.
- The store is updated purely: `undoableAction` and `actionFocus` are readonly and
  change through the new `SET_UNDOABLE_ACTION` / `SET_ACTION_FOCUS` actions.
  `UNDO` and `REDO` no longer carry the editor, and the history bookkeeping
  they used to do in the reducer is now done by the `undoOrRedo` and
  `finishUndoOrRedo` thunks. The log of actions used for replaying sessions
  moved to `state/activityLog.ts`.
- `toolkit/test-utils`: the API returned by `mountCMB` wraps every call in
  `act()`.
- `skipWhile` (in `utils`) no longer calls its callbacks with `null` or
  `undefined`.
- **Breaking: a `DropTarget` says its place in a list with an `index`.**
  `<DropTarget field="body" index={i} />` inserts as element `i` of the list
  field (before the element that is there now; `list.length` is the end), wherever
  the layout puts it: a drop target no longer has to be a sibling of an element
  of the list, and one in an empty list works. A language module that draws its
  own drop targets must add the prop (`Args`, which most use, does it for you).
  The index counts every element of the array, orphan comments included. A drop
  target logs what is wrong with its field or index. `InsertTarget` and
  `edit_insert` take an index in place of a text position. For a node that is
  not an element of a list (the operator of a call), Ctrl-[, Ctrl-] and paste use
  the nearest drop target of its parent.
- A node's `pretty()` may return its text instead of a pretty-printer `Doc`, for
  a language that has a printer of its own; the text is not reflowed, and the
  node's comment is printed above it (or beside it, if it was).
- An `optional` field in a node spec may be `undefined` (or left out) as well as
  `null`, and an `undefined` `value` field no longer breaks hashing.
- The toolbar's plus, minus and clear-search icons are inline SVG: the
  Glyphicons font is no longer loaded from a CDN.
- Nothing in the editor animates for people who ask their system for less
  motion (`prefers-reduced-motion`), and blocks and values transition their
  colors only, not their size and place.

### Added

- `defineNode({ type, label, fields, pretty, render, ... })` gives the
  constructor of a kind of node, so that the fields are said once (and typed):
  `field.required()`, `field.optional()`, `field.list()` and `field.value<T>()`.
  The comment that goes with a node is printed for you.
- `attachComments(code, roots, { blockComment, syntax })` gives the comments of a
  program their places among the nodes a parser made, so that a parser has only
  to skip them. `scanComments` finds them for a comment syntax of the language's
  own (`scanSchemeComments` is as it was).
- `describeKinds(nodes)` says what a list of nodes is made of ("2 definitions,
  1 call, and 3 literals") from the labels of their kinds, for a long
  description; the summary of a program uses it.
- Routine (`lib/languages/routine`), a small example language that uses the
  newer API, and `?lang=routine` on the example page.
- `<DropTarget field="init" />` with no `index` fills an empty `optional` field
  (the initializer of `let x;`): a node typed or dropped there becomes the field.
- `listItems(list)` gives a hand-made layout the `index`, whether it is an orphan
  comment and the number to show for each element of a list.
- `useNodeState()` lets a component drawn inside a `<Node>` read whether its
  block is focused, selected, collapsed, being dragged, dragged over, the one
  whose edit was refused, or in the toolbar, without knowing about redux.
- Search is back. F3, Ctrl-F (Cmd-F on a Mac) opens the Search Settings dialog,
  with two ways to search: by text (case, whole word and regular expression
  options) and by kind of block. Enter closes the dialog and goes to the first
  match; PageDown and PageUp go to the next and previous match, on from the other
  end of the document with a sound at the end. It was taken out in #502 and is
  now built on the editor's own dialog (`appHelpers.search`) instead of wrapping
  the whole editor. Searching by block no longer skips the block right after a
  cursor between blocks.
- A search rotor, for changing what PageUp and PageDown search for without the
  dialog: Ctrl-F3 and Shift-Ctrl-F3 step through the kinds of block in the
  document, then the last text searched for, and say which one is chosen.

- The lambda language (`lib/languages/lambda`) works again, with its own node
  types and pretty-printers that round-trip to lambda syntax.
- The language guide (`doc/language.md`) describes the current node API.

### Fixed

- In block mode, the text editor's own cursor is no longer reported as a second
  selection next to a selected block. `listSelections()` and `getSelections()`
  used to return an extra empty range (and `getSelection()` a trailing
  separator), and `replaceSelection()` also inserted the new text at the
  cursor. `extendSelection()` no longer throws when the selection has more than
  one range.
- **One CodeMirror for both modes (#571).** `ToggleEditor` creates the
  CodeMirror once and hands it to whichever mode is showing, so a mode switch
  keeps marks made with `markText` (shown on their blocks again when blocks come
  back), the selection, the scroll position and the undo history: Ctrl-Z after
  switching back undoes the last edit made before the switch. If the text was
  edited in text mode the history starts over on the way back to blocks, since
  it may pass through text that is not a program. `react-codemirror2` is no
  longer used; the editor no longer keeps a record of marks on blocks that no
  longer exist.
- The beep and the wrap sound are inlined into the library as data URLs
  (`src/sounds.ts`, made from `assets/sounds` by `npm run build-sounds`), so
  importing the library no longer needs a bundler rule for `.mp3` files.
- Pretty-printing deeply nested code no longer takes exponential time: a
  537-byte expression in the examples took about 4 seconds to print (on every
  mode switch, edit and paste that reached it) and now takes under a
  millisecond, with the same output.
- WeScheme: `check-expect` blocks are announced as "Unit Test for <function>".
- The lambda lexer reports "Unexpected end of input" instead of throwing a
  `TypeError`.

### Removed

- Specs for modules that no longer exist (`spec/ui/*-test-old.js`).
