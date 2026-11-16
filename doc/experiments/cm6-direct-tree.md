# Experiment: blocks on CodeMirror 6, without React, by direct edits of one tree

Status: STOPPED on 2026-11-15 at 21:05, after about 50 minutes of a 3 h 45 min
time box, because the account's usage limit was nearly spent (the owner asked for
a stop with enough left to write this). Nothing here is adopted. It is a working
core with tests, not an editor: there is no keyboard handling, no demo page, and
it has never run in a real browser.

- Branch: `experiment/cm6-direct-tree` (local only, not pushed), made from local
  `master` at `5e8faa4a`.
- Worktree: `.claude/worktrees/cm6-direct` (its own `node_modules`).
- Package: `packages/cm6-blocks` (private, added to the workspaces).
- Commits: `2a681381` (scaffold, contract), `f2aca45e` (model, renderer),
  `4f1eead9` (CodeMirror 6 view, typed text, undo), then this document.
- Run: `npx jest packages/cm6-blocks` (104 tests, about 6 s) and
  `npx tsc --noEmit -p packages/cm6-blocks`, from the worktree root.

It follows [cm6-lezer-spike.md](cm6-lezer-spike.md), which found CodeMirror 6
feasible and ended: "if the CM6 rewrite happens, an imperative in-house renderer
fits it better than React".

## The question

Today every block edit prints text, parses the WHOLE document again, reconciles
the new tree with the old one (`patchAst`), and then React reconciles the
drawing. At 3000 lines, parse-and-patch alone is about 400 ms per edit
([profile-large-doc.md](profile-large-doc.md)).

Can the editor keep ONE tree for the life of the document, change it in place
with a few explicit operations that each say exactly what changed, and patch the
text, the positions and the page for that change only: no whole reparse, no tree
diff, no virtual DOM? WeScheme only.

## Answer so far

Yes for the core, with numbers, and with three caveats that a next session should
look at first (see "What to do next").

| Measure (jsdom, not a browser)                           | Result                      |
| -------------------------------------------------------- | --------------------------- |
| Build the tree, 3000 lines / 14,001 nodes                | 28 ms                       |
| One operation, model only, same document                 | 0.24 ms median, 0.64 ms max |
| One operation through CodeMirror 6, 750 roots            | 0.47 ms median              |
| A typed edit between roots, through CodeMirror 6         | 0.40 ms median              |
| Create the editor, 750 roots / 1,476 lines               | 59 ms                       |
| Elements created for one insert into a 100-argument call | 2 (the block and one gap)   |

These are about a thousand times under today's 400 ms, but they are NOT a like
for like comparison: jsdom has no layout or paint, and today's figure is from a
real browser. The honest claim is that the model, text and DOM bookkeeping stop
being the cost; whether CodeMirror 6's own layout work stays small with thousands
of widgets is not measured.

## The design

Everything is in `packages/cm6-blocks/src` (1,977 lines). Nothing imports React,
CodeMirror 5, `@bootstrapworld/codemirror-blocks` or `@bootstrapworld/wescheme`.

- `types.ts`: the contract. A `BNode` is mutable and keeps its `id` for life. It
  has `from`/`to` offsets and `slots`: named places for children, each "one"
  (always exactly one node: deleting it leaves a blank `...`) or "list". A
  `TreeChange` is insert, remove or replace. `TextSource` is anything with
  `length` and `slice` (a string, or a CodeMirror `Text`), so the editing path
  never builds the whole document as a string.
- `wescheme.ts`: WeScheme text to nodes using only the vendored LEXER
  (`packages/wescheme/src/reader/lex.js`), not `sexpParser.ts` / `parseNode.ts`,
  which import the editor and React. Kinds: literal, blank, call, define,
  lambda, if, cond, clause, unknown, error. A node's range is exactly its source
  text. Comments stay in the text; no node holds them. Quote forms, vectors and
  the like are opaque "unknown" nodes holding their text.
- `doc.ts`:
  - `insertNode`, `removeNode`, `replaceNode`: each makes ONE text change, fixes
    every other node's positions (`shift`), and returns
    `{ text: TextChange, tree: TreeChange }`. The rest of the text is never
    rewritten, so the author's layout and comments survive an edit elsewhere.
  - `settle`: in Scheme the text decides the kind (inserting into `()` makes a
    call; a call whose head becomes `define` is a definition). After an
    operation it reads again ONLY the node whose content changed, and its
    ancestors while their reading changes, and swaps in the fresh node where the
    shallow shape differs. Cost is the size of the nodes re-read.
  - `reparseChange`: for changes no operation made (typing, paste, undo, redo).
    It reads again only the top-level forms the change touches, keeps the old
    node OBJECTS for forms whose text did not change (so their ids and DOM
    survive), and makes one "error" root, shown as plain text, where the text
    does not parse.
  - `checkDoc`: the oracle (below).
- `render.ts`: `Renderer` draws a node as plain DOM with the roles and aria
  attributes today's blocks have, and `apply(change)` patches the page for one
  `TreeChange`: the new element and one gap go in, later siblings get their
  `aria-posinset`, ancestors whose spoken label changed get a new `aria-label`.
  Elements the change does not touch are never rebuilt or moved.
- `view.ts`: `createBlockEditor(parent, text, language)`. One
  `Decoration.replace` widget per top-level form. The widget hands CodeMirror the
  renderer's own element every time, so CodeMirror never builds block DOM. The
  decoration set is mapped through changes and adjusted by an effect; it is never
  rebuilt from the tree. An operation is one transaction and one undo step.

### Order of work for one operation

tree changed and positions fixed, then `settle`, then the renderer patches the
page, then ONE CodeMirror dispatch carrying the text change and the decoration
effect. By the time CodeMirror asks a widget for its element, the element is
already right. The other order would let CodeMirror draw from a tree that is
about to change.

Changes that are not ours are handled in the view's `dispatchTransactions`
option, where transactions are final (a transaction extender or filter can run
for a transaction that is then dropped). The decoration changes go in one extra
effects-only transaction passed to the same `view.update`, so CodeMirror never
draws new text with old decorations.

### The oracles

This is what made it safe to move fast, and what a next session should keep:

- `checkDoc`: a fresh parse of the text equals the live tree, node by node,
  ranges included.
- a fresh `Renderer` drawing of the tree equals the live DOM (`isEqualNode`).
- `checkEditor`: both, plus every root has exactly one decoration at exactly its
  range, and none without a root.

Fuzzers assert them after every step: model 300 seeds x 40 operations; renderer
200 x 30; typed edits mixed with operations 200 x 30 (also run once at 4,000
seeds: 95,752 edits, 22,615 operations, clean); the whole editor 100 x 30 mixing
operations, typed edits, undo and redo. A failure prints its seed and log.

## What was learned

1. **Direct edits work, and the tree never has to be diffed.** The three
   operations plus `settle` and `reparseChange` kept the tree equal to a fresh
   parse through every fuzzer.
2. **The text deciding the kind is the real complication,** not positions.
   `settle` replaced 379 nodes in the 12,000-operation model fuzzer (151 of them
   roots). A language whose node kinds do not depend on neighbours would need
   much less of it.
3. **CodeMirror 6 still drops keyboard focus, even with the DOM reused.** An
   operation inside the focused block, in its parent, or in a later root: no
   rebuild and no focus loss. But an edit at or before the focused root's LINE
   makes CodeMirror build a new line element and move our element into it, and a
   moved element loses focus. In the editor fuzzer, 314 of 1,618 steps that began
   with a focused block needed focus given back. So the restore step is
   mandatory, as the earlier spike said; reusing the DOM reduces how often it
   runs, it does not remove it. It is one small function here (snapshot the
   focused node and its path before, give focus back after), which is far less
   than today's focus code, but it is a permanent part of the design.
4. **Undo gives new nodes.** Undoing an operation is a text change that is not
   ours, so the forms it touches are read again and get new ids and elements;
   forms outside it keep theirs. Focus then goes to the node at the same place.
   Making undo exact would need operations that can be inverted and tied to the
   history, which was not tried.
5. **CodeMirror 6 specifics that mattered** (view 6.43):
   - It offers ANY old widget element of the same class to a non-equal widget
     through `updateDOM`. Returning true always would show the wrong block;
     `RootWidget.updateDOM` returns true only for its own element.
   - `view.dispatch(tr1, tr2)` is NOT the several-transactions form;
     `dispatch([tr1, tr2])` is.
   - `Decoration.replace` mapping at its edges (an insert at `from` goes before,
     at `to` goes after) matches `shift` in `doc.ts`.
   - A `transactionExtender` or filter is the wrong place to change the tree.
6. **The vendored lexer can hang.** `packages/wescheme/src/reader/lex.js` never
   returns on some texts: a lone `.` or `..` inside a list (for example
   `[d (.\n\n. . (d fine)))]`), and some texts with `|` (seen: parsing `x|` and
   then `(a #|`). The fuzzers avoid `|` and lone dots. Today's editor guards part
   of this in `sexpParser.ts` (`maskMultilineBarSymbols`); this experiment does
   not. This matters to the CURRENT editor too if it can reach the lexer with
   such text: worth a test on master.

## What is not done

- No keyboard navigation, no editing by hand, no drop targets wired up, no drag,
  no selection, no search, no toolbar. The `Renderer` draws gaps and can map an
  element back to its node or gap (`nodeOf`, `gapOf`), and the editor has
  `insert` / `remove` / `replace` / `focusNode`, but nothing listens to keys or
  the mouse.
- No demo page and no bundle, so no bundle size. `package.json` has `build` and
  `serve` scripts for esbuild that expect a `demo/demo.ts` that was never
  written.
- Never run in a real browser: no layout, no real focus or selection, no paint
  timing, no screenreader. `atomicRanges` is provided but only its set was
  checked.
- Comments are not blocks. They stay in the text and are hidden wherever a root
  widget covers them.
- Only a few WeScheme forms have their own kind; the rest are "unknown" lists or
  opaque text.
