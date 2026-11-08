# Preact in place of React (for the script-tag bundle)

**Question.** `react-dom` is half of `codemirror-blocks-min.js` (202 of 407 KB
parsed). Could the editor for a page with a `<script>` tag use Preact, through
`preact/compat`, and be much smaller?

**How to try it.** `npm run bundle:lite` (in `packages/codemirror-blocks`) builds
`dist/lite/codemirror-blocks-lite-min.js`, with `react` and `react-dom` aliased to
`preact/compat` (`webpack/umd-lite.config.js`). `CMB_PREACT=1 npx playwright test`
runs the browser tests on the example page built the same way.

## Size

|                                   | parsed | gzip (-9) |
| --------------------------------- | -----: | --------: |
| React (the build that is shipped) | 407 KB |    129 KB |
| Preact (`bundle:lite`)            | 215 KB |     71 KB |

47% smaller parsed, 45% smaller gzipped (Preact 11.2).

## Does it work

Most of it does, which was not certain: of the 141 browser tests, **131 pass** on
Preact. Drag and drop, focus, selection, scrolling, comments, undo and redo, the
animation, the script-tag files and the languages all run. What fails (10 tests) is
**typing the first character that opens an edit box**:

- A key pressed with no edit box open (typing at the top level) opens one; the
  box takes keyboard focus in an effect, and the key's character must go into it.
  React runs that effect before the browser inserts the character; Preact runs
  effects after the next paint, so the first character goes to the hidden
  keyboard buffer and is lost (`(f x y)` is typed as `f x y)`).
- `NodeEditable` was changed to focus in a layout effect (which both run at
  once). That fixed the edit-in-place cases (19 failures to 10), and React is
  unchanged (all tests pass).
- `ToplevelBlockEditable` does its focusing in `useEffect` on purpose
  ("CodeMirror calls focus() when `setBookmark` is called, which triggers React's
  unstable_flushDiscreteUpdates warning"), so a layout effect is not a drop-in
  there. A microtask after the commit would do it for both, but the tests (and
  the soak) are what say whether it is right.

## What it would take

1. The top-level typing path made independent of when effects run (above).
2. The comment-box and Routine typing cases that still fail checked after that
   (they are the same kind: a focus that has to happen before the next key).
3. The soak run on Preact, as the tests are not the whole of it.
4. If it holds, shipped as a second file (`codemirror-blocks-lite-min.js`) beside
   the full one, not instead of it: a page that has React already loses nothing,
   and the two behave the same to a language module, which is told only the name
   of the global.

Not tried: lazy-loading rarely used parts, and replacing `react-modal` (21 KB) with
the native `<dialog>`: both are in the options for the size of the bundle.
