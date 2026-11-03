# Is React the bottleneck? Profiling large documents

Question: when the editor is slow on a big program, is it React's reconciler, or
CodeMirror marker churn, layout, Redux selectors, parsing, `patchAst`?

**Short answer: yes, but not the reconciler itself.** Almost every operation
re-renders _every_ node in the document (one commit, tens of thousands of
component renders), and Redux's per-node `useSelector` subscriptions are the
other half of that cost. Parsing, `patchAst`, layout and CodeMirror marker work
are small, except at mode switches. The cost is linear in document size.

## Method

- Chromium (headless, Playwright), the example page with the **production**
  build of React, unminified (`webpack.profile.config.js`), viewport 1200×900.
- Documents from `gen.js`: nested `define`/`cond`/`let`/`lambda` with comments,
  200 / 1000 / 3000 lines = 76 / 364 / 1092 top-level forms (about 4.5k / 21k /
  64k component renders to draw the whole thing). WeScheme only; lambda not done.
- Three separate passes, so instrumentation never skews timings: `time`
  (no profiler; 5 reps per size), `profile` (CDP CPU profile + trace; 5 reps at
  200, 3 at 1000 and 3000), `render` (counts via a stub React DevTools hook; 2
  reps). Medians below. The machine was shared with a soak run that backs off
  under load, so expect a few percent of noise (min–max is in the raw tables).
- "first" = ms until the page first reacts; "settled" = last DOM change or long
  task. Both include built-in timers (250 ms placeholder step in incremental
  rendering, ~200 ms after edits), so judge cost by _busy_ CPU time.
- Bucketing is heuristic (self time by file; stacks under `parse`/`patchAst`
  count as parse; under `useSelector`/`dispatch`/`getSnapshot` as Redux).
  "other" is native/our code/browser work not attributed to the others.

Reproduce: see [profile-large-doc/README.md](profile-large-doc/README.md).
Raw results: `profile-large-doc/results-*.json`.

## Results

### Wall-clock (ms): first change / settled, median (min–max) of settled

| operation                        | 200 lines                 | 1000 lines                    | 3000 lines                     |
| -------------------------------- | ------------------------- | ----------------------------- | ------------------------------ |
| a. load + first blocks render    | 4 / **972** (758–973)     | 6 / **1237** (869–1285)       | 10 / **2233** (2038–2441)      |
| b. text -> blocks (warm)         | 64 / **591** (580–593)    | 146 / **509** (470–592)       | 321 / **2093** (1728–2242)     |
| c. edit literal mid-doc (commit) | 45 / **246** (241–260)    | 216 / **458** (375–515)       | 578 / **1462** (1245–1972)     |
| d. insert node at top (paste)    | 2 / **441** (438–845)     | 2 / **938** (852–955)         | 2 / **1986** (1708–2124)       |
| d. delete that node              | 41 / **202** (201–202)    | 280 / **735** (581–759)       | 620 / **1623** (1532–1696)     |
| e. undo                          | 61 / **219** (213–222)    | 370 / **685** (595–727)       | 866 / **2249** (1757–2409)     |
| e. redo                          | 69 / **223** (216–224)    | 344 / **602** (475–621)       | 935 / **2102** (1922–2567)     |
| f. arrow down x50                | 58 / **3161** (2752–4267) | 305 / **17688** (14297–18033) | 1001 / **54836** (50829–58179) |
| f. collapse all                  | 224 / **224** (165–281)   | 978 / **978** (878–1208)      | 4898 / **4900** (4665–5294)    |
| f. expand all                    | 91 / **92** (90–103)      | 795 / **795** (756–844)       | 4232 / **4232** (3415–4537)    |
| g. type 30 chars (text mode)     | 2 / **960** (951–989)     | 3 / **968** (962–971)         | 2 / **966** (954–995)          |

Text-mode key latency (keydown → next frame), median per size: 200: 8.2 ms, 1000: 2.1 ms, 3000: 2.3 ms

Top-level forms: 200 lines = 76, 1000 lines = 364, 3000 lines = 1092

### Where the CPU time goes (ms of main-thread work, median; % of busy)

**a. load + first blocks render**

| lines | busy ms | react     | redux    | codemirror | parse+patchAst | layout/style/paint | gc       | other     |
| ----- | ------- | --------- | -------- | ---------- | -------------- | ------------------ | -------- | --------- |
| 200   | 286     | 31 (11%)  | 22 (8%)  | 65 (23%)   | 22 (8%)        | 91 (32%)           | 12 (4%)  | 42 (15%)  |
| 1000  | 802     | 101 (13%) | 82 (10%) | 312 (39%)  | 65 (8%)        | 78 (10%)           | 45 (6%)  | 124 (15%) |
| 3000  | 4524    | 391 (9%)  | 314 (7%) | 2836 (63%) | 241 (5%)       | 105 (2%)           | 219 (5%) | 426 (9%)  |

