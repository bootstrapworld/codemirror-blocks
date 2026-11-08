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

Yes: **all 141 browser tests pass on Preact** (twice in a row), and the languages'
script-tag files work with the Preact editor file unchanged (the script-tag tests
run each case on both).

Two things were needed:

1. **When effects run.** Typing at the top level opens an edit box, which takes
   keyboard focus in an effect, and the next key must go into it. React runs the
   effects of a keypress before the browser goes on to the next event. Preact runs
   them after the next paint (or 35 ms), so a key pressed a few milliseconds later
   went to the hidden keyboard buffer and replaced what had been typed (`(f x y)`
   came out as `f x y)`; with 400 ms between the keys it was fine). Preact's own hook
   for this, `options.requestAnimationFrame`, is set to run effects in a microtask
   (`webpack/preact-compat.js`, which is what `react` is aliased to).
2. `NodeEditable` focuses its box in a layout effect (the same on both, and React
   passes everything as before).

## What is not done

- **The soak on Preact** (the browser batches can run it: `CMB_PREACT=1 npm run soak
-- --e2e`, and `-- --motion`), since the tests are not the whole of it.
- Whether the lite file is **shipped**: as `codemirror-blocks-lite-min.js` beside the
  full one (a page that has React already loses nothing; the languages are told only
  the name of the global, `CodeMirrorBlocks`, which both files define), and whether
  `npm run bundle` makes both. This is a decision, not a technical one.
- Preact is a **dev dependency** of the editor for this, and a major version (11).
  The editor on npm still uses React: only the script-tag file differs.

Not tried: lazy-loading rarely used parts, and replacing `react-modal` (21 KB) with
the native `<dialog>`: both are in the options for the size of the bundle.
