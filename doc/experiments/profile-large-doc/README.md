# Profiling the editor on large documents

Drives the example page in headless Chromium (Playwright), on generated WeScheme
documents, and reports timings, a CPU-profile breakdown and React render counts.
Findings: [`../profile-large-doc.md`](../profile-large-doc.md).

## Run

```bash
# 1. build the libraries once (from the repository root)
npm ci && (cd packages/cmb-toolkit && npx tsc) && (cd packages/codemirror-blocks && npm run build)

# 2. serve the example page in production mode on a port that is not 8123
cd packages/codemirror-blocks
npx webpack serve --config ../../doc/experiments/profile-large-doc/webpack.profile.config.js --port 8201

# 3. in another terminal, from doc/experiments/profile-large-doc
node profile.mjs --mode time    --sizes 200,1000,3000 --reps 5
node profile.mjs --mode profile --sizes 200,1000,3000 --reps 5
node profile.mjs --mode render  --sizes 200,1000,3000 --reps 2
node summarize.mjs              # markdown tables from the three results-*.json files
```

Close other heavy work first (the soak runner, say): timings are wall-clock.

## Options (`profile.mjs`)

| flag      | default                  | meaning                                                                                                                                                                             |
| --------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--mode`  | `time`                   | `time`: no profiler attached (numbers to quote). `profile`: CDP CPU profile + trace per operation, bucketed. `render`: counts component renders through a stub React DevTools hook. |
| `--sizes` | `200,1000,3000`          | document length in lines (`gen.js`: deterministic nested define/cond/let with comments, ~11 lines per form)                                                                         |
| `--reps`  | `5`                      | repetitions, each in a fresh browser context; results are appended to the output file                                                                                               |
| `--url`   | `http://localhost:8201/` | the dev server                                                                                                                                                                      |
| `--out`   | `results-<mode>.json`    | raw results (delete it to start over)                                                                                                                                               |

Operations (the list is in `runOnce`; each is one `m(name, action)` call, so add
or drop one there): a. load + first blocks render, b. text → blocks (warm),
c. edit a literal mid-document and commit, d. insert (paste) near the top / delete
it, e. undo / redo, f. arrow down ×50 / collapse all / expand all, g. typing 30
characters in text mode.

## Reading the output

- `first`: ms from the action to the first DOM change or long task (how soon
  the page reacts). `wall`: ms to the last DOM change or long task, before 400 ms
  of quiet. Both include the editor's own timers (the 250 ms placeholder step of
  incremental rendering, a ~200 ms delay after edits), so for cost use the busy
  time in `profile` mode.
- `profile` buckets are self time by file (React, Redux, CodeMirror, ours) and by
  stack (anything under a function named like `parse`/`patchAst` counts as
  parse + patchAst; anything under `useSelector`/`dispatch`/`getSnapshot` as
  Redux). Layout/style/paint come from the trace. The `0. idle baseline`
  operation is used to subtract the profiler's own overhead from `(program)`.
  The bucketing is heuristic; treat percentages as ±10 points.
- `render` counts fibers that did work in each commit (function components,
  memo, class), not DOM changes.
