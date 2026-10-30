# CHANGELOG

How to Update:
http://keepachangelog.com/

## Unreleased

### Changed

- **Requires Node 20+ and npm 8+, and React 19.** `CodeMirrorBlocks()` now
  renders with `createRoot`; the returned API object is still filled in before
  the call returns. The dependencies on `react-redux` (9), `redux` (5),
  `redux-thunk` (3), `reselect` (5), `react-tabs` (6) and `react-codemirror2`
  (8) were raised to match. `react-codemirror2` declares a peer range of
  `react <=18`, so projects that install this package need an `overrides`
  entry for it (see the root `package.json`).
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
- Added a browser test suite (`npm run test:e2e`, Playwright).
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
