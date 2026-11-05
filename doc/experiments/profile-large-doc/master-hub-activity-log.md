# Master before/after: hub (ddb81c3c) and activity log (5645c691), 3000 lines

Medians of 5 runs, main-thread busy ms from a Chrome trace (`main-thread-trace.mjs`);
inclusive CPU-profile ms from `profile.mjs` (`INCL_TOP=80`). Builds: b2f11806 (before both),
ddb81c3c (hub), 5645c691 (hub + activity log).

| | b2f11806 | ddb81c3c | 5645c691 |
|---|---|---|---|
| edit, busy | 521 | 393 | 310 |
| undo, busy | 552 | 347 | 309 |
| redo, busy | 542 | 332 | 303 |
| arrow down x50, busy | 3566 | 1189 | 1182 |
| edit: `toActivity` (log printing) | 25–30 | 26–29 | 0 |
| edit: `annotateNodes` | 38 | 41 | 48 |
| edit: `speculateChanges` (full parse) | 139 | 142 | 150 |
| edit: Redux self time | 134 | 23 | 18 |
| arrow x50: `areNodesEqualish` | 740 | 738 | 747 |

## Arrow keys after the id-walk is kept (this branch, on top of 5645c691)

The block memo compared every block's old node against the current one on each focus
change, walking all descendants' ids (~0.75 s of 50 arrow-downs at 3000 lines). The answer
for a pair of node objects is now kept, and a node compared with itself is equal without a
walk. Trace busy ms, 5 runs each, two back-to-back series per build:

| | 5645c691 | with the kept answer |
|---|---|---|
| arrow down x50 | 1200, 1184 | 177, 177 |
| edit | 306, 411 | 347, 346 |
| undo | 300, 298 | 297, 313 |
| redo | 296, 289 | 299, 299 |

Profile, arrow x50: `areNodesEqualish` 747 -> 12 ms. Edit/undo/redo walks (~18 ms) are unchanged.