- Prettier was not run on the package, and ESLint was not checked for it.

## Known weak points in what exists

- **Positions are absolute**, so `shift` walks every node after a change: 0.24 ms
  at 14,000 nodes, but it grows with the document. Offsets relative to the
  parent would make it proportional to depth.
- **`settle` replaces whole subtrees.** Children whose shape did not change are
  not reused, so a focused block inside one loses its element.
- **A broken document is expensive at the break.** While the text does not parse
  and the user types next to the break, each keystroke parses the rest of the
  document (to see whether a typed `"` pairs with a later one).
- **Operations do not look at the text around them.** A replaced atom directly
  followed by a comment (`#t;c`) is not separated, and an operation next to an
  error root holding a quote, `#`, `;` or a prefix mark can change how its
  neighbour is read. The fuzzers avoid both; the editor allows them.
- The relaxed check used while the document has an error root cannot see a root
  that sits inside a comment.

## What to do next (in this order)

1. **A demo page and a real browser.** Write `demo/demo.ts` (create the editor on
   a WeScheme program, a button for block mode), bundle with esbuild, and with
   Playwright measure on 3000 lines: time to first draw, time per operation
   including layout, and how many widgets CodeMirror builds while scrolling. This
   is the one measurement that can still sink the idea. Record the bundle size
   against today's 400 KB (React) and 215 KB (Preact).
2. **Focus in a real browser.** Repeat the focus cases of `spec/view.test.ts`
   (operation inside, in the parent, in a later root, in an earlier root on the
   same line, undo) with real focus, and check the restore is not visible as a
   flicker or announced twice by a screenreader.
3. **Keyboard and editing** in `src/interact.ts`: arrow keys through the tree,
   Delete, Enter to edit a literal in place, insert at a gap, all through the
   three operations. This is where it becomes clear whether the small API is
   enough.
4. **Guard the lexer** against the hanging inputs before anyone types into it.
5. Only then: relative offsets, exact undo, comments as nodes, a second language
   (which would also test whether `settle` can be skipped for languages whose
   kinds do not depend on neighbours).

## How the work was done

The design and the contract (`types.ts`) were written first; three Sonnet agents
then built the model, the renderer (in parallel, on separate files) and the
CodeMirror 6 layer against it, each with a seeded fuzzer and an oracle as part of
its brief. Their reports were checked by running the suite and the typecheck
here; the code itself was not read line by line.

## Second idea: take the tree from CodeMirror 6's own Lezer parser

Asked by the owner after the first stop: could the blocks be built from the
Lezer tree CodeMirror 6 already makes, so that any language with a Lezer grammar
gets blocks without work on that language's parser? Does a language then reduce
to a table and a handful of rules?

Reasoning before trying it (not yet tested when this was written):

- Lezer would REPLACE the per-language reader (`wescheme.ts`), `settle` (an
  incremental parser already notices when the text changes what a form is),
  `reparseChange` (it already reads again only what changed: the earlier spike
  measured 0.6 ms per edit at 5,000 lines) and the "error root" (it always
  returns a tree, with error nodes). `NodeWeakMap` in `@lezer/common` can attach
  data to tree nodes that survives the reuse of unchanged subtrees, which is how
  unchanged blocks could keep their identity and DOM.
- It would KEEP the renderer, the three operations and the oracles.
- It would NOT give, for free:
  - meaning. A Lezer tree is concrete: node types and positions, no named slots,
    and wrappers and punctuation among the children. A per-language table has to
    say which node types are blocks, which children are slots, which are lists,
    and what each is called aloud. Every node as a block works but is noisy.
  - writing. Lezer parses; it does not print. Inserting or deleting a block needs
    the language's separators (commas, semicolons, and indentation in Python).
    Moving existing source text is mostly generic.
  - every language. The older stream modes give tokens, not structure.

### What was tried, and what it showed

(the Lezer attempt writes its findings below as it goes)

- 2026-11-15, step 1 (grammar). `cm6-lezer-scheme-common-lang` 0.1.2 exists and
  installs (ESM+CJS, exports `parser`, `schemeLanguage`, `scheme()`). It is a
  broad Guile/Racket-ish s-expression grammar; its tree is deeply wrapped
  (`Form > Datum > List > ParenList > ListContent > Datum > AtomLike > Symbol`),
  separates `[...]` (`BracketList`) from `(...)`, and tokenises `define` as its
  own type but `if`/`lambda`/`cond` as plain `Symbol`. Usable as is.
  `@codemirror/lang-lisp` and `lezer-scheme` do not exist on npm. `@lezer/javascript`,
  `@lezer/python` installed. Code: `src/lezer.ts` (198 lines, the one adapter).
- 2026-11-15, Scheme (`src/lang-scheme.ts`, 38 lines). One rule (16 lines):
  "a list whose first symbol is define/lambda/if/cond, with the arity wescheme
  asks for, is that form; a list inside a cond is a clause". Against `wescheme`
  on 11 programs without comments, kinds, slot names, shapes and ranges are
  identical except one: a special form of the wrong arity (`(if 1 2)`) is an
  "unknown" list in wescheme and a call here (nothing in the table says "unknown"
  for it). Lost: comments only (they were never nodes).
- 2026-11-15, JavaScript (`src/lang-javascript.ts`, 37 lines, no rules). All 8
  programs come out as expected; nothing lost (`=`, `:`, `.`, brackets, `;` are
  treated as punctuation). Compromises: `let`/`const`/`var` are all drawn as
  `let` (the keyword is static in the table); a function with no body or an `if`
  with a bare statement (no Block) is not handled.
- 2026-11-15, Python (`src/lang-python.ts`, 39 lines, one rule of 5 lines: the
  separator of a `body` list is newline plus the indentation of its first
  statement). 7 programs fine; `elif`/`else` branches arrive as one flat list
  `rest` (test, body, body...), because the table cannot say "pair these up".
- 2026-11-15, renderer: no change needed for JS or Python (it draws any kind,
  keyword, and slots; the only special case is `call` + `func`). Snapshot in
  `spec/lezer.test.ts`.
- 2026-11-15, IDENTITY (most important): in a 300-statement JS program a one
  character edit in the middle, reparsed incrementally in 1.7 ms (3.9 ms for a
  full parse; small text, so only the ratio means anything), leaves 3 of 6 `Tree`
  objects shared by identity, and 0 of the 300 top-level statements are `Tree`
  objects at all: Lezer packs them in `TreeBuffer`s, which have no identity.
  `NodeWeakMap` set on the old statements was found on the new ones for 222 of
  300 (it keys buffers by position), and for 0 of those that are Trees. The 78
  that are not found are the ones in the buffer that was rebuilt. So block identity
  cannot ride on Lezer: unchanged blocks must be found by range matching, as
  `reparseChange` does today (or by a table-driven comparison of old and new
  block trees).
- 2026-11-15, editing: insert and remove in a list slot, done as a text change from
  node ranges plus the table's separator, then reparse: correct for Scheme call
  args, JS call args, JS block statements and Python body statements (4 cases).
  Python needed the indentation rule (5 lines). Not covered: inserting into an
  EMPTY list (where it goes after `(` needs a rule per language), and printing a
  node that was never parsed (the adapter prints parsed nodes from their remembered
  source; a constructed node would need a template per kind).

| language | grammar source | table lines | rules (count, lines) | what the table could not express | what was lost |
|---|---|---|---|---|---|
| Scheme | cm6-lezer-scheme-common-lang 0.1.2 | 38 | 1, 16 | head-symbol decides kind (that is the rule); wrong-arity forms as "unknown" | comments |
| JavaScript | @lezer/javascript | 37 | 0, 0 | let/const/var; if without braces; empty-list insertion | nothing |
| Python | @lezer/python | 39 | 1, 5 | pairing elif tests with bodies; empty-body insertion | nothing |

Answer to the owner. Evidence: for three languages, a table of 37-39 lines plus
one 198-line generic adapter produced the expected blocks, exact ranges, nothing
lost but comments, and correct text edits; Scheme needed one 16-line rule, Python
one 5-line rule, JavaScript none; the renderer did not change. Also evidence: the
Lezer tree cannot carry block identity (statements live in buffers), so the
incremental part (`reparseChange` or similar) stays. Judgement: yes, a language
is mostly a table plus a handful of small rules, for languages whose grammar
already says what we want; the open cost is in what these tests did not touch
(printing new nodes, empty lists, error recovery quality, slot semantics such as
elif pairs, and the accessibility wording), which I expect to be where each
language's real work goes.

## Where to pick up (written 2026-11-15, when the usage limit stopped the work)

The owner's direction after the Lezer result: "Let's see how far we can push it!
I'm not as concerned with micro-compatibility with the CM5 version right now: it
should work similarly, but need not work identically." Nothing below is started.

1. **Make Lezer the source of the tree in the editor.** Today `view.ts` runs on
   the hand-written `wescheme.ts` with `settle` and `reparseChange`. Replace
   that path: CodeMirror's incremental Lezer tree is read through
   `lezerLanguage(parser, table)`, and after each transaction the block tree is
   rebuilt only for the top-level nodes whose range changed, keeping the old
   `BNode` objects for the rest by range matching (Lezer gives no identity for
   statements: see the identity finding above). `settle` should then not be
   needed. Keep `checkEditor` and the fuzzers as the oracle.
2. **A demo page and a real browser**: `demo/demo.ts` with a language picker
   (Scheme, JavaScript, Python), bundled with esbuild; Playwright for time to
   first draw, time per edit with layout at 3000 lines, focus cases, and the
   bundle size against 400 KB (React) / 215 KB (Preact) today.
3. **Keyboard and editing** (`src/interact.ts`): arrow keys through the tree,
   Delete, Enter to edit a leaf in place, typing at a gap, all as text changes
   computed from node ranges and the table's separators.