**b. text -> blocks (warm)**

| lines | busy ms | react     | redux    | codemirror | parse+patchAst | layout/style/paint | gc       | other     |
| ----- | ------- | --------- | -------- | ---------- | -------------- | ------------------ | -------- | --------- |
| 200   | 246     | 25 (10%)  | 17 (7%)  | 45 (18%)   | 13 (5%)        | 74 (30%)           | 8 (3%)   | 57 (23%)  |
| 1000  | 916     | 101 (11%) | 71 (8%)  | 312 (34%)  | 50 (5%)        | 63 (7%)            | 41 (5%)  | 277 (30%) |
| 3000  | 4783    | 335 (7%)  | 272 (6%) | 2744 (57%) | 163 (3%)       | 77 (2%)            | 231 (5%) | 955 (20%) |

**c. edit literal mid-doc (commit)**

| lines | busy ms | react     | redux     | codemirror | parse+patchAst | layout/style/paint | gc       | other      |
| ----- | ------- | --------- | --------- | ---------- | -------------- | ------------------ | -------- | ---------- |
| 200   | 277     | 26 (9%)   | 39 (14%)  | 7 (3%)     | 15 (5%)        | 34 (12%)           | 24 (9%)  | 121 (44%)  |
| 1000  | 705     | 103 (15%) | 181 (26%) | 7 (1%)     | 53 (7%)        | 34 (5%)            | 27 (4%)  | 299 (42%)  |
| 3000  | 2683    | 445 (17%) | 653 (24%) | 11 (0%)    | 166 (6%)       | 40 (1%)            | 158 (6%) | 1089 (41%) |

**d. insert node at top (paste)**

| lines | busy ms | react     | redux     | codemirror | parse+patchAst | layout/style/paint | gc       | other      |
| ----- | ------- | --------- | --------- | ---------- | -------------- | ------------------ | -------- | ---------- |
| 200   | 315     | 29 (9%)   | 58 (18%)  | 16 (5%)    | 16 (5%)        | 37 (12%)           | 26 (8%)  | 132 (42%)  |
| 1000  | 1376    | 148 (11%) | 277 (20%) | 41 (3%)    | 56 (4%)        | 79 (6%)            | 74 (5%)  | 690 (50%)  |
| 3000  | 3949    | 463 (12%) | 837 (21%) | 109 (3%)   | 180 (5%)       | 145 (4%)           | 189 (5%) | 1943 (49%) |

**d. delete that node**

| lines | busy ms | react     | redux     | codemirror | parse+patchAst | layout/style/paint | gc       | other      |
| ----- | ------- | --------- | --------- | ---------- | -------------- | ------------------ | -------- | ---------- |
| 200   | 258     | 24 (9%)   | 52 (20%)  | 2 (1%)     | 12 (5%)        | 14 (6%)            | 6 (2%)   | 144 (56%)  |
| 1000  | 1088    | 159 (15%) | 282 (26%) | 5 (0%)     | 59 (5%)        | 11 (1%)            | 98 (9%)  | 504 (46%)  |
| 3000  | 3938    | 439 (11%) | 676 (17%) | 14 (0%)    | 178 (5%)       | 14 (0%)            | 194 (5%) | 2452 (62%) |

**e. undo**

| lines | busy ms | react     | redux     | codemirror | parse+patchAst | layout/style/paint | gc       | other      |
| ----- | ------- | --------- | --------- | ---------- | -------------- | ------------------ | -------- | ---------- |
| 200   | 255     | 20 (8%)   | 53 (21%)  | 2 (1%)     | 11 (4%)        | 13 (5%)            | 4 (2%)   | 153 (60%)  |
| 1000  | 1314    | 133 (10%) | 372 (28%) | 6 (0%)     | 48 (4%)        | 13 (1%)            | 42 (3%)  | 610 (46%)  |
| 3000  | 4458    | 386 (9%)  | 930 (21%) | 13 (0%)    | 173 (4%)       | 15 (0%)            | 198 (4%) | 2728 (61%) |

**e. redo**

