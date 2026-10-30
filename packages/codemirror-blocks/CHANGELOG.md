# CHANGELOG

How to Update:
http://keepachangelog.com/

## 0.9.0 - 2026-10-30

### Changed

- **Requires Node 24+ and npm 11+, and React 19.** `CodeMirrorBlocks()` now
  renders with `createRoot`; the returned API object is still filled in before
  the call returns. The dependencies on `react-redux` (9), `redux` (5),
  `redux-thunk` (3), `reselect` (5), `react-tabs` (6) and `react-codemirror2`
  (9, the first version whose peer range allows React 19, so no `overrides`
  entry is needed) were raised to match.
- The package now has `types` and `exports` fields. The root entry, every
  `codemirror-blocks/lib/<module>` path, `.less`/`.mp3` files, and the
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

### Added

- The lambda language (`lib/languages/lambda`) works again, with its own node
  types and pretty-printers that round-trip to lambda syntax.
- The language guide (`doc/language.md`) describes the current node API.

### Fixed

- WeScheme: `check-expect` blocks are announced as "Unit Test for <function>".
- The lambda lexer reports "Unexpected end of input" instead of throwing a
  `TypeError`.

### Removed

- Specs for modules that no longer exist (`spec/ui/*-test-old.js`).