4. **What the tables do not yet cover**: writing a node that was never parsed (a
   block from a toolbar), inserting into an empty list, broken input, slot
   meaning the grammar does not give (`elif` pairs), words for screenreaders.
   Each of these says how much a language really costs beyond its table.
5. Guard or replace the vendored WeScheme lexer's hanging inputs (only matters
   if `wescheme.ts` is kept; with Lezer it is not used).

## Pushing it further (2026-11-15, late)

Owner's direction: see how far it goes; need not match CM5 exactly. Order of work:
the Lezer editor, a demo page, keyboard and mouse, real-browser measurements, then
what the tables cannot do yet. Running table (evidence = a test or measurement;
"judgement" = mine):

| step | done? | lines added | what it showed | what did not work |
|---|---|---|---|---|
| 1 Lezer editor | yes | `src/lezer-view.ts` 464, spec 231, +25 in lezer.ts/render.ts/tables | see below | see below |
| 2 demo page | yes | demo.ts 110, index.html 36, css +45, e2e smoke | runs in Chromium for all three languages | bundle is bigger than React's 400 KB (below) |
| 4 real browser | yes | measure.e2e.ts 150, keys.e2e.ts 100 | numbers below; every key works in Chromium in all 3 languages | Scheme edits cost about 4x JS/Python (cause not isolated) |
| 3 keys and mouse | yes | interact.ts 260, spec 190, +3 table lines | every key works in jsdom for all three languages with only `insertText` / `removeNode` / `replaceText` | not tried in a real browser yet; see below |

### Step 1: `createLezerBlockEditor` (`src/lezer-view.ts`)

- Design: one `StateField` holds the Lezer tree (incremental reparse with
  `TreeFragment.applyChanges`/`addTree`, no @codemirror/language), the block roots
  and the root decorations. Every document-changing transaction runs the same path;
  block edits (`insertText`, `removeNode`, `replaceText`) are plain text changes from
  `insertChange`/`removeChange` dispatched as one-undo-step transactions. No `settle`,
  no own-operation path. `view.ts` is untouched. `RootWidget` is reused by import.
- Evidence: `npx jest packages/cm6-blocks` 136 tests; fuzzer (60 seeds x 25 steps per
  language, random text edits including broken syntax, inserts, removes, undo, redo)
  with `checkLezerEditor` after every step: live blocks == fresh parse (kinds, slots,
  values, ranges), decorations == roots, live DOM == fresh drawing. Also run once at
  800 seeds x 25 steps per language (20,000 steps each), clean.
- Finding 1 (important): reusing an old root because its range (mapped) and text are
  unchanged is NOT safe. The fuzzer found two ways a root with identical range and
  text parses differently: (a) it contains a Lezer error node, whose recovery depends
  on text outside it (zero-width error nodes move); (b) text AFTER it changes what is
  inside it (Python: an inconsistent dedent after a `while` adds an error node at the
  end of its body). The rule now used: keep a root only if its key (table row) is the
  same, it contains no error node, and no change touches it or either neighbour
  (changes in the gap between two roots affect both). So an edit rebuilds 2 or 3
  roots, not 1. Cost: slightly more rebuilding; benefit: the oracle is clean.
- Finding 2: aria-posinset/setsize of root elements change when roots are inserted or
  removed; kept roots need `renderer.renumberSlot` (new, 3 lines in render.ts), called
  whenever the set of roots changes.
- Size of changed roots, measured in the fuzzer (60 seeds x 25 steps, tiny programs):
  rebuilt roots average 5.0 (Scheme), 6.5 (JS), 5.6 (Python) nodes, maximum 36, 43,
  38. Per step 2.3 / 2.4 / 2.9 roots were rebuilt. Within a changed root everything is
  rebuilt (no node-level reuse), as the brief said; the focus snapshot is by node,
  falling back to the node at the mapped position.
- Divergence between an incremental and a fresh parse: the checker counts documents
  where the editor equals its OWN incrementally reparsed tree but not a fresh parse
  while Lezer error nodes exist. Count in the fuzz runs: 0 (so in these runs Lezer's
  incremental parse always agreed with a fresh one).
- Caveat (design, not measured): the field mutates BNodes in place (positions of kept
  roots), so a state made by `state.update` and thrown away has already changed them.
- Positions are still absolute; kept roots after an edit are shifted by walking them.
- The tables gained `roots: "\n"` as the separator for top-level insertion and an
  exported `table`/`parser` each (`schemeTable`, `schemeParser`, ...), one line each.

### Step 2: the demo page (`demo/index.html`, `demo/demo.ts`)

- `npm run build -w @bootstrapworld/cm6-blocks` (esbuild, iife, sourcemap, the CSS
  is imported as text and injected) and `build:min`. Output `demo/demo.js` and its map
  are git-ignored. A language picker, a block-mode checkbox, "Load a big document"
  (the sample repeated to about 3000 lines) and "Load the sample"; `window.demo`
  exposes the editor for the browser checks.
- To keep the bundle free of WeScheme's lexer, `makeNode`/`nextId` moved to
  `src/node.ts` (wescheme.ts re-exports them).
- Evidence (opened in Chromium through Playwright, `e2e/smoke.e2e.ts`, no console
  errors): all three languages draw blocks; screenshots in `e2e/screens/`.
- Bundle size, minified, ONE page with all three languages and the editor:
  **444,741 bytes (434 KB), 153,873 bytes (150 KB) gzipped**. Today: 400 KB (React), 215 KB (Preact,
  "lite"). By package (bytes in the minified output): @codemirror/view 152 K,
  @lezer/javascript 78 K, @codemirror/state 47 K, @lezer/python 38 K, @lezer/lr 27 K,
  @codemirror/commands 23 K, our own code 22 K, @lezer/common 21 K,
  @codemirror/language 16 K (pulled in by the grammars), scheme grammar 8 K. So the
  three grammars are about 124 K of the total; with one language the page would be
  about 310 K, and a Scheme-only page about 200 K. Judgement: not smaller than the
  React build for three languages; comparable to Preact for one. The CM5 build also
  carries CodeMirror 5 itself, which this figure for React/Preact may or may not
  include; I did not check what those two numbers contain.
- Layout (judgement, from the screenshots): JS and Python statements stack in a
  column with indented bodies after 45 lines of CSS (`.blocks-block`, `.blocks-body`,
  top-level widgets as blocks). Visible table gaps, not fixed here: JS `for ... of`
  with an array shows `...` for the iterable (the table takes `VariableName#0` only),
  JS assignment hides `=` and a member call shows the object and property as two
  blocks, Python `print(...)` shows `print` as a block.

### Step 3: keyboard and mouse (`src/interact.ts`, wired into the Lezer editor)

- Evidence: `spec/interact.test.ts`, 11 jsdom tests per language (33): click focuses a
  block; ArrowDown/ArrowUp walk every block in document order and stop at the ends;
  ArrowRight goes to the first child, ArrowLeft to the parent (a root stays);
  Delete and Backspace remove a list element; Delete in a "one" slot puts the
  language's blank; Enter edits a leaf in an `<input>` placed in the block (Enter
  commits by replacing the node's text, Escape cancels, the DOM equals a fresh drawing
  afterwards); text that does not parse cleanly (`(((`, `2 +* (`) is accepted and the
  oracle stays clean; Ctrl-] / Ctrl-[ open the box for a sibling after / before; a
  click on a gap opens it there; Ctrl-Z / Ctrl-Shift-Z undo and redo through CodeMirror's
  history; focus lands on a block after a delete. All edits go through the same three
  text-change methods, so each is one undo step. 169 tests in the package pass.
- Blank texts chosen (a `blank` field in each table, one line): Scheme `...`
  (WeScheme's own hole), Python `...` (Ellipsis is a valid expression), JavaScript
  `undefined` (a valid expression; `...` is not). Judgement: for JS a "named hole"
  would be better for a person but is not valid code; deleting an operator of a
  binary expression leaves `a undefined b`, which Lezer reads as an error. Looseness
  is accepted here, as asked.
- Design points worth knowing: widgets tell CodeMirror to ignore events inside them,
  so the keys are handled by one capturing listener on the editor's DOM (the key map
  of CodeMirror never sees them; hence undo and redo are called by hand). The edit box
  is a real `<input>` put INSIDE the block's own element (the root's element for a
  root), never into a CodeMirror line, and it is removed before the change is
  dispatched; blur cancels. Focus is given back to the anchor block before dispatch so
  the editor's focus restore (by mapped position) takes over.
- Not done / known: a blank in a "one" slot that the TEXT lacks (e.g. `(define x)`)
  is zero-width at the end of its owner, so editing it inserts after the closing
  bracket (wrong place); insert into an empty list is not possible (`lastError` is
  set; step 5a); the box for a sibling of a ROOT is inside the root's element, so it
  looks attached to the block rather than between lines.

### Step 4: real Chromium (Playwright, `e2e/measure.e2e.ts`, `e2e/keys.e2e.ts`)

Run: `npx playwright test -c packages/cm6-blocks/e2e/playwright.config.ts` (builds the
minified bundle, serves it on 8177, stops the server at the end). Raw numbers:
`e2e/results.json`, `e2e/keys-results.json`; screenshots of the 3000-line documents in
`e2e/screens/`. One run each, headless Chromium, 1100x800, this laptop: treat as
orders of magnitude, not benchmarks. All of this is measurement unless marked judgement.

| | Scheme | JavaScript | Python |
|---|---|---|---|
| lines / roots / nodes | 2751 / 1250 / 13750 | 2821 / 940 / 11092 | 2773 / 1155 / 13398 |
| navigation to first blocks in DOM (page clock) | 88 ms | 66 ms | 70 ms |
| ... to after first frame | 94 ms | 72 ms | 75 ms |
| create editor (parse + build + first draw) | 64 ms | 43 ms | 48 ms |
| root widgets built at load / roots in DOM at once | 36 / 15 | 36 / 9 | 60 / 10 |
| one edit (remove a block), sync incl. forced layout, near top / middle | 9.8 / 9.2 ms | 2.5 / 3.5 ms | 2.2 / 1.9 ms |
| same, to after next frame | 16.5 / 16.8 ms | 16.5 / 16.7 ms | 16.4 / 16.8 ms |
| undo, to after next frame | 16.6 / 16.6 ms | 16.6 / 16.8 ms | 16.9 / 16.7 ms |
| scrolling top to bottom: widgets built / max roots in DOM at once | 1861 / 39 | 1603 / 23 | 1999 / 25 |