| lines | busy ms | react    | redux      | codemirror | parse+patchAst | layout/style/paint | gc        | other      |
| ----- | ------- | -------- | ---------- | ---------- | -------------- | ------------------ | --------- | ---------- |
| 200   | 272     | 22 (8%)  | 51 (19%)   | 2 (1%)     | 10 (4%)        | 13 (5%)            | 5 (2%)    | 175 (65%)  |
| 1000  | 1418    | 110 (8%) | 385 (27%)  | 4 (0%)     | 58 (4%)        | 11 (1%)            | 29 (2%)   | 751 (53%)  |
| 3000  | 5459    | 420 (8%) | 1017 (19%) | 11 (0%)    | 175 (3%)       | 13 (0%)            | 718 (13%) | 3107 (57%) |

**f. arrow down x50**

| lines | busy ms | react       | redux       | codemirror | parse+patchAst | layout/style/paint | gc         | other      |
| ----- | ------- | ----------- | ----------- | ---------- | -------------- | ------------------ | ---------- | ---------- |
| 200   | 2939    | 959 (33%)   | 1100 (37%)  | 34 (1%)    | 10 (0%)        | 61 (2%)            | 231 (8%)   | 544 (19%)  |
| 1000  | 16770   | 5629 (34%)  | 6380 (38%)  | 166 (1%)   | 45 (0%)        | 75 (0%)            | 1812 (11%) | 2434 (15%) |
| 3000  | 56309   | 18321 (33%) | 21007 (37%) | 462 (1%)   | 137 (0%)       | 75 (0%)            | 9153 (16%) | 6893 (12%) |

**f. collapse all**

| lines | busy ms | react    | redux      | codemirror | parse+patchAst | layout/style/paint | gc       | other      |
| ----- | ------- | -------- | ---------- | ---------- | -------------- | ------------------ | -------- | ---------- |
| 200   | 419     | 22 (5%)  | 34 (8%)    | 95 (23%)   | 1 (0%)         | 50 (12%)           | 5 (1%)   | 235 (56%)  |
| 1000  | 2025    | 120 (6%) | 241 (12%)  | 508 (25%)  | 1 (0%)         | 54 (3%)            | 28 (1%)  | 1032 (51%) |
| 3000  | 6945    | 407 (6%) | 1178 (17%) | 3177 (46%) | 2 (0%)         | 160 (2%)           | 148 (2%) | 1801 (26%) |

**f. expand all**

| lines | busy ms | react    | redux    | codemirror | parse+patchAst | layout/style/paint | gc       | other      |
| ----- | ------- | -------- | -------- | ---------- | -------------- | ------------------ | -------- | ---------- |
| 200   | 426     | 22 (5%)  | 21 (5%)  | 37 (9%)    | 0 (0%)         | 25 (6%)            | 6 (1%)   | 303 (71%)  |
| 1000  | 1961    | 103 (5%) | 129 (7%) | 450 (23%)  | 1 (0%)         | 31 (2%)            | 73 (4%)  | 1298 (66%) |
| 3000  | 6697    | 359 (5%) | 374 (6%) | 3026 (45%) | 3 (0%)         | 31 (0%)            | 150 (2%) | 2476 (37%) |

**g. type 30 chars (text mode)**

| lines | busy ms | react  | redux  | codemirror | parse+patchAst | layout/style/paint | gc     | other      |
| ----- | ------- | ------ | ------ | ---------- | -------------- | ------------------ | ------ | ---------- |
| 200   | 214     | 0 (0%) | 0 (0%) | 11 (5%)    | 0 (0%)         | 28 (13%)           | 0 (0%) | 176 (82%)  |
| 1000  | 622     | 0 (0%) | 0 (0%) | 15 (2%)    | 0 (0%)         | 32 (5%)            | 0 (0%) | 576 (93%)  |
| 3000  | 3279    | 1 (0%) | 0 (0%) | 15 (0%)    | 0 (0%)         | 30 (1%)            | 0 (0%) | 3233 (99%) |

### Inclusive time of selected functions (ms, median)

