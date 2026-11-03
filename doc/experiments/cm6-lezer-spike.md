# Experiment: CodeMirror 6 + Lezer (feasibility spike)

Status: spike finished, nothing adopted. The spike code lives on the (unpushed at the time of writing) branch `claude/spike-cm6-4ab65b`, folder `spike-cm6/`.

Question: would rebuilding on CodeMirror 6 and its Lezer parsers let the editor enforce "a program always parses", and make block/text modes one editor view? Verdict: **conditional go**: technically feasible, no blocker found, but it is a months-long rewrite and a major-version break.

No stage was a blocker. Decided by Stage 3 (the key risk), which holds with one required mitigation.
Scripts: `s0.mjs` (jsdom), `s1.mjs` (state), `blocks.mjs`+`s3.mjs` (flat blocks), `nested.mjs`+`s3b.mjs` (nested). Run `npm i`, `npx esbuild ... --bundle` for the page, `node s3.mjs`.

## Stage 0 — versions

state 6.7.6, view 6.43.15, commands 6.11.1, language 6.13.1, @lezer/lr 1.4.12, generator 1.8.1 (jsdom 30.1.3, happy-dom 21.0.4).
jsdom: `new EditorView` + dispatch works with a ~10-line global shim (window/document/MutationObserver/Range...). Only construction and DOM output were checked; no layout, so no real selection/focus/measure behaviour.

## Stage 1 — state only: GO

- (a) `transactionFilter` rejecting error-node trees works for single edits, unbalanced/balanced pastes, multi-range changes (judged on the final tree, so `(`+`)` together passes), unterminated strings. Tree is NOT guaranteed complete at filter time in general; calling `ensureSyntaxTree(tr.state, len, timeout)` inside the filter forces it (reject if it returns null). Gotchas: (1) a filter makes a broken doc un-editable except by one transaction that fixes everything (no stepwise repair), so initial/loaded broken programs need an escape hatch (disable filter while the doc has errors); (2) per-keystroke "type `(` then `)`" must be offered as paired insertion (closeBrackets-style) or typing is impossible; (3) Lezer error recovery is lenient, so "no error node" is a decent but not exact "valid program" test.
- (b) Swapping a Compartment (add/remove block-mode extension) keeps history, selection and a mapped mark field: undo worked in both modes, mark mapped through edits (6..11 -> 8..13 after two inserts).
- (c) Tagging: `transactionExtender` can annotate each doc change `parses=true/false`. The history extension does not store annotations on its events, so a parallel field is needed; "undo until state parses" works (loop undo, check tree).
- (d) 5,000 lines / 217 KB: initial full parse 82 ms; incremental per edit p50 0.6 ms, p95 1.3 ms; with the naive whole-tree error scan in the filter 2.6 ms p50 / 6.6-12 ms max. Scanning only the changed range would cut that further.

## Stage 2 — jsdom

Not pursued beyond Stage 0 (frugality). Widget DOM is plain DOM so structure (role/aria/nesting) is assertable in jsdom; focus, selection, atomicRanges cursor motion and keyboard nav depend on real layout and were verified only in Chromium. Expect the existing ~1500 jsdom tests to be rewritten, not ported.

## Stage 3 — real Chromium (Playwright 1.64): GO WITH MITIGATION

- Block `<span role=treeitem tabindex=-1 contenteditable=false>` inside `.cm-content[role=tree]` takes real DOM focus (`document.activeElement`), by `.focus()` and by mouse click; `ignoreEvent()=true` lets the widget own its key handling (arrow/Delete worked).
- ariaSnapshot shows a proper tree: `tree "program"` > `treeitem "..." [expanded] [level=1]` > `group` > nested treeitems at levels 2, 3.
- Focus survives edits elsewhere in the doc (widget `eq` true -> DOM kept). It is LOST (activeElement = body) whenever the focused widget, or an ancestor widget, is rebuilt: edits before it (position changes), inside it, or deletion. With `updateDOM()` returning true (reuse element, patch attributes) focus survived edits before/inside a flat block. With nested widgets and `updateDOM` false, an edit inside the ancestor dropped focus.
- Mitigation required: keep node identity in a StateField, give each block a stable id, reuse/patch DOM in `updateDOM`, and after each update run a "restore focus to id X" step (`view.requestMeasure` / rAF). This is a known-pattern, not exotic, but it is the permanent tax of this design (CM5 mark DOM is stable; CM6 widgets are disposable).
- `atomicRanges`: ArrowRight in the text cursor jumps across a whole block (1 -> 23 / 0 -> 41). Good.
- NOT verified: real screen-reader output (only the Chromium accessibility tree via ariaSnapshot), IME, touch, mobile selection across widgets, drag from widgets.