- The "to after next frame" figures sit at one 60 Hz frame (16.6 ms): the edit fits
  inside a frame; the sync figure is the real cost. Median of 7 repetitions each.
- Only the viewport is built: 9 to 15 roots of about 1000 at load; scrolling builds
  about 1600 to 2000 widgets over the whole document (a widget is rebuilt when a root
  scrolls back in), never more than 39 roots in the DOM at once. (The earlier worry that
  CodeMirror's layout would not stay small with thousands of widgets did not show.)
- Scheme edits cost about 4x the others. In the editor's own timers (34 reparses,
  includes the focus cases): parse 19 / 36 / 23 ms in total, everything else in the field
  update 296 / 36 / 33 ms. So for Scheme it is not Lezer's parse but our matching and
  building; likely the Scheme kind rule (it walks the list's items for every candidate)
  run for every top-level node on every edit, but I did not profile it. Judgement.
- Focus (a block is focused, then an edit is made; "restores" = times the editor had to
  give focus back; focus was always on a block afterwards, never on the page body):
  - edit inside the focused block's parent: block rebuilt, focus restored to the block at
    the same place, 1 restore (all three languages).
  - edit in a later root, in an earlier root, undo of either: focus untouched, 0
    restores, same block (Scheme and Python). JavaScript: this run is NOT a valid
    test of those cases: only one root in view had a list (`inViewWithLists: 1`), so
    earlier, middle and later were the same root and every case edited it; focus
    held with 0 restores except for the first case (1). Not repeated.
  - removing the focused block: 1 restore (Scheme, Python); 0 in JavaScript (same caveat).
  - Not measured: whether the restore flickers or is announced twice by a screenreader.
- Keyboard in real Chromium (real key presses, all steps passed in all three languages):
  click focuses a block; ArrowDown/ArrowUp/ArrowLeft/ArrowRight move as specified; Enter on
  a leaf shows the box, typing and Enter replace the text (`1` became `77`), Escape cancels;
  Ctrl-] adds a sibling after (`77 55`); Delete and Backspace remove; Ctrl-Z / Ctrl-Shift-Z
  undo and redo and keep focus on a block; a click on a gap opens the box and commits.
  What does not work or is odd: after Delete in JS/Python focus lands on the call's head
  (`g`) rather than the next argument, because the restore picks the deepest node at the
  mapped position; in Scheme it lands on `(g 2)`. Judgement: arguably wrong for JS/Python.
- Bug found by the first run of the measurement and fixed in the script, not the editor:
  using a node object from before an edit (its root had been rebuilt) gave wrong
  ranges and a corrupt document. An API that takes node objects across edits has this
  trap; edits should probably take a (root index, path) or be refused when the node is
  no longer in the tree (not done: `removeNode` does not check `doc.byId`).

### Step 5a: insert into an empty list

- `insertEmptyChange` (lezer.ts, 12 lines, ONE generic rule, 0 lines per language):
  insert before the closing bracket of the owner, padded with a space unless the
  character before is whitespace or an open bracket. Tests (7 cases, jest): Scheme `(f)`
  and `()`, JS `f()`, `{}`, `[]`, Python `f()`, `[]` give `(f 5)`, `(5)`, `f(5);`,
  `{5}`, `[5];`, `f(5)`, `[5]` and pass the oracle. Impossible: a Python body (no closing
  bracket; the insert throws "has no closing bracket"), as is any list whose owner ends
  without a bracket. A real block would also want newlines and indentation inside `{}`;
  not done (a per-language template, see 5b). The keyboard (box on a gap of an empty
  list) now works for the same cases because it calls `insertText`.

### Step 5d: broken input (`spec/broken.test.ts`, measurement)

A five-statement program with a closing bracket missing in the second statement
(`(b 2` / `b(2;` / `b(2`), roots as the adapter gives them:

| language | roots (good -> broken) | what became of the ones after the break |
|---|---|---|
| Scheme | 5 -> 2 (`call`, `call` with an error inside) | all three later forms are swallowed as children of the unclosed one: blocks after the break are lost as roots, and the whole tail is drawn inside one broken block |
| JavaScript | 5 -> 5 (one statement has an error inside) | Lezer recovers at the `;`: all later statements stay clean blocks |
| Python | 5 -> 4 (one with an error, one error root) | one later statement is eaten by the error, two survive |

Judgement: how much survives is Lezer's grammar and error recovery, not our code; Scheme
(no statement terminator) is the worst case, and a per-language rule that closes an
unbalanced list at the next line starting at column 0 would be needed for it.
The editor itself handles all of these without special code (fuzzer text edits made such
input constantly). Lezer's incremental tree and a fresh parse agreed in every fuzz run.

### Not done in this session

- 5b (templates for blocks that were never parsed, toolbar) and 5c (`describe`
  templates per row): not started. The notes above give the cost of everything else.
- No flicker or screenreader check of the focus restore; no Preact comparison.

## Second round (2026-11-16): bugs, templates, table gaps, describe, comments

Same section style; running table at the end of this round. Evidence = test or measurement.

### A1: stale nodes are refused
- `removeNode`, `replaceText` and `insertText` (checks the slot's owner) now THROW
  `node N (kind) is no longer in the tree`, decided by `doc.byId`; nothing is dispatched.
  Test first (3 failed before, `spec/fixes.test.ts`), passes now in all three languages.
  Throwing, not returning false, so a caller cannot ignore it.

### A2: a missing "one" slot is filled where it belongs
- Before (test failed, 4 of 5 cases): the zero-width blank sat at the owner's END, so
  `return;` + "5" gave `return;5`. Now the blank is placed after what the earlier slots
  hold (else after the keyword, else after the opening bracket), and writing into it adds
  a space where the text would stick together. A table slot may say `before` (the
  connector): JS `let x;` needs ` = ` before the value (1 field on 1 slot). Tests: JS
  `return;`, `let x;`, Python `return` (nested and top-level) now give `return 5`,
  `let x = 5;`, etc. and the oracle passes.
- Judgement: the connector is the first thing a pure "slots and separators" table could
  not say; it costs one field, but every construct with punctuation between its parts
  (JS `for (x of y)`, Python `x = `) will want one when its part is missing.

### A3: focus after Delete
- Test first (3 failed): focus landed on a parent or the call's head. Now `removeNode`,
  when focus is on the node or inside it, finds the owner again by (range start, kind),
  its slot by name, and focuses the node now at the same index, else the one before,
  else the owner. Same code for every language. Tests: `f(1, g(2), 3)` delete `1`
  -> `g(2)`; delete `3` -> `g(2)`; delete the only argument `4` -> the call (`h()`).
- Side fix found by it: removing the only element of a list left a blank (`(h )`); it
  now also removes the blanks before it on the same line (`(h)`, `h()`), but never a
  line's indentation.

### A4: why Scheme edits cost 4x (profiled, fixed)
- Measured with timers on the 3000-line Scheme document (one inserted space, mean of 20):
  incremental parse 0.6 ms; collecting the top-level candidates (`fromTree` keeping every
  root) **9.2 ms** with the table's `kind` rule, 0.39 ms with the rules removed. The
  JS and Python numbers for the same step: 0.10 and 0.08 ms. So the cost was OURS, in the
  Scheme rule, not the grammar's deep wrapping (a full walk of all 62,001 Lezer nodes is 1.6
  ms; the top-level children walk is 0.05 ms).