| function                              | op @ 3000 lines → ms                                                                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react:flushSyncWorkAcrossRoots_impl` | a. load: 142; b. text: 99; c. edit: 838; d. insert: 1206; d. delete: 848; e. undo: 790; e. redo: 863; f. arrow: 39362; f. collapse: 4127; f. expand: 3722; g. type: 0  |
| `react:performWorkOnRoot`             | a. load: 933; b. text: 790; c. edit: 838; d. insert: 1206; d. delete: 848; e. undo: 790; e. redo: 863; f. arrow: 39362; f. collapse: 4127; f. expand: 3722; g. type: 0 |
| `react:renderRootSync`                | a. load: 786; b. text: 688; c. edit: 527; d. insert: 626; d. delete: 510; e. undo: 489; e. redo: 543; f. arrow: 23919; f. collapse: 495; f. expand: 417; g. type: 0    |
| `react:commitRoot`                    | a. load: 146; b. text: 101; c. edit: 311; d. insert: 551; d. delete: 339; e. undo: 297; e. redo: 320; f. arrow: 15443; f. collapse: 3632; f. expand: 3305; g. type: 0  |
| `react:flushPassiveEffects`           | a. load: 2903; b. text: 2816; c. edit: 147; d. insert: 163; d. delete: 185; e. undo: 151; e. redo: 167; f. arrow: 8565; f. collapse: 3474; f. expand: 3155; g. type: 0 |
| `ours:parse`                          | a. load: 179; b. text: 119; c. edit: 69; d. insert: 73; d. delete: 67; e. undo: 66; e. redo: 65; f. arrow: 0; f. collapse: 0; f. expand: 0; g. type: 0                 |
| `ours:replaceMarkerWidget`            | a. load: 67; b. text: 48; c. edit: 6; d. insert: 161; d. delete: 1; e. undo: 1; e. redo: 1; f. arrow: 0; f. collapse: 0; f. expand: 0; g. type: 0                      |
| `codemirror:markText`                 | a. load: 66; b. text: 47; c. edit: 6; d. insert: 161; d. delete: 1; e. undo: 1; e. redo: 1; f. arrow: 0; f. collapse: 0; f. expand: 0; g. type: 0                      |
| `codemirror:makeChangeFromHistory`    | a. load: 0; b. text: 0; c. edit: 0; d. insert: 0; d. delete: 0; e. undo: 106; e. redo: 106; f. arrow: 0; f. collapse: 0; f. expand: 0; g. type: 0                      |
| `ours:speculateChanges`               | a. load: 0; b. text: 0; c. edit: 97; d. insert: 108; d. delete: 105; e. undo: 105; e. redo: 105; f. arrow: 0; f. collapse: 0; f. expand: 0; g. type: 0                 |
| `ours:patchAst`                       | a. load: 0; b. text: 0; c. edit: 41; d. insert: 42; d. delete: 49; e. undo: 44; e. redo: 43; f. arrow: 0; f. collapse: 0; f. expand: 0; g. type: 0                     |
| `ours:reactElement`                   | a. load: 19; b. text: 14; c. edit: 1; d. insert: 12; d. delete: 1; e. undo: 0; e. redo: 1; f. arrow: 23; f. collapse: 1; f. expand: 0; g. type: 0                      |
| `react:ReactElement`                  | a. load: 0; b. text: 0; c. edit: 0; d. insert: 0; d. delete: 0; e. undo: 0; e. redo: 0; f. arrow: 8; f. collapse: 0; f. expand: 0; g. type: 0                          |
| `codemirror:updateDisplayIfNeeded`    | a. load: 7; b. text: 4; c. edit: 2; d. insert: 6; d. delete: 1; e. undo: 1; e. redo: 1; f. arrow: 0; f. collapse: 5; f. expand: 3; g. type: 2                          |

### React component renders per operation (median; commits in brackets)

| operation                        | 200 lines   | 1000 lines  | 3000 lines   |
| -------------------------------- | ----------- | ----------- | ------------ |
| a. load + first blocks render    | 4531 (6)    | 21523 (58)  | 64442 (160)  |
| b. text -> blocks (warm)         | 4531 (7)    | 21523 (57)  | 64475 (168)  |
| c. edit literal mid-doc (commit) | 3828 (1)    | 18084 (1)   | 54120 (1)    |
| d. insert node at top (paste)    | 4463 (2)    | 21167 (2)   | 63391 (2)    |
| d. delete that node              | 3814 (1)    | 18070 (1)   | 54106 (1)    |
| e. undo                          | 3816 (1)    | 18072 (1)   | 54108 (1)    |
| e. redo                          | 3814 (1)    | 18070 (1)   | 54106 (1)    |
| f. arrow down x50                | 188509 (59) | 901310 (60) | 2703109 (59) |
| f. collapse all                  | 3770 (1)    | 18026 (1)   | 54062 (1)    |
| f. expand all                    | 3767 (1)    | 18023 (1)   | 54059 (1)    |
| g. type 30 chars (text mode)     | 0 (0)       | 0 (0)       | 0 (0)        |

Top components, f. arrow down x50 @ 3000 lines: Node 1583550, DropTarget 1119409, BlockEditor 50, DragAndDropEditor 50, CodeMirrorHost 50

Top components, e. undo @ 3000 lines: Node 31672, DropTarget 22389, Primitive 29, ToplevelBlock 2, Dialog 2, Modal 2

Top components, c. edit literal mid-doc (commit) @ 3000 lines: Node 31668, DropTarget 22386, Primitive 29, Args 20, ToplevelBlock 2, Dialog 2

## Reading the numbers

1. **One edit re-renders the whole document.** Editing one literal, undo, redo,
   delete, collapse-all: each is a single React commit, but renders 3.8k / 18k /
   54k components at 200 / 1000 / 3000 lines (the entire tree: `Node` and
   `DropTarget`). Insert at the top is the same. Only `ToplevelBlock`'s memo
   bails out on unchanged roots, and it is not reached, because the roots'
   children subscribe themselves.
2. **Arrow-down is the worst case**: each key press is a commit that renders the
   whole tree (2.7M renders for 50 keys at 3000 lines), ~1.1 s per key at 3000
   lines, ~340 ms at 1000, ~60 ms at 200. Redux 37% (every `Node` runs its
   selectors, including `getFocusedNode` at `Node.tsx:246`, on every dispatch), React 33%, GC 8–16% (garbage from the
   renders), the rest other. Layout and CodeMirror are ~1–2%.
3. **Parse + `patchAst` is 3–8%** of any edit (≈170 ms at 3000 lines): not the
   problem. Layout/style/paint is ≤12% except on tiny docs.
4. **CodeMirror marker work matters only at mode switch and collapse/expand all**:
   57–63% of load/text→blocks at 3000 lines (`markText`/`replaceMarkerWidget` and
   marker clearing, ~2.7 s), and 45% of collapse/expand all. Still, `flushPassiveEffects`
   (which creates the markers) shows 2.8 s inclusive there: the markers are made in
   layout effects of 1092 `ToplevelBlock`s, one at a time.
5. **Text mode typing is fine**: ~2 ms key latency, independent of size (the
   200-line 8 ms is warm-up). Load/switch cost is for blocks mode only.
6. Medium documents are already uncomfortable: 1000 lines means 0.5–0.9 s per
   edit/undo and 0.3 s per arrow key.

Product issues seen on the way (not fixed): collapse-all while a deeply nested
block has focus leaves focus on `<body>`; Ctrl+] on a top-level root inserts
nothing.

## Which change would help most

| change                                                                                                                                                                                                                                                                                                                    | expected effect                                                                                                                                                                                                               | verdict                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **Stop every `Node` subscribing to global state** (focused node, error-free flag, selection, collapsed): derive "is this node focused/selected/collapsed" with a selector that returns a boolean for _this_ node's id, or have the focus/selection live in a few components that update the one or two affected DOM nodes | removes the 100% re-render on arrow-down, collapse and (with memo) edit/undo; ~85% of busy time for navigation                                                                                                                | **#1**                 |
| **Make unchanged subtrees bail out** (`React.memo` on `Node` keyed by hash/range/ariaPosInset, as `ToplevelBlock` already does for roots; stable props and callbacks)                                                                                                                                                     | edit/undo/insert touch only the changed root(s) plus those whose posinset shifted                                                                                                                                             | **#2** (pairs with #1) |
| Virtualise: render only top-level blocks near the viewport                                                                                                                                                                                                                                                                | CodeMirror already shows only visible lines; React still renders all 1092 roots into detached containers. Would cut load/switch (4.5 s at 3000 lines) and make per-op cost independent of size. Bigger change; do after #1/#2 | next                   |
| CodeMirror marker batching (one `operation()` around marker creation)                                                                                                                                                                                                                                                     | load/switch: markers are 57–63% at 3000 lines; likely a 2× win there, nothing elsewhere                                                                                                                                       | worthwhile, cheap      |
| Swap to Preact                                                                                                                                                                                                                                                                                                            | the cost is _how many_ components render, not the reconciler's per-component speed; maybe a constant factor, not the O(N)                                                                                                     | not the fix            |
| Faster parse / `patchAst`                                                                                                                                                                                                                                                                                                 | ≤8% of an edit                                                                                                                                                                                                                | no                     |

Caveat: with #1 and #2 done, the remaining per-edit cost would be `speculateChanges`

- `patchAst` + parse (≈170–280 ms at 3000 lines) and undo history work; worth a
  second profile after.

## Adopted, part 1: per-node focus booleans, stable `NodeContext`, set lookups

Raw results: `profile-large-doc/after/`. Medians of 3 reps (settled ms); unit
tests (1491) and the e2e suite (90) pass.

| operation          | 200 before → after | 1000 before → after | 3000 before → after | renders @3000 |
| ------------------ | ------------------ | ------------------- | ------------------- | ------------- |
| arrow down ×50     | 3161 → 451         | 17688 → 2065        | 54836 → 3864        | 2.7M → 260    |
| edit literal       | 246 → 243          | 458 → 385           | 1462 → 915          | 54k → 224     |
| delete             | 202 → 208          | 735 → 358           | 1623 → 979          | 54k → 52      |
| undo               | 219 → 218          | 685 → 294           | 2249 → 617          | 54k → 54      |
| redo               | 223 → 215          | 602 → 432           | 2102 → 1166         | 54k → 52      |
| insert at top      | 441 → 437          | 938 → 944           | 1986 → 2089         | 63k → 63k     |
| collapse all       | 224 → 222          | 978 → 967           | 4900 → 4767         | 54k → 32k     |
| expand all         | 92 → 156           | 795 → 807           | 4232 → 4494         | 54k → 32k     |
| load / text→blocks | unchanged          | unchanged           | ~2.2 s              | 64k           |

Still open, in order of payoff: insert/delete near the top re-renders every
later root because `areNodesEqualish` compares absolute positions (compare
relative to the previous root); collapse/expand all spends half its time in
CodeMirror (`marker.changed()` per node: batch in one `operation()`); load and
mode switch (marker creation for 1092 roots, the 250 ms placeholder step);
arrow keys still cost ~78 ms at 3000 lines from every block's selectors running
on each store update.

## Adopted, part 2: one `marker.changed()` per block per commit

Raw results: `profile-large-doc/after2/`. Medians of 3 reps, settled ms; 1491
unit tests and 90 e2e tests pass. (Skipping the call on mount was faster still
but broke an e2e test that clicks beside a just-drawn block: CodeMirror needs the
measure at mount.)

| operation                  | 3000 lines, original | after fix 1 | after fix 2 |
| -------------------------- | -------------------- | ----------- | ----------- |
| load + first blocks render | 2233                 | 2476        | **1014**    |
| text → blocks (warm)       | 2093                 | 2153        | **933**     |
| edit literal               | 1462                 | 915         | **475**     |
| undo                       | 2249                 | 617         | **484**     |
| redo                       | 2102                 | 1166        | **857**     |
| insert at top              | 1986                 | 2089        | 1535        |
| delete                     | 1623                 | 979         | 775         |
| arrow down ×50             | 54836                | 3864        | **3492**    |
| collapse all               | 4900                 | 4767        | **851**     |
| expand all                 | 4232                 | 4494        | **767**     |

Not done: skipping unchanged later roots after an insert/delete near the top.
`areNodesEqualish` compares absolute positions, and a block that bails out keeps
its old `ASTNode` in props, which edit handlers (`ReplaceNodeTarget(props.node)`)
read positions from; doing it safely means resolving the node by id from the
store at the point of use. That is a larger, riskier change than the two above.

## Adopted, part 3: blocks that only moved are not drawn again

`Node` is `React.memo`'d and `areNodesEqualish` compares content hash, place among
siblings, level and _shape_ (lines spanned, end column), not absolute position, so
an insert or delete above a block no longer redraws it. A block that bails out keeps
an older node object, with older positions. To make that hard to get wrong:

- `Node`'s `node` prop and the node context are typed `DrawnNode` (`ast.ts`): an
  `ASTNode` without `from`, `to`, `nid`, `srcRange`, `fields`, `children` and
  `descendants`. Reading a position from it does not compile. `id`, `type`,
  `hash`, `options`, `level`, `ariaSetSize` and `ariaPosInset` are as current as
  the block (ids are kept by `patchAst`; the others are in the comparison).
- Code that acts on the node's place in the document calls `currentNode()`, which
  looks it up by id in the present AST (`Node.tsx`, `DropTarget.tsx`, and the root
  block's marker code in `ToplevelBlock.tsx`).
- The root block hands focus back after it remakes its marker, since the blocks
  inside no longer run the effect that did.
- `e2e/moved-blocks.e2e.ts` edits, deletes, collapses and focuses blocks after
  inserts above them. (Replacing `currentNode()` with the stale node does not fail
  it: edits, deletes and activation turn out to go by id. The type guard, not the
  test, is what protects the position-dependent paths.)

| 3000 lines (ms, settled) | before    | after                    |
| ------------------------ | --------- | ------------------------ |
| insert at top (paste)    | 1535      | 954 (63k → 5.5k renders) |
| arrow down ×50           | 3492      | 2033                     |
| undo / redo              | 484 / 857 | 361 / 696                |
| delete                   | 775       | 706                      |
| edit literal             | 475       | 431                      |

Raw results: `profile-large-doc/after-memo/`.

## Not adopted: further options, kept on the branch `perf-experiments`

The first four changes above (two commits touching `Node.tsx` and `selectors.ts`,
about 70 lines) got most of the gain for little complexity, and the memoization
below was adopted after them (see "Adopted, part 3"). These three others went
further and were measured, but add machinery, so they are left out for now. The
code is on the local branch `perf-experiments` (commits named below), with its raw
results in `profile-large-doc/after3`…`after7`, `noplaceholder`. Each section
below says what it does and what it costs. Numbers are 3000 lines, settled ms, and
cumulative on top of the adopted changes.

| option                                           | commit     | arrow ×50 | edit | insert at top                                                                   | text → blocks | expand all | cost                                                                                                                                         |
| ------------------------------------------------ | ---------- | --------- | ---- | ------------------------------------------------------------------------------- | ------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| adopted state                                    |            | 3492      | 475  | 1535                                                                            | 933           | 767        |                                                                                                                                              |
| keyed subscription hub                           | `03ee95f1` | 99        | 342  | 984                                                                             | 1237          | 478        | `state/nodeSubscriptions.ts` (110 lines): per-id state is no longer `useSelector`, and must be wired into the hub or the UI goes stale       |
| parse only the forms an edit touches (WeScheme)  | `ac9136c6` | 112       | 268  | 1381 (slower than the row above, not investigated; 478 again with the next row) | 818           | 496        | `edits/incrementalParse.ts` (150 lines), `ASTData.sourceText`, a lexical guard, a differential spec; edit's first visible change 145 → 70 ms |
| draw only blocks near the viewport (> 300 forms) | `1faa42c3` | 125       | 271  | 478                                                                             | 724           | 88         | scroll position in a long program is approximate until blocks arrive; threshold and option; only e2e covers it                               |

Reading it: the hub is what makes arrow keys instant (3.5 s → 0.1 s for 50 keys
at 3000 lines, 1000 lines 2.0 → 0.07 s); the rest matter mainly above ~1000 lines.
At 200 lines none of them changes anything. Reconsider the hub first if arrow-key
navigation in big programs is a complaint; viewport rendering if opening or
switching to blocks mode in very large programs is.

### Blocks that only moved; keyed subscriptions

Raw results: `profile-large-doc/after3/` (moved blocks) and `after4/` (keyed
subscriptions; includes a 3-rep CPU profile at 3000 lines). 1491 unit tests and
90 e2e tests (run twice) pass.

- **Blocks that only moved are not drawn again.** `areNodesEqualish` compares
  content hash, place among siblings, level and _shape_ (lines spanned, end
  column) instead of absolute positions, and `Node` is `React.memo`'d with it.
  Handlers start from the current node found by id (`currentNode()` in
  `Node.tsx`, the parent in `DropTarget`), and the root block gives focus back
  after remaking its marker (the blocks inside no longer run the effect that
  did). Insert at the top of 3000 lines: 63k renders → 5.5k.
- **Keyed store subscriptions** (`state/nodeSubscriptions.ts`). `useSelector`
  runs every selector on every store update: with 64k blocks, one arrow key was
  ~300k selector calls. `useIdState` subscribes by node id, and a hub, watching
  the store once, wakes only the ids whose focus/collapsed/selected/marked/
  editable state changed.

| operation (ms, settled)    | 3000 lines, original | now    | 1000, original | now    |
| -------------------------- | -------------------- | ------ | -------------- | ------ |
| load + first blocks render | 2233                 | 1234   | 1237           | 969    |
| text → blocks (warm)       | 2093                 | 1237   | 509            | 606    |
| edit literal               | 1462                 | 342    | 458            | 260    |
| insert at top              | 1986                 | 984    | 938            | 462    |
| delete                     | 1623                 | 203    | 735            | 202    |
| undo                       | 2249                 | 201    | 685            | 204    |
| redo                       | 2102                 | 203    | 602            | 204    |
| **arrow down ×50**         | **54836**            | **99** | **17688**      | **67** |
| collapse all               | 4900                 | 501    | 978            | 529    |
| expand all                 | 4232                 | 478    | 795            | 147    |
| type 30 chars              | ~960 (timer-bound)   | ~996   | ~960           | ~994   |

The 200 ms floor on delete/undo/redo and the ~1 s on typing are timers in the
editor and in the measurement (400 ms quiet window), not work. Component
renders at 3000 lines: arrow ×50 2.7M → 260; edit 54k → 72; undo 54k → 58;
collapse/expand all 54k → 32k (every node really changes).

What is left at 3000 lines, from the CPU profile: load and mode switch ≈ 1 s
(React 19%, parse+patchAst 15%, GC 10%, CodeMirror 7%; creating 1092 portals and
markers); an edit ≈ 340 ms, a quarter of it parse + `patchAst` + `speculateChanges`;
collapse/expand all ≈ 0.5 s (31k real re-renders). Ideas: virtualise root blocks
(render only those near the viewport), parse only the changed root on an edit,
and drop the 250 ms placeholder step once the first paint is cheap.

### The placeholder step (incremental rendering)

Each top-level block first renders an empty `<div/>`, then after a 250 ms timer
the real content (`ToplevelBlock`, `incrementalRendering`, on by default in block
mode). Measured with it switched off (`noplaceholder/`, medians of 5; 3 for the
profile):

| text → blocks, settled ms            | 200 lines | 1000 lines | 3000 lines |
| ------------------------------------ | --------- | ---------- | ---------- |
| with the placeholder (default)       | 594       | 606        | 1237       |
| without                              | **94**    | 595        | 858        |
| first visible change, with → without | 67 → 90   | 126 → 280  | 277 → 768  |

- CPU time is the same (3000 lines: 1230 ms busy with, 1325 without; the busy
  split is the same too). The placeholder saves no work; it adds the 250 ms wait
  and a second render pass (commits for a 3000-line load: ~160–290 → 2).
- It does make the page react sooner for big programs: without it, 3000 lines
  block the main thread for ~770 ms before anything changes, with it ~280 ms.
- So for programs under a few hundred forms it is pure delay (200 lines:
  594 → 94 ms).

**Not adopted: switching it off below 300 top-level forms.** The mouse-drag e2e
tests (`matrix`, `toolbar-drag`, `touch`; 9 tests) then fail, and pass again
with a 600 ms wait after the mode switch. So something is not ready for a drag
for a while after the first full render, and the placeholder delay was hiding it
(re-measuring the markers in a `requestAnimationFrame` did not fix it). Find
that first (probably drop targets or the drag layer being set up on the first
commit), then drop the delay for small programs, then replace the placeholder
with real chunking for large ones.

### Parse only what an edit touches; draw only what is in view

Raw results: `profile-large-doc/after6/` (incremental parse) and `after7/` (both,
with a 3-rep CPU profile and render counts at 3000 lines). 1492 unit tests and 95
e2e tests (five of them new, for a 400-form program) pass.

- **Incremental parse** (`edits/incrementalParse.ts`, WeScheme only, opt-in with
  `incrementalParse: true` on the language). For a single change, only the
  top-level forms it touches, one on each side, and whatever lies between them are
  parsed (the text is padded with blank lines and spaces so that positions come out
  right); the other forms are copied with their ids and shifted positions. It is
  used only when the stored AST is the editor's text (`ASTData.sourceText`), and
  not for an edit that contains or removes `" | ; \ #` (the parser does not
  complain about a string or block comment left open at the end of the window), or
  one that joins lines of a line comment. `patchAst` now matches nodes that already
  have their id first, so a moved form is not given another form's id. A
  differential spec compares the result with a full parse over 1200 random edits
  of three documents (and a longer run of 6000 passed too).