## What a port would cost (areas the maintainer's code touches)

- Rendering (React portals): widgets are created/destroyed by CM6, so portals need a registry keyed by node id (createPortal into `toDOM` elements, cleanup in `destroy`). Medium; nested blocks are best as one React tree per top-level widget with decorations only at top level, but then inner editing/selection is outside CM's model. Biggest design decision.
- Keymap / focus model: rewrite. Today's code owns focus on block elements; CM6 owns the contenteditable; the focus-restore layer above is mandatory. High.
- Drag and drop: CM5 DnD layer must be redone against CM6 (`EditorView.domEventHandlers`, pointer layer #339 is host-independent but drop-target mapping is new). Medium-high.
- Search: CM5 search addon gone; use @codemirror/search or custom over the tree; blocks hide text, so match->block reveal is custom. Medium.
- Public API break: embedders (WeScheme) using CM5 `markText`, `getCM()`, option names and `cm.on(...)` all break; CM6 is functional/immutable (state + effects). Wrapper shim possible for the common subset; a major version is unavoidable. High (external coordination).
- Parser: replace the per-language AST parsers with Lezer grammars (or an adapter turning Lezer trees to the current AST, losing nothing semantically). Medium per language; WeScheme's Racket-ish language has quote/local/etc.
- Tests: ~1500 jsdom tests assume CM5's DOM and sync layout; CM6 needs a shim and gives weaker guarantees (no layout, async measure) so focus/selection tests move to Playwright. Rewriting most is realistic; state-level tests (Stage 1 style) become far cheaper and faster.
- Rough size: months, not weeks, for feature parity; the spike shows nothing impossible.

## Gains confirmed

Always-available incremental tree (0.6 ms/edit at 5k lines), invariant enforcement via filters, one view across block/text modes with history/selection/marks preserved, transaction-level atomic edits.

## Biggest remaining risk

Focus/selection management across block widgets (disposable DOM, restore-on-update) with real assistive tech and mobile/IME, which this spike could not test. Second: public API break for embedders.

## Side question: is React the right renderer?

Not measured yet (a profile is planned); this is reasoning from the code.

- **The diff is the cheap part.** The AST is immutable, edits are explicit insert/delete/replace operations, `patchAst` keeps unchanged nodes identical and the `ToplevelBlock` memo compares ranges and hashes, so React mostly gets "nothing changed". If large documents are slow, suspect CodeMirror marker churn, layout, or a Redux selector in every node before the reconciler.
- **Four operations are not the whole update.** Inserting or deleting a node changes its siblings' `aria-posinset`/`aria-setsize`; `aria-level` depends on position; focus, selection, collapsed and error state change classes and attributes. React derives all of that from state. A hand-built renderer must decide which nodes to touch for each change, which is where stale-marker style bugs come from (the soak would catch them).
- **Dropping React costs:** every component (edit box, dialogs, toolbar, search UI), `react-redux`, `react-modal`, `react-tabs`, our delegated keyboard events, and most of the ~1500 Testing Library tests.
- **It would gain:** a smaller bundle, stable DOM identity (focus is not lost on a re-render), and predictable moves.
- **Cheaper options first:** profile a large document; render only visible top-level blocks; try Preact (there is a `preact` branch: find out why it stopped).
- **Link to CM6:** CM6 widgets are `toDOM`/`updateDOM`/`destroy` objects, and the spike showed focus survives only when the DOM is reused. If the CM6 rewrite happens, an imperative in-house renderer fits it better than React portals, which would need a registry keyed by node id plus a focus-restore step. So decide this together with CM6, not before.