- Cause: the "is this a clause of a cond" check climbed four parents and, for a
  top-level form, landed on the program node and asked it for its list items, which scans
  all 1250 children: quadratic per edit. Fix: 1 condition (the parent must be a list) and
  read the head symbol before counting items. Collect now 1.4 ms (the remaining ~1 ms is the
  rule's first-symbol check; a deeper wrap costs about 1 ms per 1250 top-level forms).
- In Chromium (same document): edit near top / middle, synchronous with layout, 9.8 / 9.2
  ms -> 3.0 / 2.5 ms; total time in the field update over the run 296 ms -> 52 ms.
  JS 2.8 / 2.7 ms, Python 2.5 / 1.8 ms. Judgement: a table rule that looks at the tree
  must not walk siblings; this trap is easy to fall into and invisible in small tests.

### A5: the focus cases redone with different roots (Chromium, 3000 lines)
Focus is on the first argument of a call in a root in the middle of the document; "later"
and "earlier" are the nearest roots with a list, 4 or more roots away; restores = times the
editor gave focus back; all cases ended with focus on a block. `e2e/results.json`.

| case | Scheme | JavaScript | Python |
|---|---|---|---|
| edit in the focused block's parent | restored, same place (1) | 1 | 1 |
| edit in a later root | not touched (0) | 0 | 0 |
| edit in an earlier root | 0 | 0 | 0 |
| undo of an edit in an earlier / a later root | same block, 1 restore each | same, 1 each | same, 1 each |
| remove the focused block | next/previous/parent, 1 | 1 | 1 |

- The first version of these cases was wrong for JavaScript (only one root in view had a
  list) and, after fixing that, showed a REAL bug for Python: after undo of an edit above,
  focus was lost (`activeElement` = body). Cause: CodeMirror's undo scrolls to the old
  selection, which for block edits is the top of the document (scroll shift -76,396 px);
  the focused block left the drawn viewport and its element was removed. Fix (in the
  editor's `dispatchTransactions`): after an undo or redo, scroll to the first changed
  position (`scrollIntoView(nearest)`) and restore focus. Now focus survives in all three
  languages (the restore runs once per undo: the element is moved when the line is redrawn).

### B: writing blocks that were never parsed (templates)
Question: does a language stay "a table and a handful of rules" once blocks must be WRITTEN?

- A table gets `templates: { name: { text, kind, stmt? } }` with `${hole}` holes (each
  becomes the table's blank; `${name|text}` shows `text` where the blank is not valid),
  `statementSlots` (which list slots take statements) and `statementSuffix` (JS `;`).
  The editor's `insertTemplate(name, anchor)` writes it after the anchor (or the nearest
  ancestor that sits in a list that takes it: a statement template skips out of an
  argument list; an expression template inside a statement list gets the suffix), indents
  continuation lines to the anchor's line, focuses the first hole and opens its edit box;
  typing a character on a focused hole (blank) starts the box with that character. The
  demo has a toolbar of the language's templates (`mousedown` is prevented so the block
  keeps focus).
- Templates per language: Scheme 11 (variable, function, lambda, call, if-else, cond,
  number, string, boolean, char, symbol), JavaScript 10 (variable, function, call,
  if-else, while, for-of, return, number, string, array), Python 10 (variable, function,
  call, if-else, while, for-in, return, number, string, list). Lines of table: see the
  summary table at the end of this round (about 12 per language, plus 2 to 3 for
  statementSlots / suffix / separator rule).
- Evidence (`spec/templates.test.ts`, 99 tests): every template of every language is
  inserted at (a) top level, (b) after the statement in a function body, (c) after the
  statement in an if body (Scheme: after an argument inside the body, because Scheme has no
  statement lists: the body is one expression); the result has no root with an error
  node, contains a block of the kind the template names, passes `checkLezerEditor`, has the
  first hole focused in its box, and typing replaces the hole. All 290 package tests pass.
  In Chromium (keys.e2e.ts): click a block, click the `if-else` button, type a condition,
  Enter: `(if cond1 ... ...)`, `if (cond1) {...}`, `if cond1:` appear with the right roots.
- Findings (the answer to the question, as far as it goes):
  - Indentation was NOT per-language: one generic rule (indent of the anchor's line, applied
    to the template's continuation lines) plus the one shared `lineSeparator` rule that Python
    already needed, now used by JavaScript too (1 line each in the tables). Nested Python
    bodies work because the indent comes from the line of the anchor statement.
  - The blank is not a universal hole. Python `def ... (...)` and `for ... in` are not valid
    code, so those holes need a placeholder (`${name|func}`): a few characters in 3 templates.
    JavaScript's `undefined` happens to be a valid identifier and expression everywhere used.
  - A hole that is a blank is a LITERAL block in all three languages, which needed the table to
    know it: Python had no node for `...` (added `Ellipsis`, `Boolean`, `None`: 3 lines).
  - Not expressible / not done: a template into an EMPTY Python body (no closing bracket; the
    body of a freshly written `def` is a hole, so it works, but a hand-written `def f():`
    with no statement cannot take one); JS statements land in `{ }` on separate lines only if
    the block was multi-line; Scheme has no loop template (recursion); no template for
    `class`, `import`, lambda/arrow in JS and Python, dict/object (see C). An expression
    template inserted after a statement in Python becomes an expression statement.
    A kind check by the tests is only "a block of that kind exists after", not "exactly this
    block was added".

### C: the table gaps, with a larger program per language (`demo/samples.ts`)
A "constructs" sample per language (comments, imports, classes, strings, nested calls,
lambdas/arrows, list and dict/object literals, return, loops, member access, unary and
boolean operators) was read, the characters no leaf block carried were listed, and the
tables extended until what is left is only keywords drawn by `keyword`. Changes, in table
lines (JS +17, Python +17, Scheme +6) and 25 lines of adapter/renderer:
- generic additions (adapter): `opaque` now works for nodes with children (it only did for
  leaves): a construct we do not model is drawn as its own text, one block, not as noise;
  a slot may carry `before`, now also DRAWN as glue between slots (`=`, `of`, `in`, `.`;
  `Slot.glue`, 5 lines in the renderer); `keyword: "$first"` draws the node's own first word
  (JS `const` / `let`, which were all shown as `let`); `topLevelOnly` rows.
- JavaScript: `=` shown (declarations, assignments), `+=` as `UpdateAssign`, `for (... of ...)`
  now takes the ARRAY or any expression as the iterable, classic `for(;;)`, `class` / class body
  / method, `this`, `true/false`, `null`, unary and logical operators, `x.y` as a member block
  with `.` between, `x[0]` as an index block (a `kind` rule, 3 lines, shared by Python).
  Opaque (one block of plain text): arrow functions, function expressions, template strings,
  `?:`, `import`/`export`, `new`, `await`, `i++`.
- Python: `=`, `in`, `.` shown; `and/or/not/in/is` as operator blocks (a `kind` rule for tokens
  that are also keywords elsewhere, 3 lines), `+=`, `class`, `lambda`, `pass/break/continue`,
  `x.y`, `x[0]`, `...`, `True`, `None`. Opaque: `import`, dict, tuple, comprehensions, `if`-else
  expressions, f-strings, `await`, `yield`. Still flat: `elif`/`else` branches (a list `rest`).
- Scheme: quote, quasiquote, unquote as a block with the mark as its keyword (`'(1 2 3)` used
  to look like an ordinary call: noise), vectors. `let` and `(quote x)` stay ordinary calls;
  its `[a 1]` pairs are call blocks (readable, not named).
- Where the table ends: Scheme 63 lines of file (14 in `nodes`, 11 templates, 1 rule of 15),
  JavaScript 81 (37 `nodes`, 10 templates, 1 rule of 7), Python 73 (32 `nodes`, 10 templates,
  1 rule of 7).
- Still falls through to plain text or noise: comments INSIDE a block are hidden (the
  root's widget covers them; only top-level comments are blocks, see E); JS arrow functions
  and template strings, Python dicts/tuples/comprehensions are one opaque block each; JS
  object methods and getters, destructuring, spread, default parameters, `try/catch`,
  `switch`, `async` (the word is dropped) are read as whatever blocks happen to be inside, or
  as nothing; Python `elif`/`else`, `try/except`, `with`, decorators likewise; the third word
  of `class C(B)` (the base) is dropped from the drawing (the text keeps it). I did not
  measure how many of these a larger real program hits.
- Screenshots retaken from the constructs sample: `e2e/screens/*.png` (top of the document).
- Evidence: package tests 290 pass (two inline snapshots updated because the renderer now
  draws `=` and ids shifted); the earlier fuzzers (60 seeds x 25 steps) still pass.

### D: `describe` templates (spoken labels)
- A row may carry `describe: "call to ${func} with ${args.length|argument|arguments}"`:
  `${slot}` is the slot's content (a leaf's text, else a shortened source), `${slot.length}`
  its count, `|one|many` picks singular or plural, `${value}` the node's own text. 20 lines
  of adapter. Rows without one keep the old default ("call with 1 func, 2 args").
  Cost in table lines (one `describe: "..."` added to an existing row): Scheme 6 rows,
  JavaScript 11, Python 10.
- Bug found on the way: the default label of a leaf was the label of the FIRST row of its
  kind, so every JS/Python name was spoken as "number f". It now uses the row it was built
  from (`keyOfNode`), tested ("a leaf is named by what it is"). The old snapshot showed it.
- Ancestors' labels update: the editor rebuilds a changed root whole, so every label in it
  is new; the test (`spec/describe.test.ts`, 6 tests) deletes an argument and sees the call
  go from "call to g with 3 arguments" to "... 2 arguments" and the enclosing `return g(2,
  3)` follow, in all three languages, with the oracle (DOM equals a fresh drawing) clean.
  Labels of blocks OUTSIDE the changed roots do not change, which is right for a root whose
  content did not change.
- Not done: the spoken text is English only; `${slot}` of a compound child is its raw source,
  not its own description (a long argument is cut at 28 characters).

### E: comments
- What each grammar does (evidence, from the raw trees): comments ARE nodes in all three Lezer
  trees: Scheme `LineComment` / `BlockComment` (direct children of the program, also inside
  lists), JavaScript `LineComment` / `BlockComment` (also inside blocks), Python `Comment`.
  The first comparison lost them because the table did not name them.
- Cheap version, done: a comment row marked `topLevelOnly`, so a comment BETWEEN top-level
  statements is a block of its own (italic, grey) in all three languages. Cost: 1 table line
  per language (2 for Scheme and JavaScript, which have two kinds), 1 row flag and 4 lines in
  the adapter's `collect`. It can be edited (Enter), removed, and written around like any root
  (`spec/comments.test.ts`, 9 tests; the fuzzers already throw `; c`, `//c`, `#c` at the text).
- Why only top level: inside a block or list a comment would count as one of its children
  (the `#n` positions and the slots shift: `(define x ; c\n 5)` would read the comment as the
  value). Comments inside a root stay in the text, hidden by the root's widget: a comment in
  the middle of a function body is not drawn. Showing those needs the adapter to look through
  comments when it numbers children, and a place to draw them (a gap-like line): not done.

## Summary of the second round

| step | done? | what it showed | what did not work |
|---|---|---|---|
| A1 stale nodes | yes | edits throw `no longer in the tree`, nothing dispatched (test) | callers must look nodes up again |
| A2 zero-width blank | yes | blank sits where the node would go; `before` connector (1 field) | every punctuated construct will want a connector |
| A3 focus after Delete | yes | next/previous/parent, one generic rule (test, all 3 languages) | |
| A4 Scheme cost | yes | OUR rule scanned all roots per root (9.2 ms of collect -> 1.4 ms; browser edit 9.5 -> 3 ms) | the grammar's deep wrapping costs about 1 ms per 1250 forms |
| A5 JS focus cases | yes | valid now; found and fixed: undo scrolled to the top and dropped focus | |
| B templates | yes | 99 tests insert every template at 3 places with no error node | blank is not a valid name; empty Python body; no loop in Scheme |
| C table gaps | yes | one larger sample per language; glue words, opaque, class, member | a long tail (try/except, switch, dict as pairs, elif pairs, arrows) |
| D describe | yes | 27 `describe` strings; ancestors' labels follow (test) | English only; long children cut |
| E comments | yes | comments are Lezer nodes; top-level ones are blocks for 1 to 2 lines per language | comments inside blocks hidden |

Package: 305 jest tests, `tsc` clean; Chromium (`e2e/`): 9 tests pass (smoke, measurements, keys).
Chromium after this round (3000 lines): first blocks in the DOM 80 / 68 / 74 ms (Scheme / JS /
Python); a block edit, synchronous with layout, 3.4 / 2.9, 3.3 / 3.5, 2.9 / 2.6 ms (top / middle);
at most 37 / 22 / 21 roots in the DOM at once. Bundle not re-measured.

### Lines per language (what a language costs now)

| language | grammar | file lines | `nodes` rows | rules (lines) | templates | describe | what is still not expressible |
|---|---|---|---|---|---|---|---|
| Scheme | cm6-lezer-scheme-common-lang | 63 | 14 (plus quote/vector/comment rows) | 1 kind rule (about 18) | 11 | 6 | wrong-arity special forms as "unknown"; `let` pairs; comments inside forms; no statement/loop templates |
| JavaScript | @lezer/javascript | 81 | 37 | 2 (kind rule 7, separator 1 shared) | 10 | 11 | arrow functions, template strings, `?:`, `try`, `switch`, destructuring (opaque or noise); `{}` formatting of an empty block |
| Python | @lezer/python | 73 | 32 | 2 (kind rule 7, separator shared) | 10 | 10 | elif/else pairing, dict pairs, comprehensions, `try`, `with`, decorators; empty body; blank as a name |

(The `nodes` figure counts the `describe` strings, which sit on the rows. The generic
adapter, editor and keys are about 1,150 lines (`lezer.ts` 326, `lezer-view.ts` 580,
`interact.ts` 247) and are shared.)

### Does a language really reduce to a table and a handful of rules? (revised answer)

Evidence (tests and measurements above):
- READING: yes. Three languages, 63 to 81 lines each, produce blocks with exact ranges, correct
  edits, the oracle clean in the fuzzers, and a larger sample per language drawn with only
  keywords unaccounted for. Each language needed 1 or 2 small rules (a head-symbol rule in
  Scheme; the indentation separator and a `kind` rule for `x[0]`, `for..of`, `+=`, keyword
  operators in JS and Python).
- WRITING: yes, with one more mechanism than reading needed. Templates (about 10 lines per
  language) insert at the top level, in a function body and in an if body for every template
  in every language with no error node; indentation was one generic rule, not per language.
- SPEAKING: yes: one string per row (6 to 11 lines per language).
- EDITING behaviours (delete, focus, undo) needed NO per-language code once written generically.
- The things that were NOT a pure table: a connector between slots (`before`, a field), a
  placeholder where the blank is invalid (`${name|func}`), 1 to 2 `kind` rules per language
  (Lezer node names do not always say what the construct is: `x[0]` vs `x.y`, `for..of` vs
  `for(;;)`, `+=`), and a tree-walking cost trap (the Scheme rule was quadratic).

Judgement (mine, not measured):
- "A table and a handful of rules" is a fair summary for what I tried; the table is the easy
  70 to 80 percent, and the rest is a long tail of constructs (try/catch, switch, decorators,
  destructuring, pairs in dicts and elif chains) where each costs one row, sometimes a rule, and
  where the honest fallback is an opaque block of plain text. I did not measure how large that
  tail is on real programs; a corpus run would settle it.
- The language-specific effort that is NOT in the table is error recovery (Scheme loses everything
  after an unclosed bracket) and what a person wants a block to look like (CSS, wording). Those
  are per language, and not reducible to a table with the present design.
- The risk I would watch: rules and templates that look at the tree or the text are code, and the
  Scheme rule shows they can hide a quadratic cost that small tests do not show.

## Third round: real programs (2026-11-16)

Script: `packages/cm6-blocks/scripts/corpus-lib.ts` (corpus lists and the measures) and
`spec/corpus.test.ts` (gated: `CMB_CORPUS=coverage` measures only, `CMB_CORPUS=full` also
runs the oracle on 30 sampled files and times edits; `CMB_STEP=<label>` names the row written
to `e2e/corpus-results.json`). Files are read where they are; none are copied. Only result
tables (with a few 40-character snippets) are committed.

### Step 1 and 2: corpora and the measure (baseline = the tables at the end of round two)
Found locally (only inside the allowed places):
- Scheme: 11 `.rkt` files in the repo (1,931 lines); 582 programs extracted as string literals
  from the repo's tests and soak generator with a script (1,014 lines: many are one-liners,
  27 contain a Lezer error node because some are intentionally broken). Small corpora.
- JavaScript: 30 own files (3,314 lines, mostly webpack/babel/eslint config and scripts);
  200 non-minified `.js`/`.mjs` files sampled with seed 7 from node_modules (14,733 lines,
  library code); 40 `example/`, `examples/`, `demo/` files from node_modules (758 lines): the
  nearest thing to beginner-style programs.
- Python: 200 files sampled with seed 5 from the standard library of the `python3` here, which is
  Python 3.6 (90,370 lines, tests and idle_test skipped); the 21 `turtledemo` programs (2,429
  lines): beginner-style, the best local match.
- Library code is harder than what students write (decorators, try/except, many classes, nested
  expressions, tricks); the example/turtledemo groups are the closer match but are small.

How coverage is counted (judgement on the method, so read the limits): every non-space,
non-comment character is one of: REAL (a leaf value, a keyword, or punctuation of a block with
slots: the punctuation counts as real whether or not the renderer draws it), OPAQUE (a
recognised node drawn as its own text), or NOT DRAWN: dropped from a block that is drawn (the
`else` of an `if`), outside every block, or STRAY: a block built from inside a construct the
table has no row for (the `x` of `throw x` would show as a block on its own, so it is not
counted as real). A statement is "fully blocks" when none of its characters is opaque or not
drawn, "none" when none is real.

### Result tables (evidence: `e2e/corpus-results.json`, run `CMB_CORPUS=full CMB_STEP=final`)

Coverage = share of non-space, non-comment characters: real blocks / opaque text / not drawn (see the method above and its
limits). Statements = top-level statements fully blocks / partly / not at all (all statements, nested too, in the JSON).
Oracle = `checkLezerEditor` after construction and after 20 random edits (delete a block, insert a template, type text)
in a sample of 30 files (files over 1500 lines left out of this sample; every file of the smaller corpora). Final tables.

| language | corpus | files | lines | coverage real / opaque / not drawn | top-level statements fully / partly / none | oracle failures (files, edits) |
|---|---|---|---|---|---|---|
| Scheme | scheme-repo-files | 11 | 1931 | 100 / 0 / 0 | 100% / 0% / 0% | 0 (11, 220) |
| Scheme | scheme-test-literals | 582 | 1014 | 99.8 / 0 / 0.2 | 100% / 0% / 0% | 0 (30, 600) |
| JavaScript | js-repo-own | 30 | 3314 | 87.8 / 11.3 / 0.9 | 72% / 28% / 0% | 0 (30, 600) |
| JavaScript | js-node_modules-library | 200 | 14733 | 97.7 / 1.2 / 1.1 | 85% / 15% / 0% | 0 (30, 600) |
| JavaScript | js-node_modules-examples | 40 | 758 | 96.7 / 3.3 / 0 | 96% / 4% / 0% | 0 (30, 600) |
| Python | py-stdlib-library | 200 | 90370 | 98.1 / 1.3 / 0.6 | 69% / 12% / 19% | 0 (30, 600) |
| Python | py-turtledemo | 21 | 2429 | 97.2 / 2.4 / 0.4 | 73% / 8% / 19% | 0 (21, 420) |

Before (the tables at the end of round two, same measure, no glue-word credit):

| corpus | coverage real / opaque / not drawn | top-level statements fully / partly / none |
|---|---|---|
| scheme-repo-files | 87.3 / 0 / 12.7 | 87% / 13% / 0% |
| scheme-test-literals | 93.8 / 0 / 6.2 | 94% / 4% / 2% |
| js-repo-own | 32.4 / 61.8 / 5.8 | 39% / 48% / 13% |
| js-node_modules-library | 49.8 / 32.7 / 17.4 | 52% / 35% / 13% |
| js-node_modules-examples | 61.4 / 32.7 / 5.9 | 60% / 40% / 0% |
| py-stdlib-library | 75.7 / 7 / 17.3 | 39% / 40% / 21% |
| py-turtledemo | 90.2 / 5.3 / 4.5 | 46% / 35% / 19% |

Parse and build blocks per 1000 lines (all rows, `final`): scheme-repo-files 17.9 ms, scheme-test-literals 14.8 ms, js-repo-own 19.1 ms, js-node_modules-library 16 ms, js-node_modules-examples 15.5 ms, py-stdlib-library 13.5 ms, py-turtledemo 12.9 ms (jsdom/node, not a browser). Typed edit in the middle of the largest sampled file (jsdom, field update + CodeMirror update + building the root's DOM): scheme-repo-files: huge-code.rkt 776 lines 0.51 ms, scheme-test-literals: random-sequences-test.ts:1157 11 lines 1.03 ms, js-repo-own: soak.js 713 lines 1.53 ms, js-node_modules-library: core.js 618 lines 108.29 ms, js-node_modules-examples: stream-multiple.js 50 lines 7.82 ms, py-stdlib-library: __init__.py 4006 lines 3.22 ms, py-turtledemo: __main__.py 387 lines 3.62 ms.

Lezer error nodes in files the real language accepts (grammar problems, not ours): JavaScript 0 in all three corpora;
Python 29 error nodes in 10 of the 200 standard-library files and 5 in 3 of the 21 turtledemo files (the examples
seen: `n/6.` a float with a trailing dot, `(yield)` in parentheses, and zero-width errors at line starts that I did
not trace); Scheme: 27 of the 582 test literals have one (some are intentionally broken, some are CSS selectors or
JSON that the tests keep in strings: `[contenteditable=true]`), 0 in the 11 real `.rkt` files.

### The long tail made concrete: top 10 missing node types before and after

- js-node_modules-library, baseline: SwitchBody 10188; Property>Block 9493; ThrowStatement 4401; IfStatement>IfStatement 3871; CallExpression>ParenthesizedExpression 2382; SequenceExpression 2153; IfStatement>ReturnStatement 1775; IfStatement>ThrowStatement 1304; IfStatement>ExpressionStatement 1200; Block>SwitchStatement 1199
- js-node_modules-library, final: ImportGroup 1580; ForStatement>ForOfSpec 540; ImportDeclaration>from 392; ExportGroup 378; FunctionExpression>VariableDefinition 196; ForInSpec 117; ForStatement>ForInSpec 84; CallExpression>super 70; FunctionDeclaration>async 65; ExportDeclaration>from 48
- py-stdlib-library, baseline: TryStatement 107626; DecoratedStatement 41264; RaiseStatement 35866; AssignStatement>ParenthesizedExpression 23078; WithStatement 19078; ClassDefinition>ArgList 11456; ContinuedString 7469; Body>TryStatement 7272; AssignStatement>CallExpression 6982; IfStatement>else 4184
- py-stdlib-library, final: SetExpression 1705; ForStatement>Body 1240; YieldExpression 1091; ReturnStatement>VariableName 1015; ArrayComprehensionExpression>for 456; DictionaryComprehensionExpression 426; ComprehensionExpression 409; MemberExpression>BinaryExpression 323; ArrayComprehensionExpression>in 304; ReturnStatement>CallExpression 249


### The curve: table lines against coverage (strict count: glue words not credited)

JavaScript, library corpus (200 node_modules files; the example and own groups follow the same path, in the JSON):

| step | rows added (cumulative) | `nodes` lines | `rules` lines | coverage real / opaque / not drawn | top-level statements fully | all statements fully |
|---|---|---|---|---|---|---|
| baseline (round two) | 0 | 37 | 9 | 49.8 / 32.7 / 17.4 | 52% | 32% |
| + throw, switch (5 rows) | 5 | 42 | 9 | 53.3 / 34.2 / 12.5 | 52% | 35% |
| + arrow, function expr, ?:, new, await; braceless if/loops (5 rows, 5 edits) | 10 | 47 | 9 | 73.8 / 7.6 / 18.6 | 59% | 55% |
| + patterns, try/catch/finally, do, for-in, regexp, sequence (10 rows) | 20 | 57 | 10 | 78.7 / 7.6 / 13.7 | 65% | 61% |
| + labels, break/continue, class expr/fields, typeof/void (7 rows, 3 rule lines) | 27 | 64 | 12 | 88.6 / 7.9 / 3.5 | 72% | 74% |
| + import/export, yield, x++, private names, flat binary, multi-declarators (5 rows) | 32 | 69 | 12 | 97.4 / 1.2 / 1.4 | 81% | 87% |

Python, standard library (200 files):

| step | rows added (cumulative) | `nodes` lines | `rules` lines | coverage real / opaque / not drawn | top-level statements fully | all statements fully |
|---|---|---|---|---|---|---|
| baseline (round two) | 0 | 32 | 8 | 75.7 / 7 / 17.3 | 39% | 58% |
| + try, raise, with, decorators (5 rows) | 5 | 37 | 8 | 86.2 / 7.6 / 6.2 | 40% | 70% |
| + else/elif/except keywords, assert, del, global, continued strings (5 rows, 1 rule line) | 10 | 42 | 9 | 90.5 / 7.6 / 1.9 | 54% | 77% |
| + dict, tuple, comprehension, conditional, yield (5 rows) and `@before`/`@after` takes (adapter, 12 lines), flat binary | 15 | 47 | 9 | 98 / 1.3 / 0.7 | 64% | 89% |

Python, turtledemo (beginner-style, 21 programs):

| step | rows added (cumulative) | `nodes` lines | `rules` lines | coverage real / opaque / not drawn | top-level statements fully | all statements fully |
|---|---|---|---|---|---|---|
| baseline | 0 | 32 | 8 | 90.2 / 5.3 / 4.5 | 46% | 78% |
| +5 rows | 5 | 37 | 8 | 91.9 / 5.5 / 2.6 | 46% | 80% |
| +15 rows | 15 | 47 | 9 | 96.9 / 2.4 / 0.7 | 59% | 88% |

Scheme (11 files and 582 literals; tiny corpora): 2 alias rows (`TaggedParenList` for lists whose head the grammar tags, `BracketList` for `[...]` outside a `cond`) took the real files from 87.3% to 100% and the literals from 93.8% to 99.8%.

Reading the curve (evidence from the tables above; interpretation is mine):
- Every step raised "real" coverage; the biggest single steps were turning the opaque rows into real ones (JavaScript
  arrows and functions: +20 points in the library corpus, 5 rows; Python dict/tuple/comprehension/conditional: +7.5
  points, 5 rows) and `try/raise/with/decorator` in Python (+10 points, 5 rows). After about 30 rows in each of JS and
  Python the characters are 98% real; the last 2% and the last fraction of statements are where one row each buys little.
- "Not drawn" fell from 17% to about 1% in both languages. "Fully blocks" for statements is a stricter measure and
  stayed lower (JS library 85% of top-level statements, Python stdlib 69%): the shortfall is imports (opaque by choice;
  they are 19% of Python's top-level statements counted as "none"), template strings, and dropped modifier words.
- The tables grew from 37 to 69 `nodes` lines (JS) and from 32 to 47 (Python): about 1.5 to 2 times, for a coverage
  rise from 50 to 98 and from 76 to 98 percent. Whether that is "a table" is a matter of taste: the rows are still one
  line each, but there are 60 of them and they have to agree on slot positions (`#0`, `#2`).
- Caution about the number: coverage counts characters, and a row that keeps only some words of a construct still
  counts its other characters as real. A block can be "real" while hiding a word (`async`, `static`, `default`,
  `from` in `import`, `else` before the glue credit). The glue-word credit (the row draws `else`, `of`, `extends`
  itself) moves JS library from 97.4 to 97.7, so it is not hiding much. I did not count dropped modifier words
  separately.

### Constructs that need more than a row (what each needs, as far as I can tell)

Done with a mechanism, not a row (cost in lines of adapter or rule):
- Python `a, b = f()` and `for a, b in x`: slots that take by position around a token (`@before:AssignOp`, `@after:in`),
  and type takes tried before positional ones: 12 lines in `lezer.ts`; without it the value of a tuple assignment was
  dropped (`AssignStatement>CallExpression`, 7k characters in the library corpus).
- JavaScript `x[0]`, `for (k in o)` / `for (k of o)` / `for(;;)`, `+=`, object methods in literals, `typeof`/`void`/`in`
  tokens, Python `and/or/not/in/is`, keywords `else/elif/except/finally/as`: a `kind` rule line each (10 lines total):
  Lezer gives these the same node name as a different construct, or leaves the keyword as a bare token.
- Words that the row draws as glue (`else`, `of`, `in`, `extends`, `=`, `.`): a `before` string on the slot (a field,
  not a row), drawn by the renderer when the slot is not empty.

Still not expressible, or only as text (each listed with what it would need):
- Imports (`import {a as b} from "x"`, `from m import a as b`) and template strings with `${}`: kept as opaque text
  (counted as covered-as-text). A real block needs a row per node type and a way to draw a word between two blocks
  (`from`) that is a token of the parent, not a slot: the glue mechanism could do it (`before` on each slot).
- Modifier words before a construct (`async`, `static`, `export default`, `get`/`set`, `await` before `for`): the
  Lezer tree has them as bare tokens that no slot takes. Needs a `modifiers` list on the row: collect tokens in a set
  of names and draw them as keyword text. About 8 lines in the adapter, 1 line per row. Not done; counted as not drawn.
- A named function expression `function f() {}` (the name is dropped: the params slot must come after the name slot in
  draw order but the name is a `VariableDefinition` that is also what params contain): needs a rule that splits by
  position relative to `ParamList`, the same mechanism as `@before`.
- Python `elif`/`else` pairs, `try/except` clauses and dict key/value pairs are flat lists of blocks and keyword
  blocks: readable, but the pairing is not structure. Needs the table to say "pairs" or "groups of n" for a list (an
  adapter feature, about 15 lines, plus renderer support to draw a group).
- Statement groups `a = 1; b = 2` (Python `StatementGroup`), JS comma-separated `let a = 1, b = f()` (done only as a flat
  `rest` list), `with a as b, c as d`: grouping again.
- Comments inside a block: they are Lezer nodes but the numbering of children (`#n`) counts them; they need to be
  filtered out of positions and drawn somewhere. About 10 lines in the adapter; not done.
- Large single roots: a class or module-wide function is ONE root; every edit rebuilds the root (and its two
  neighbours). On the largest JavaScript file sampled (a 618-line class, one root of about 2,000 nodes) one typed
  edit costs about 108 ms in jsdom, of which 6 ms is the incremental parse and block building and the rest is
  building its DOM and CodeMirror's update (jsdom is much slower than a browser; I did not measure the browser).
  Needs node-level reuse inside a root (identity by range matching one level down): a design change, not a row.
- Error recovery: the Python grammar reports errors for `6.` and `(yield)`: not ours to fix in a table.


### Oracle failures found and fixed
- One real bug, found by the first full corpus run on `cow-game.rkt` and `ast-test.rkt` (2 of 11 Scheme files, in the
  template step of the random edits): a template inserted into a node outside the viewport opened its edit box inside a
  detached element, so a stray `<input>` showed up later and the page differed from a fresh drawing. Reduced to a
  600-line test (`spec/templates.test.ts`, "a template inserted outside the viewport leaves no edit box behind"; it
  fails without the one-line fix in `interact.ts`).
- No other failure: 0 of 182 files and 3,640 edits in the final run (plus the earlier baseline run, which had the 2
  failures above). The earlier fuzzers (60 seeds x 25 steps per language) still pass with the grown tables.
- Real programs also made two table changes necessary for the oracle's sake: the test that picks a list slot in
  `lezer-view.test.ts` now skips the new flat `rest` lists; two inline snapshots changed (binary expressions and
  assignments are now flat or list slots).


### Bundle sizes (minified esbuild, `npm run build:min` and `build:min:scheme`; was 444,741 bytes before this round)
- All three languages: 467,454 bytes (456 KB), 161,157 bytes gzipped. React build today 400 KB, Preact 215 KB.
- Scheme only (a second entry, `demo/scheme-only.ts`, with the editor and the Scheme table only): 333,588 bytes (326 KB),
  109,843 bytes gzipped. By package: @codemirror/view 152 KB, state 47 KB, our own code 28 KB, @lezer/lr 27 KB,
  @codemirror/commands 23 KB, @lezer/common 20 KB, @codemirror/language 16 KB, the Scheme grammar 8 KB.
  The estimate in round one ("Scheme alone about 200 KB") was wrong: CodeMirror 6's view alone is about half the bundle.
  Growth over round two for the three-language build: +22.7 KB (rows, glue, templates, describe strings, adapter and the
  edit-box and comment code of the earlier rounds; the grammar packages are unchanged).


### Revised answer: does a language reduce to a table and a handful of rules?
Evidence (the numbers above):
- On real programs, with tables of 47 to 69 `nodes` lines, 9 to 12 lines of rules, about 10 templates and 10 describe
  strings per language, 98 percent of the characters of the Python standard library sample, 97.7 percent of the
  JavaScript library sample and 100 percent of the Scheme files are in real blocks, and 85 percent of JavaScript
  top-level statements and 69 percent of Python's are drawn with no opaque or missing piece (imports are the rest).
  Coverage grew from about 50 percent to 98 percent for JavaScript and 76 to 98 for Python while the tables grew
  about 1.7 times; the growth was steady, one row at a time, with no step that needed a redesign until the last
  few percent.
- Correctness did not depend on the language: the oracle found 0 failures in 3,640 random edits on 182 real files
  across the final tables (and one failure, in generic code, on the way).
- Time is linear and small (13 to 19 ms per 1000 lines to parse and build in node), except that the one-root-per-class
  shape makes a single edit rebuild a whole class (about 108 ms in jsdom for 2,000 nodes).
Judgement (mine):
- Yes, with a correction to "a handful of rules": about 30 rows per language beyond the first dozen, 10 lines of
  `kind` rules, and four small generic mechanisms (glue words, take-by-position around a token, opaque, top-level-only
  comments). Each of those mechanisms was found by looking at a real program, not by thinking about the language; a
  fourth language would probably need one or two more. The table is the right shape for the first 90 percent; the
  last 10 percent is a long tail whose cost per construct is flat (a row) but whose total is not small, and where
  modifier words, imports, template strings and grouped clauses need design, not rows.
- The corpora are libraries and standard-library code, harder than what students write; the closest local match
  (turtledemo, example folders) got the same or better coverage (97.2 and 96.7 percent). They are small, and no Racket or
  WeScheme student program beyond the repo's own was available, so the Scheme figure says little.
- What these numbers do not show: whether the blocks are the right blocks for a learner (a `rest` list of operators and
  operands is covered but not pleasant), how a screenreader reads a flat list, or how the drawing looks at 98 percent
  coverage (not looked at: no screenshots were retaken this round).

## Fourth round (2026-11-16)

### 1. Bundle, like for like (measurement: esbuild 0.28, `--minify`, one run each; gzip -9)

Entries: `demo/demo.ts` (editor + three languages) and `demo/scheme-only.ts`. "CM6 external" =
`@codemirror/state`, `@codemirror/view`, `@codemirror/commands` marked `--external`. "grammars external" =
also `@lezer/javascript`, `@lezer/python`, `cm6-lezer-scheme-common-lang`.

| build | minified | gzipped | what is in it |
|---|---|---|---|
| (a) everything, 3 languages | 467,454 | 160,845 | all of it |
| (b) CM6 external, 3 languages | 236,647 | 86,949 | our code 46 K, JS grammar 78 K, Python grammar 38 K, @lezer/lr 27 K, @lezer/common 20 K, @codemirror/language 11 K, Scheme grammar 8 K, @lezer/highlight 5.5 K, style-mod 2 K |
| (c) CM6 external, Scheme only | 102,787 | 35,585 | our code 28 K, @lezer/lr 27 K, @lezer/common 20 K, @codemirror/language 11 K, Scheme grammar 8 K, highlight 5.5 K, style-mod 2 K |
| (d) CM6 + all grammars external, Scheme entry | 48,215 | 17,215 | our code 28 K + @lezer/common 19.5 K only |
| (d') same, 3-language entry | 66,113 | 21,776 | our code 46 K + @lezer/common 19.5 K |

(a) by package, bytes in the minified output: @codemirror/view 152,289; @lezer/javascript 77,773; @codemirror/state
47,055; our code (src + demo + css text) 45,800; @lezer/python 37,962; @lezer/lr 26,989; @codemirror/commands
23,218; @lezer/common 20,490; @codemirror/language 16,030; Scheme grammar 8,254; @lezer/highlight 5,501;
@marijn/find-cluster-break 2,329; style-mod 2,223; w3c-keyname 1,516. (Our code is 28 K in the Scheme-only entry
and 46 K with the three tables, the 3-language demo page, and the samples.)

`@codemirror/language`: in (d) it is gone, and so is `@lezer/lr` and `@lezer/highlight`. In (c) it is pulled in ONLY by
`cm6-lezer-scheme-common-lang` (its `dist/index.js` imports it for `LRLanguage`/`LanguageSupport`; esbuild's metafile
shows that is the only importer). Our own code imports `@lezer/common` and the grammars' `parser` export only. So a
language-independent core (the code that takes any Lezer `Parser`) is about 48 KB min / 17 KB gz plus `@lezer/common`,
and each language adds its grammar: Python 38 K, JavaScript 78 K (+ @lezer/lr 27 K shared), Scheme 8 K (+ language
11 K and highlight 5.5 K that only this package drags in).

What today's two numbers contain (read from `packages/cmb-toolkit/src/webpack.ts`, `packages/codemirror-blocks/webpack/`
and `src/umd.ts`; nothing was built): `getWebpackBundleConfig` has `externals` for `codemirror`,
`codemirror/addon/search/search` and `.../searchcursor`, mapped to the global `CodeMirror` that the page loads with its
own `<script>`. So CodeMirror 5 is NOT in the 400 KB or 215 KB, as the owner said. React is: `react`, `react-dom`
(about half of the file, per the comment in `umd-lite.config.js`), `react-redux`, `redux`, `redux-thunk`, `reselect`,
`react-modal`, `react-tabs`, `react-codemirror2`, `react-contenteditable`, `classnames`,
`fast-json-stable-stringify` and `pretty-fast-pretty-printer` (`umd.ts` re-exports React and Pretty on the global) are all in
`dependencies` and none is external. The lite build aliases react/react-dom to `preact/compat`. Judgement: the
comparable pair is therefore (b) 237 KB / 87 KB gz for three languages (103 KB / 36 KB Scheme only) against 400 / 215
KB, PLUS CodeMirror 5 on the page on the old side; the other side's CodeMirror 6 view/state/commands (222 KB min) is
what (a) adds back. I did not check whether 400 / 215 are minified-only or gzip, and no `dist/` exists here to
look at. For scale (measured): CodeMirror 5's `lib/codemirror.js` minified with esbuild is 174,153 bytes
(58,029 gz): so "CM5 + the old editor" is roughly 574 KB (React) / 389 KB (Preact), against 467 KB for ours with
everything and 334 KB Scheme-only (a, c with CM6 included). The old figures are the owner's, summed with my CM5
measurement; the sum is a judgement, not a build.

### 2. Node-level reuse (work in progress, 2026-11-16)

- Code: `src/reconcile.ts` (about 120 lines), `adoptMeta` in lezer.ts (8), `Renderer.refresh` (5), about 60 lines in the
  field update of lezer-view.ts, an option `reconcile: false` that restores the old rebuild-the-root path (to measure both).
- The rule (the safe one, as it came out): a touched root (a change in it or in a neighbour) is still built whole from the new
  Lezer tree, as before (cheap: no DOM). Then the new tree is laid over the old one, node by node: the old `BNode` is KEPT
  where the table row, the kind, the keyword, the glue words, the slot shapes and (for a leaf) the value and data type agree;
  it is then given ALL the fields of the new node (range, `brackets`, source text, error flag), so the result is the fresh
  tree by construction, whatever Lezer's error recovery or Python's dedents did. Where they disagree the old node is replaced
  by the new one. In a list, the common prefix and suffix of nodes with the same shape AND the same source text are paired
  first; the middle is paired by position (so a typed edit in one child recurses into it) and the rest is inserted or
  removed. Each insert / remove / replace is a `TreeChange` that the renderer patches, one at a time. Nothing is assumed from
  "the range and text did not change", which is what the earlier rounds found unsafe.
- One thing the first run caught (fuzzer, 60 seeds): the glue word of a LIST slot (`=` of a `let x = ...`) is drawn only while
  the list is non-empty, so a list that gains or loses its first element is a different shape: `compatible` says so.
- Oracle: the fuzzers (3 languages x 60 seeds x 25 steps) pass; the fuzzer now has a second test on the constructs sample
  (about 30 lines per language, classes, nested bodies). Stale-node tests changed: a node whose owner is edited in place is
  NOT stale any more, so the tests now make the owner into another thing first.