- **Viewport rendering** (`ToplevelBlock`, `BlockEditor`, option
  `virtualRendering`, on by default above 300 top-level forms). A block's content
  is drawn when it is within 30 lines of what CodeMirror shows, or holds the
  focus or a selection, and then stays drawn; until then it is a spacer as tall as
  its source (22 px a line). Blocks scrolled to are drawn as the viewport changes;
  since the spacer's height is an estimate, a scroll position in the unseen part
  of a long program is approximate until the blocks arrive.

| 3000 lines (ms, settled; first change in brackets) | original    | now                                     |
| -------------------------------------------------- | ----------- | --------------------------------------- |
| load + first blocks render                         | 2233        | 970 (a ~950 ms floor of timers remains) |
| text → blocks (warm)                               | 2093        | 724 (291)                               |
| edit literal                                       | 1462        | 271 (70)                                |
| insert at top                                      | 1986        | 478                                     |
| delete                                             | 1623        | 203 (77)                                |
| undo / redo                                        | 2249 / 2102 | 211 / 214 (80 / 84)                     |
| arrow down ×50                                     | 54836       | 125                                     |
| collapse all                                       | 4900        | 462                                     |
| expand all                                         | 4232        | 88                                      |

CPU work (busy ms) at 3000 lines, from the profile: first blocks render
1030 → 486 (component renders 96k → 6.7k; the rest is parsing the whole text once,
33%, and layout, 16%); text → blocks 1230 → 449; edit ≈ 280. What remains is
mostly timers (200 ms after an edit, ~950 ms around a mode switch, that are not
work), the one full parse on load, and collapse all (≈ 0.46 s: CodeMirror
measuring 1092 widgets whose height changed).
