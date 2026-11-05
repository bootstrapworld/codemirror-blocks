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
