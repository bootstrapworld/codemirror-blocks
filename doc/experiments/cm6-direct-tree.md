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

### 2. Node-level reuse (done, 2026-11-16)

Code: `src/reconcile.ts` (128 lines), `adoptMeta` in lezer.ts (8), `Renderer.refresh` (5), about 100 lines in the field
update of lezer-view.ts (including the context guard below), and an option `reconcile: false` that restores the old
rebuild-the-root path, so before and after are measured by the same code.

The rule that settled (judgement about why it is safe; evidence is the oracle runs below). A touched root (a change in
it or in a neighbour, as before) is still built whole from the new Lezer tree: cheap, it makes no DOM. The new tree is then
laid over the old one node by node. An old `BNode` is KEPT where the table row, the kind, keyword, modifier, glue words, slot
shape and (for a leaf) value and data type agree; it then takes ALL the fields of the new node (range, brackets, source text,
error flag). Where they disagree it is replaced. In a list the common prefix and suffix of nodes with the same shape AND the
same source text are paired first, the middle is paired by position (so an edit inside one child recurses into it) and the
rest is inserted or removed, each as a `TreeChange` that the renderer patches at once. So nothing is assumed from "same range
and same text", which rounds one and two found unsafe: a node that is not the same as in a fresh parse is replaced. The
result equals the fresh tree by construction wherever the compared nodes come from the new tree; the old objects survive
where they agree.

Two things the oracle found on the way (both fixed, both with a test or a fuzzer run that fails without the fix):
- The glue word of a LIST slot (`=` of a `let x = ...`) is drawn only while the list has something in it, so a list that
  gains its first element is a different shape (`compatible` says so).
- The old rule for keeping an UNTOUCHED root was unsafe in a way the small fuzz programs never reached. On the 30-line
  constructs sample (seed 74, step 18; it fails the same with `reconcile: false`, so it was there since round two) an edit that
  opened a context (Python `f(` with no `)`) changed how unchanged roots further down read, with the same range and text.
  Guard (lezer-view.ts, about 20 lines): the Lezer error nodes are kept with the state; if the error nodes beyond the last
  touched root are not the old ones (mapped through the change), no root between the first change and the last error node is
  kept without being compared. A document with errors that the edit does not move keeps the fast path. (The first version of
  the guard, "any error after the change", cost 30 ms per edit on a Python document with a persistent indentation error and
  was replaced.) Judgement: this is a heuristic, not a proof (a context change that makes no new error node would slip
  through); evidence is only that 800 seeds x 25 steps x 3 languages x 2 fuzzers are clean.

Oracle: the model fuzzers at 800 seeds x 25 steps per language (20,000 steps each): small programs and a second fuzzer on the
30-line constructs sample (classes, nested bodies): 6 runs, all clean, `divergences from a fresh parse` 0. Corpus
run (`CMB_CORPUS=full CMB_STEP=round4`, 182 real files, 3,640 random edits): 0 oracle failures. Counts in the 800-seed run
(Python, constructs sample): roots reconciled 88,647, kept untouched 226,496, rebuilt whole 50,764 (mean 2.6 nodes).

Measurements. jsdom (node, no layout; `spec/reuse.test.ts`, `CMB_REUSE=1`, median of 9 typed edits; "n" = nodes new in the
tree per edit, from the editor's `stats().nodesRebuilt`):

| document (biggest root) | edit | before: ms / n | after: ms / n |
|---|---|---|---|
| JS 618-line class (2,028 nodes) | one space inside the class | 96.9 / 2,624 | 4.7 / 0 |
| same | a character typed at the end of a name | 99.3 / 2,624 | 5.1 / 1 |
| Python 4,006-line file (a 4,898-node class, not drawn in jsdom) | one space in it | 8.8 / 4,968 | 7.3 / 1,326 (an indentation change: a different shape) |
| same | a character at the end of a name | 9.4 / 4,968 | 10.2 / 1 |
| Scheme 3000 lines (roots of 15 nodes) | char in a name | 7.4 / 39 | 6.1 / 1 |
| JS 3000 lines (roots of 27 nodes) | char in a name | 4.5 / 58 | 2.7 / 1 |
| Python 3000 lines (roots of 15 to 27 nodes) | char in a name | 4.6 / 68 | 2.3 / 1 |

("Before" is the old path; the new path also WALKS the whole touched root to compare it: 2,624 comparisons for the class.)
Real Chromium with layout (`e2e/reuse.e2e.ts`, same documents, the biggest root scrolled into view, sync = until a forced
layout, median of 9; `e2e/reuse-chromium.json`):

| | before: sync ms (to next frame) | after: sync ms (to next frame) |
|---|---|---|
| JS 618-line class, space inside it | 25.8 (29.5) | 4.4 (16.6 = one frame) |
| same, char typed at the end of a name | 26.7 (30.8) | 3.8 (16.6) |
| Python 4,898-node class, space in it | 50.1 (54.9) | 6.5 (16.6) |
| same, char at the end of a name | 47.5 (52.3) | 6.6 (16.6) |

Focus (Chromium, same documents): with a block focused elsewhere in the SAME root and a character typed in another leaf of
that root: restores needed 1 -> 0, and the focused block is the same element afterwards (JS and Python). In the 3000-line
focus cases of round two (`e2e/results.json`): "edit in the focused block's parent" went from 1 restore and a new block to
0 restores and the same block, in all three languages; "edit the focused block itself" (its element is replaced) and the
two undo cases still need 1 restore each (an undo is a text change; CodeMirror moves the line, `e2e/results.json`).

What is left of the cost (measurement for the jsdom numbers; the split is my reading): the new tree for the touched root is
still built whole and compared: about 2 microseconds per node (the 4,898-node Python class: about 7 to 10 ms in jsdom, where
nothing is drawn). To make that proportional to the change too, the new tree would have to be built only for the Lezer nodes
that overlap the change (Lezer's own incremental tree already knows which parts are reused), which is a second step; for
the 618-line class the remaining 4 to 5 ms is already below a frame. For Python the safe rule gives reuse
at the leaf and statement level, but an indentation edit changes the shape of the whole block under it (1,326 nodes new in
the 4,898-node class when a space moved a line out of its body): that is the grammar saying the structure changed.

### 3. Constructs that needed more than a row (evidence: `spec/constructs.test.ts`, 14 tests; `spec/comments.test.ts`; the corpus run)

Cheapest first, with lines (table lines are `nodes` rows; adapter lines are in `lezer.ts` unless stated):
| item | status | cost |
|---|---|---|
| modifier words (`async`, `static`, `get`, `set`) | done, JS and Python | `modifiers: [...]` on a row (1 field on 8 rows); adapter 6 lines, `BNode.modifier` 1, renderer 5 (a word before the keyword), `compatible` and the checker 1 each |
| `export default`, `export * from`, `export {..} from` | done (JS) | 2 rows + 2 `kind` rule lines |
| named function expressions keep their name | done (JS) | 1 slot on the row (`@before:ParamList`, the take that Round 3 added); no adapter change |
| imports as real blocks | JS done; Python NOT done | JS: 5 rows + 3 rule lines (`import a, {b as c} from "x"` is: default names, `* as ns`, the `{...}` group as one text block, the source with a `from` glue; the `{..}` group stays text because `b as c` has no Lezer node). Python: needs `x as y` pairs and dotted module paths, see below |
| comments inside a block as blocks | done, all three | adapter 22 lines (+4 in `describe`, +5 in `insertChange`): a comment is no candidate for numbering, it goes into the nearest list slot without a glue word, in text order; writing after a trailing line comment goes before it, or on a new line |
| paired clauses: Python `elif`/`else`, `except`/`finally`/`else`; dict entries | done (Python) | adapter 55 lines (a `groups` spec on a row: groups started by a bare token, or split by a separator token; built with the same `fill` as any node, `fill`/`blanks` were pulled out of `build1`), 3 rows (`Branch`, `Entry`, 2 `groups` fields), 6 lines of separator rule (a new branch goes on its own line at the indentation of the first one) |
| template strings | NOT done (stopped, needs a renderer change) | needs text between children: a template string is text with `${...}` holes and Lezer has no node for the text pieces, so a compound node would have to draw `source text between its children` too (a `pieces` field, 20 to 40 lines in the renderer and in the editing code, and a way to edit a text piece). Left as one opaque block |

Not drawn right, unchanged: JS comma-grouping `let a = 1, b = 2` (flat `rest`), `with a as b`; Python `from x import y as z` and plain
`import`, which remain opaque text (19% of Python top-level statements, 797 of 4,181 in the library sample, are imports).

Corpus re-run (`CMB_CORPUS=full CMB_STEP=round4`, `e2e/corpus-results.json`, row `round4` against row `final`):
| corpus | real / opaque / not drawn, final -> round4 | top-level statements fully, final -> round4 |
|---|---|---|
| js-node_modules-library | 97.7 / 1.2 / 1.1 -> 98.4 / 1.2 / 0.4 | 1425 -> 1551 of 1,682 (85% -> 92%) |
| js-repo-own | 87.8 / 11.3 / 0.9 -> 88.0 / 11.3 / 0.8 | 245 -> 258 of 338 |
| js-node_modules-examples | 96.7 / 3.3 / 0 (unchanged) | 188 -> 189 of 196 |
| Python (stdlib, turtledemo), Scheme (2 corpora) | unchanged | unchanged (the Python gain is not in this measure: branches and entries were counted real before; they are structure now, not coverage) |
Oracle: 0 failures in 3,640 edits on 182 files. Typed edit on the largest file: JS class 108.3 ms -> 5.6 ms (jsdom).

### 4. Moving blocks (evidence: `spec/move.test.ts`, 23 tests; `e2e/move.e2e.ts`, 6 Chromium tests, 2 per language)

- Cut, copy and paste: the browser's `copy`, `cut` and `paste` events on the editor (so the real clipboard works, in
  Chromium Ctrl/Cmd-C/X/V with a block focused fire them); copy puts the node's source text, its later lines moved left by the
  indentation of its line; paste writes after the focused block, in the nearest list that holds it (the roots at the end),
  replacing a focused blank; the pasted block is focused. `copyText`, `pasteText` in `lezer-view.ts` (about 45 lines),
  handlers 30 lines in `interact.ts`. Each is one text change; undo takes it back (tested in Chromium: cut, paste, two undos).
- Drag and drop: pointer events (no library, so a pen or a finger work as far as the browser sends pointer events: NOT
  tried on a touch device, and a block has no `touch-action`, so on a touch screen the page scrolls instead): pointer down on a
  block, a 5 px threshold, the gaps widen while dragging (CSS 8 lines), the drop target (a gap, a blank, or the top or bottom 30% of a
  top-level block) is outlined, release calls `moveNode(node, target)`: ONE transaction holding the removal and the
  insertion (so one undo step), both computed from ranges and separators, the indentation of the target's line applied to a multi-line block, no-op
  when dropped where it is, refused (throws, `lastError` set) when the target is inside the block. 110 lines in `interact.ts`,
  45 in `lezer-view.ts`. Real mouse drag in Chromium, all three languages: `3` of `f(1, g(2), 3)` dropped on the first gap
  gives `f(3, 1, g(2))`, drop target outlined during the drag, focus on the moved block, one undo restores.
- Two cosmetic fixes found by the tests, in code that also serves the old edits: removing the LAST statement used to leave an
  extra blank line (it takes its own newline now), and inserting after a statement that already ends in a newline no longer
  adds a second one.
- Not done: multi-selection (cut and drag of several blocks): the clipboard, `moveNode` and the drop code would take a list of
  nodes in one slot and a range, but selecting several blocks has no UI yet. Not tried: a drop between two top-level
  blocks that have no space between them; dragging a block onto a text-only (opaque) block.

### 5. Chromium, round one against now (3000-line documents; `e2e/results.json` now, `e2e/results-round2.json` the end of round two; round one from the table in Step 4 above)

| | Scheme | JavaScript | Python |
|---|---|---|---|
| first blocks in the DOM / to after first frame, round one | 88 / 94 | 66 / 72 | 70 / 75 |
| same, now | 81 / 86 | 71 / 76 | 76 / 81 |
| create editor (parse + build + first draw), round one / now | 64 / 58 | 43 / 49 | 48 / 54 |
| one edit, sync with layout near top / middle: round one | 9.8 / 9.2 | 2.5 / 3.5 | 2.2 / 1.9 |
| round two (after the Scheme fix) | 3.4 / 2.9 | 3.3 / 3.5 | 2.9 / 2.6 |
| now | 4.3 / 3.6 | 3.0 / 3.3 | 3.1 / 2.3 |
| roots in the DOM at load / at most while scrolling, now | 14 / 37 | 8 / 22 | 10 / 26 |
| widgets built while scrolling the whole document, round one / now | 1861 / 1955 | 1603 / 1586 | 1999 / 1950 |
| roots / nodes, now | 1,250 / 13,750 | 940 / 11,656 | 1,155 / 13,629 |

Judgement: nothing got slower except Scheme's edit (3.4 -> 4.3 ms near the top, 2.9 -> 3.6: the new comparison pass over the touched root,
the error scan from the first change on, and 15-node roots, so a few tenths of a millisecond each); the numbers are single runs of a
laptop, so differences under a millisecond are noise. The focus cases are in Step 2 above. Screenshots retaken:
`e2e/screens/{scheme,javascript,python}.png` (the constructs sample, with the new blocks: imports, modifier words, comments inside blocks,
branches, entries) and `e2e/screens/toolbar-template.png` (the toolbar after the `if-else` button: the new block with its first hole in an edit box).

### What is not done, and what I would do next
- Python imports (`from a.b import c as d`) are still text: needs `x as y` pairs inside a separator group, with the pair's `as`
  found relative to the pair, not to the whole node (the `@after:` takes look at the first `as` of the node), and a dotted
  module path drawn as one name. About 20 lines of adapter. Template strings: a renderer change (text between children).
- Reconcile still builds the whole new tree of a touched root; making that proportional to the change needs the Lezer tree's
  own reuse information (which subtrees the incremental parse kept) so the adapter builds only the overlapping nodes. The guard for
  context changes is a heuristic.
- Touch: no `touch-action`, no long-press to start a drag; multi-selection; a drop between top-level blocks only works on the 30%
  edges; the keyboard has no cut/paste of a block without the browser's clipboard events (a page that blocks them has no fallback).
- Preact and screen-reader checks (is the focus restore or a drag announced?) are still not made.

## Fifth round (2026-11-16)

Order of work: (1) Space-select and Cmd/Ctrl-Enter, with a parity table against the existing editor; (2) build the new tree only
where the text changed; (3) Python imports; (4) template strings and f-strings; (5) an accessibility check in Chromium; (6) touch.
Evidence = a test or a measurement; "judgement" = mine. Dated bullets are appended as each step lands.

### 1. Selection (Space) and edit-as-text (Cmd-Enter / Ctrl-Enter)

How the existing (CodeMirror 5) editor does them, read from `packages/codemirror-blocks/src/keymap.tsx`, `components/Node.tsx`,
`components/NodeEditable.tsx`, `state/reducers.ts`, `state/actions.ts`, `copypaste.ts`:

- **Space** is "Toggle Selection". The selection is a LIST OF NODE IDS in the store (`state.selections`), any number of blocks. Selecting a block
  puts the block AND ALL ITS DESCENDANTS in the list. If the block is already selected, Space removes it, its descendants and its
  ANCESTORS (so unselecting a child unselects the parents, not the siblings). If the block has a selected ancestor, nothing changes: a beep and
  "This node is already has a selected ancestor". If the block holds selected blocks, those are dropped and it takes over (it and its descendants).
  Every block is drawn `aria-selected="true|false"` (Node.tsx; no `aria-multiselectable` is set). Nothing is announced when a block is
  selected or unselected (the source has `TODO(Emmanuel): announce addition / removal`).
- What clears it: Escape, Ctrl-Escape and Alt-Q ("Clear Selection"); opening an edit box (NodeEditable's mount effect sets it to `[]`); a
  delete, cut or paste (`setSelectedNodeIds([])` after the edit); and the AST reducer drops ids of nodes the new tree no longer has. A click does NOT clear it
  (mousedown only activates the block).
- What it is used for: Delete / Backspace ("Delete Nodes") delete the OUTERMOST selected nodes ("deleted X and Y" is announced); with nothing
  selected they only say "Nothing selected" (they do NOT delete the focused block). Cut takes the outermost selected nodes ("Nothing selected"
  when none; announces "cut ..."); Copy takes them, or the focused block when none is selected (announces "copied ..."); the clipboard text is the nodes
  in document order joined by spaces (a newline after a commented node). Paste on a selected node replaces it. **Drag does NOT use the selection**:
  the drag item is `{ id: props.node.id }`, one block (so "drag moves the selection", as the owner asked, is NOT what the old editor does).
- **Cmd-Enter on a Mac, Ctrl-Enter elsewhere** is "Edit Anything" (`macKeyMap` / `pcKeyMap`, chosen by `mac = ios || /Mac/.test(platform)`, in `utils.ts`;
  Ctrl-Enter does nothing on a Mac and Cmd-Enter nothing elsewhere). It calls `handleMakeEditable`: any block (not only literals; plain Enter edits only
  literals and comment blocks, otherwise it collapses or expands) becomes an editable box holding its source text (`ReplaceNodeTarget.getText`: the range
  of the node in the document), only when the block has no error. The box is a one-line `contentEditable`: Enter (no Shift) is prevented and, through NodeEditable's keydown
  handler, saves by blurring (the value is committed in `handleBlur`, so BLUR ALSO COMMITS); Escape and Alt-Q cancel. There is no multi-line box: a
  multi-line block is shown in a one-line contentEditable, and Shift-Enter (not prevented) adds a line break in it. The committed text goes through
  `edit_replace` and the parse of the whole document; text that does not parse makes the edit fail (`setErrorId`, the box stays open and selected).

What was built here (`src/interact.ts`, `src/lezer-view.ts`, `src/render.ts`, `src/style.css`):

- **Selection** lives in the `Renderer` (a set of `BNode`s), so a node that is removed (`forget`) leaves it, and a kept node (node-level reuse) stays in it. Blocks are
  drawn `aria-selected="true|false"` and `blocks-selected` (orange outline and tint); the tree has `aria-multiselectable="true"`. Rules as in the
  old editor: the block and everything inside it; Space again removes it, what is inside it and its ancestors; a block under a selected one is refused ("This node
  already has a selected ancestor", spoken, no beep: there is no sound here); a block holding selected ones takes them over. Blocks that are NEW inside a selected block
  (an edit made one) are selected with it (a pass after each update; a few lines). Escape, Ctrl-Escape, Alt-Q (`code === "KeyQ"`, the old editor's `Alt-Q`
  is a key name) clear it; opening a box clears it; a click does not.
- **Announcements**: a live region (`.blocks-announcer`, `aria-live="assertive"`, `aria-atomic`, visually hidden, next to the editor; written 50 ms after it is cleared
  as the old announcer does), also kept in `ed.said`. It says what the old editor says ("deleted X and Y", "cut ...", "copied ...", the ancestor refusal, "editing X.  Use Enter
  to save, and Alt-Q to cancel", "inserting...") and "deleted X" also for a single focused block. Selecting and unselecting say NOTHING, like the old editor (state through
  `aria-selected` only): a first version said "selected X", and was taken out because a screen reader that announces the changed `aria-selected` of the focused block would then say it
  twice (judgement; no screen reader was run).
- **Uses**: Delete / Backspace remove the selected outermost blocks in ONE text change (`removeNodes`: the removal ranges are merged where they overlap, so removing all
  of a list's elements works) and one undo step; with nothing selected they remove the focused block (DIFFERENT: the old editor says "Nothing selected"). Copy and cut take the selection in
  document order, or the focused block when none; the clipboard text is the blocks joined by a newline, and the editor remembers the items, so pasting back into the editor puts
  each in as its own element of the list (`pasteTexts`: joined by the language's separator, one change); Shift-Cmd/Ctrl-V pastes before (cheap, added). **Drag** of a selected block
  moves all the selected blocks to the target (`moveNodes`: one change holding the removals and the insertion; DIFFERENT: the old editor drags one block); dragging an unselected
  block moves only it.
- **Edit as text**: Cmd-Enter on a Mac (`navigator.platform` matches `/Mac|iPhone|iPad/`), Ctrl-Enter elsewhere, exactly the old editor's pairing. It opens a `<textarea class="blocks-edit blocks-edit-all">`
  INSIDE the block's own element (the block's children are hidden by a class, removed before anything is dispatched), holding the block's source text (its later lines moved left by the
  indentation of its first line, trailing whitespace dropped). `rows` is the number of lines and `cols` the longest line, and it follows what is typed. **Enter commits, Shift-Enter is a newline** (what the old
  editor's contentEditable does too), Escape or Alt-Q cancels, and BLUR CANCELS (DIFFERENT: the old editor commits on blur; the existing cm6 boxes already cancelled). Commit: the later lines are indented
  again, whatever the old range ended with (a Python statement's newline) is kept, and ONE text change replaces the node's range; the text is parsed again as part of the document. Text that does not
  parse is accepted: it becomes what Lezer's recovery makes of it (an error node inside a block, or an error root shown as text); `lastError` stays null; the oracle stays clean; undo takes it back.
  Empty text and unchanged text change nothing (the old editor: empty text cancels). On a literal it does what Enter does. A block that is not drawn (outside the viewport) is not edited.
- Evidence: `spec/selection.test.ts` (39 tests: 13 per language) and `spec/editall.test.ts` (24 tests: 8 per language) in jsdom, all three languages; the model fuzzers now also select blocks and remove
  the selection (300 seeds x 25 steps per language, clean; 800 seeds at the end of step 2); `e2e/select.e2e.ts`, 15 tests in real Chromium with real key presses (`Space`, `Delete`,
  `Escape`, `ControlOrMeta+c`, a real mouse drag of a selected block, and `Meta+Enter` on darwin / `Control+Enter` elsewhere), all pass.
  The renderer snapshot changed (every block now says `aria-selected="false"`).
- Judgement: the selection set is by node object, so a block that is rebuilt by an edit (not reconciled) silently leaves the selection; that is what the old editor does too (ids that no longer
  exist are dropped), but here a rebuilt root can be more than the user expects (a Python indentation change rebuilds a whole body). A selected block is also "selected" for a screen reader through
  `aria-selected` only; whether the live-region words are said twice with the role=tree announcement was not tested with a screen reader.

### 1c. Parity table: every key and mouse gesture of the existing editor (read from `keymap.tsx`, `components/Node.tsx`, `ui/BlockEditor.tsx`)

"here" = this experiment after step 1. "added" = added in this step because it was a few lines.

| key or gesture | what it does in the existing editor | here |
|---|---|---|
| Down / Up | next / previous block, skipping the insides of collapsed blocks | yes (no collapsing here) |
| Home | first block | yes (added) |
| End | last visible block | yes (added; the last block in document order) |
| Left | collapse the block, or focus its parent | different: focus the parent (nothing collapses) |
| Right | expand, or focus the first child | different: focus the first child |
| Shift-Left / Shift-Right | collapse all / expand all | no |
| Shift-Alt-Left / Shift-Alt-Right | collapse / expand the current root | no |
| Shift-, | jump to the root | yes (added) |
| \ | read the ancestors ("X, at level n, inside Y") | yes (added; spoken through the live region) |
| Shift-\ | read the children (a description of the subtree) | different (added): says the one-line descriptions of the children |
| Shift-Tab | move focus to the toolbar | no (the toolbar is plain buttons; Tab order is the browser's) |
| Enter | edit a literal or comment block in place; on other blocks collapse / expand | different: edits a leaf; nothing on other blocks |
| Cmd-Enter (Mac) / Ctrl-Enter | "Edit Anything": the block's text in a one-line editable box | yes (step 1), different: a textarea, Enter commits, Shift-Enter newline, blur cancels |
| Ctrl-[ / Ctrl-] | insert a new block before / after (opens a box at the drop target) | yes |
| Shift-Ctrl-] | edit the block's comment (a comment attached to a block) | no (comments are blocks of their own here; no attached comment) |
| Space | toggle selection | yes (step 1) |
| Esc, Ctrl-Esc, Alt-Q | clear the selection | yes (step 1) |
| Delete, Backspace | delete the selected blocks; "Nothing selected" when none | different: the selected blocks, else the focused block |
| PageUp / PageDown | search previous / next | no |
| F3, Ctrl-F, Cmd-F | open the search dialog | no |
| Ctrl-F3 / Shift-Ctrl-F3 | next / previous search type | no |
| Cmd/Ctrl-Z | undo | yes |
| Cmd/Ctrl-Y, Shift-Cmd/Ctrl-Z | redo | yes |
| Cmd/Ctrl-C | copy the selected blocks, else the focused one | yes (step 1; the text joined by newlines, not spaces) |
| Cmd/Ctrl-X | cut the selected blocks | yes (step 1; also the focused block when nothing is selected) |
| Cmd/Ctrl-V | paste after the focused block (or over the selection / into the drop target) | yes (after the focused block, in the nearest list; replaces a blank); over a selection: no, the selection is cleared |
| Shift-Cmd/Ctrl-V | paste before | yes (added) |
| Shift-Ctrl-/ | help dialog listing the keys | no |
| any printable key on a focused blank | (not in keymap.tsx; BlockEditor.tsx line 294 starts an edit) | yes: typing replaces a hole |
| mouse: press on a block | activates (focuses) it, records the event | yes (click focuses) |
| mouse: click on a literal | opens its edit box (`normallyEditable`) | no: a click only focuses; Enter edits |
| mouse: double click | collapse / expand | no |
| mouse: click a drop target / insertion point | opens an insertion box there | yes (a click on a gap) |
| mouse: drag a block (react-dnd) | moves ONE block onto a drop target or onto another block (replaces it) | different: pointer events, moves the selection if the block is selected; drops on gaps, blanks, and the edges of top-level blocks; not onto an arbitrary block |
| mouse: drag from the toolbar | inserts a new block | no (toolbar buttons insert after the focused block) |
| toolbar | blocks to drag, a focus target | different (buttons that insert templates) |
| collapse / expand state, `aria-expanded` toggled | collapsed blocks hide their insides | no (blocks are always expanded; `aria-expanded="true"` is a constant) |
| comments attached to a block (`with comment:` read aloud, speech-balloon badge) | yes | no |
| search (with a rotor of search types) | yes | no |
| sounds (BEEP) on a refused move | yes | no (words only) |
| activity log (`recordEvent`) | records keys, mouse, edits, clipboard | no |

The "no" rows, in order of how much they would cost (judgement): the sound (trivial); a help dialog (small); Shift-Tab to a toolbar (small); click-to-edit a literal (a few lines but a
decision, since a click also starts a drag); collapse and expand (needs a state per block and a renderer change, medium); drag from the toolbar (medium); search (large);
comments attached to blocks (large: the whole design treats comments as blocks); the activity log.

### 2. Build the new tree only where the text changed (anchors; 2026-11-16)

Code: `reconcile.ts` (+Bail, anchors split a list into stretches; `reconcileRange` is the old list algorithm over a stretch), `lezer.ts` (the adapter
asks an optional `inner` keeper before building a child block: 20 lines, `InnerCand` with the block's window and level), `lezer-view.ts` (the keeper, about 90 lines:
an index of the old root, the checks, shifting, and the fallback). Option `anchors: false` restores the round-four path (the whole touched root built, then compared),
so before and after run the same code.

The rule (judgement about why it is safe; evidence is the oracle runs below). Inside a touched root, a block is NOT built: the OLD node is taken as it is (an "anchor"),
moved by the change (its subtree shifted by the difference of positions), when ALL of: no change lies in its window (from the start of the block before it to the end of
the block after it, or the owner's ends), the new Lezer tree has no error node in its range and, if the document has errors that the change moved, it is not between the first
change and the last error (the round-four guard); an old node with the same mapped range and the same table row exists, is unambiguous (one such node), has no error inside, and
is exactly as deep as the new tree puts it (otherwise its drawn `aria-level` would be wrong). Neighbour roots of a touched root get anchors too (without it a 590-node
function next to the edited class was still built and compared). Anchors are old objects, so their elements, ids and focus survive.
What is compared is then only what was built: the nodes in the windows around the change and their ancestors. In `reconcileSlot` an anchor splits the old and new lists, and
the stretches between anchors are laid over each other with the old algorithm; an anchor is re-parented to the surviving old owner.

Safety net: an anchor that cannot be where the new tree puts it (it is not in the paired list, it sits inside a node that is new or one that leaves, in a different order)
makes `reconcile` throw `Bail`; the editor then drops the old root and uses the new one as it is (links repaired by `relink`, byId and selection pruned), which is correct
because the new root is complete (anchors included). A bail costs a full redraw of that root; nothing else is lost.

Evidence. Oracle: model fuzzers at 800 seeds x 25 steps per language (20,000 steps each, now also selecting blocks and removing the selection) and 200 seeds x 25 on the
70-line constructs sample: all clean, 0 divergences. Counts in that run (20,000 steps): anchors taken 65,343 / 59,445 / 50,407 (Scheme / JS / Python), bails 256 / 210 / 327
(about 1 percent of reconciled roots; they happen where a block moves or is wrapped: the bail path is tested by `spec/move.test.ts`, which hit it before the fixes). Four bugs
found and fixed on the way by the oracle: anchors keeping the new parent as their `parent`; `aria-level` of an anchor under a deeper or shallower parent (the level check);
byId and selection leaking for nodes in a failed reconcile; positions of a dropped root read after its reconcile had overwritten them.
Measurement, jsdom (`spec/reuse.test.ts`, median of 9, `CMB_REUSE=1`; "built-and-compared" is nodes new in the touched root's tree, which used to be every node of the root):

| document, edit | rebuild whole (round 3), ms | reconcile (round 4), ms / nodes compared | anchors (now), ms / nodes compared / anchored |
|---|---|---|---|
| JS 618-line class (2,028 nodes), char typed in a name | 100.9 | 5.2 / 2,624 | 2.3 / 17 / 44 |
| same, a space typed in the biggest root | 99.7 | 4.8 / 2,624 | 2.0 / 17 / 47 |
| Python 4,006-line file (4,898-node class), char in a name | 8.8 | 10.2 / 4,968 | 3.3 / 84 / 193 |
| same, a space (an indentation change: 1,326 nodes are really new) | 8.1 | 7.1 / 2,613 | 3.8 / 233 / 111 |
| Scheme 3000 lines (15-node roots), char in a name | 8.1 | 6.3 / 39 | 6.1 / 34 / 5 |
| JS 3000 lines (27-node roots) | 4.5 | 2.7 / 58 | 2.5 / 38 / 5 |
| Python 3000 lines | 4.4 | 2.3 / 68 | 2.1 / 48 / 5 |

Real Chromium with layout (`e2e/reuse.e2e.ts`, sync = until a forced layout, median of 9; `e2e/reuse-chromium.json`, the round-five-before run is `reuse-chromium-round5-before.json`):

| | rebuild whole | reconcile (round 4) | anchors (now) |
|---|---|---|---|
| JS 618-line class, space inside it | 30.1 | 4.6 | 1.5 |
| same, char at the end of a name | 28.6 | 4.7 | 2.4 |
| Python 4,898-node class, space in it | 52.1 | 7.7 | 2.6 |
| same, char at the end of a name | 52.9 | 7.3 | 3.3 |

On the 3000-line documents (`e2e/results.json`, round four in `results-round4.json`; one edit near the top / in the middle, sync with layout): Scheme 4.3 / 3.6 ms before, 4.6 / 3.5 now;
JavaScript 3.0 / 3.3 before, 3.0 / 2.8 now; Python 3.1 / 2.3 before, 3.0 / 1.9 now. Unchanged within noise: those roots are 15 to 27 nodes, so nothing was being rebuilt that mattered; the
3 to 4 ms there is a cost per edit that grows with the NUMBER of roots (the map of old roots with two `mapPos` each, the error list merge, `fromTree` collecting every top-level
node, the decoration filter), which this step did not touch. Judgement: next, make those proportional to the roots near the change (binary search instead of a pass over all of them).
Focus: the "block elsewhere in the same root keeps focus" case still holds (0 restores, same element) in all modes that reconcile.
The anchors rule is a heuristic like the root-level one (two siblings away is enough room for a context effect that makes no error node and no range change: none was found by 75,000
fuzz steps, which is evidence about those generators, not a proof).

### 3. Python imports as blocks (2026-11-16)

`import a.b as c, d` and `from x import y as z, w` (also `from . import a`, `from .a.b import (c, d as e)`, `from x import *`) are blocks: the statement (keyword `import` or
`from`), a list of names, each a block with its name and, when there is one, its `as` alias. Lezer gives these NO nodes for the parts (all tokens are flat children of
`ImportStatement`, a dotted path is `VariableName "." VariableName`), so the adapter got one new generic mechanism and the table 4 rows:
- Adapter (`lezer.ts`, about 40 lines): `BlockRow.chunks = { delims, row }`: the node's children are cut at the delimiter tokens (`from import as , ( )`) and what lies between two delimiters is ONE leaf block (so `a.b`
  and `.a.b` are one name); a slot can take a chunk by the delimiter before it (`@prev:from`, `@prev:as`); `groups.own` keeps the chunks after a given token (`from`) out of the groups.
- Table (`lang-python.ts`): `ImportStatement` and `FromImport` (a `kind` rule line picks it when the first token is `from`), `Alias`, `ImportName`; `separators.names`; one template (`import`); `ImportStatement` leaves the
  `opaque` list. Spoken: "import a.b as c", "from x import 2 names".
- Evidence: `spec/imports.test.ts` (4 tests: the shape of 7 import forms, the drawn words, remove / insert / edit of a name, the template, junk like `from import (`), the fuzzers (the 70-line Python sample has
  `import os` and `from math import sqrt`), and the corpus run. The oracle found one real bug on the way (it fails only with this sample, seed 79): the error nodes list used for the anchors did not hold errors BEFORE the
  first change, but text after a change can create an error before it (a body that ends in an error); the anchors now read the errors of the touched root from the new tree.
- Corpus (`CMB_CORPUS=full CMB_STEP=round5`, `e2e/corpus-results.json`, row `round5` against `round4`): top-level statements drawn in full: Python standard-library sample **2,883 of 4,181 (69.0 percent) -> 3,789 of 4,181
  (90.6 percent)**; imports were the 797 statements counted as "none": now 0 are. turtledemo (beginner-style) 149 -> 189 of 204 (73.0 -> 92.6 percent). Characters: real / opaque / not drawn 98.1 / 1.3 / 0.6 -> 99.4 / 0 / 0.6
  (stdlib), 97.2 / 2.4 / 0.4 -> 99.6 / 0 / 0.4 (turtledemo). Oracle: 0 failures in 3,640 random edits on 182 files. What is left in "partly" (392 statements): `StatementGroup` (`a = 1; b = 2`), `SetExpression`, comprehension
  parts, `yield` and `return` values taken as strays, as listed in the round-three tables.
- Not done: an alias is a plain two-slot block, so `as` is the slot's glue word and not a block of its own; `import a, b` puts each name in its own block with the comma left to the text (separator `, `).

### 4. Template strings (JavaScript) and f-strings (Python): done (2026-11-16)

The renderer change was small, so it is made. A slot may say `pieces` (`Slot.pieces`, set from a one-field `pieces: true` in the table's slot): the OWNER's source text between its children (and before the first, after the last) is
drawn as text in the GAPS the renderer already puts between the children (`blocks-gap blocks-piece`, no longer `aria-hidden`, text set by `paintPieces`). So nothing about the list/gap structure changed, which is what the
patching (`apply`, `renumberGaps`) relies on. Cost: `render.ts` +35 lines (`paintPieces`, `repaintPieces`; called after a build, after an insert or remove, and from `refresh` and the ancestors loop of `apply`), 3 lines in
`types.ts` and `lezer.ts`, one row per language (`TemplateString`, `FormatString`, 1 line each, taken out of `opaque`), and the guards below. The blocks inside are the expressions of the `${...}` / `{...}` parts (`Interpolation` and
`FormatReplacement` are looked through), the pieces are `` `a ${ ``, `} b ${`, `} c` `` (JavaScript) and `f"a {`, `} b {`, `!r} c {`, `:>5}"` (Python, so `!r` and `:>5` stay text).
- Guards (the text is not a list of blocks): `insertText` into such a slot throws ("nothing can be inserted into the parts of a template: it is text with blocks in it"); a click on its gaps opens no box; they are no drop
  targets; paste, Ctrl-[ / Ctrl-] and templates go after the template instead of into it; removing a block inside replaces it with the language's blank (`${undefined}`, `{...!r}`); edit-as-text (Cmd/Ctrl-Enter) works on the whole
  string and is how a piece is changed.
- Evidence: `spec/templatestrings.test.ts` (8 tests: shape, pieces drawn, an edit inside, remove and undo, the refusals, edit as text) and the fuzzers (the samples have both; 800 seeds x 25 steps x 3 languages plus 400 seeds on the 70-line
  samples, 90,000 steps, clean, now also with imports and anchors). The render oracle (live DOM equals a fresh drawing) is part of every step.
- Corpus: the template strings were 413 characters of opaque text in the JavaScript examples; they are blocks now (opaque 3.3 percent -> 0). The corpus measure counted the pieces as "not drawn" until `corpus-lib.ts` was
  told that a block with a pieces slot draws its own text (a change to the measure, not to the editor; flagged here). JavaScript top-level statements in full: library 1,551 -> 1,557 of 1,682, examples 189 -> 191 of 196.
- Not done / limits: the text pieces are not blocks, so a screen reader meets them as plain text inside the group (judgement: that is how a person would read a template string), and moving a block out of a template or into one is
  refused by the guards. `${...}` that holds a comment or a nested template string works (the nested one is its own block) but was only exercised by the fuzzers' samples.

### 5. Accessibility check in Chromium (`e2e/a11y.e2e.ts`; 2026-11-16)

What it is: for each language a small program (`f(1, g(2), 3)` / `h(4)`), Chromium's own accessibility tree (CDP `Accessibility.getFullAXTree`; Playwright 1.64's `ariaSnapshot` has no levels or set sizes) after:
0 the program as loaded, 1 an insert through the editor while a block of the same call is focused, 2 a delete with the Delete key, 3 a selection with two Space presses, 4 an undo. Evidence below is about the accessibility TREE and about
focus EVENTS; it is not evidence about what NVDA, JAWS or VoiceOver say. Results: `e2e/a11y-results.json`; the first outline per language in `e2e/a11y-outline-<lang>.txt`.
- Tree (15 snapshots = 3 languages x 5): one `tree` named "program" with `multiselectable=true`; every block is a `treeitem` with a non-empty name (the spoken label, e.g. "call to f with 3 arguments", "number 1"), `level` equal
  to its nesting depth among treeitems, `expanded=true` on blocks with children and nothing on leaves, `selected` where selected. No problem found in any of them (`treeProblems` empty).
- Set sizes and positions (not in the CDP tree, checked on the DOM attributes Chromium computes them from): `aria-setsize` equals the number of sibling blocks and `aria-posinset` runs 1..n in every sibling group in all 15 snapshots
  (including after the insert, the delete and the undo). Every block has `aria-selected` true or false and an `aria-label`.
- Stale or doubled: after each of the five steps the tree of the live editor (outline with names, levels, expanded, selected) is EQUAL to the tree of a fresh editor made from the same text and the same selection (a second page): 15 of 15.
  So no stale label (the ancestor's "with 3 arguments" follows the insert and the delete), no leftover state. One thing that could be read twice (judgement, not tested with a screen reader): each treeitem has both its name
  (the label, "number 1") and its visible text ("1") as a child text box in the tree, so reading it by line in browse mode may say both; in tree navigation the name is said once. The old editor has the same pattern (a label on a
  `span` with the content inside).
- Focus events (in the page, `focusin` / `focusout` with `relatedTarget` and `activeElement` at the time) and `activeElement` sampled on 6 frames after each step:
  - insert, with a block focused in the same call: no events, 0 restores, same block (the reuse of round four).
  - delete of the focused block: BEFORE this round's fix 4 events and 2 restores (focus left the removed block for the body, went to the PARENT call at the mapped position, left again, and went to the sibling `g(2)`: so a
    block that was not the target was focused for a moment, in the same task); the editor's generic restore ran before the removal's own rule. Fix: `removeNodes` holds the generic restore back when the focus is inside what it removes and
    places the focus itself. AFTER: 2 events, `focusout number 3 -> null (active BODY)` then `focusin call to g (active call to g)`, 0 generic restores, one hop.
  - selection with Space: no restore (the events there are from the clicks that move focus between the blocks).
  - undo: no events (focus was on a block that the undo did not touch).
  - In no frame after any step was `activeElement` the body (6 frames each; the first case has no focus yet by design).
  What a screen reader would likely hear (judgement from the events, not measured): the only moment with focus on the body is inside the same JavaScript task as the focusin on the block that follows it, and browsers pass
  focus changes to the accessibility layer after the task, so the intermediate body is probably not announced and the user hears the new block ("call to g with 1 argument"). That is an inference about Chromium's event timing; it is
  not tested with a screen reader, and other browsers or screen readers may announce the blur.
- Against the existing editor (read from `components/Node.tsx`, not run): same roles (`treeitem`), `tabIndex=-1`, `aria-selected` on every block, `aria-level`, `aria-setsize`, `aria-posinset` (the existing numbers come from the AST). Differences:
  its `aria-label` ends with a comma ("call to f with 3 args,") to make the reader pause and it uses `aria-labelledby` on itself (and on the comment of a commented block); it sets `aria-disabled` on locked blocks and
  `aria-expanded` from the real collapsed state of any block that can collapse (here `expanded=true` is constant: nothing collapses). Ours has no comment-through-labelledby and no `aria-disabled`, and `aria-multiselectable` on the
  tree (the old editor sets none). Whether the missing trailing comma changes how a screen reader paces the label was not tested.
- Also found while doing this: the live region now says "deleted X" for a single block (it did not), and selection states are NOT said in the region, so as not to say them twice.

### 6. Touch (2026-11-16)

- `touch-action`: blocks get `touch-action: manipulation` (`style.css`), not `none`: panning and pinch zoom stay the browser's and the double-tap zoom delay is gone; `none` was tried first and would make most of a document
  unscrollable by finger, since blocks cover it (judgement). Blocks also get `user-select: none` and `-webkit-touch-callout: none`. Evidence: computed style in the Chromium test.
- Drag: a finger starts a drag after a LONG PRESS (350 ms) without moving; a finger that moves more than 8 px before that is scrolling and is let go (the drag candidate is dropped). After the long press the
  document's `touchmove` and `contextmenu` are cancelled for the duration of the drag, so the page does not scroll under the finger or open a context menu, and pointer events carry the move to the same drop code as the mouse
  (gaps, blanks, edges of top-level blocks; the selection moves if the block is selected).
- Tap to edit: a tap on a block focuses it (as a click); a SECOND tap on the block that already had focus when the press began edits it: a leaf in its box, any other block as text in the textarea (a finger has no Enter or
  Cmd-Enter). The old editor edits a literal on a single click; here a single tap only focuses, because a tap is also how a person selects what to drag. Mouse clicks are unchanged.
- Evidence: `spec/touch.test.ts` (9 jsdom tests, 3 per language: swipe scrolls and does not drag; long press then move drags and the touchmove is prevented during it and not after; second tap edits a leaf and a call) and
  `e2e/touch.e2e.ts` in real Chromium with a touch context (`hasTouch`, mobile viewport, JavaScript only; 4 tests, all pass): computed `touch-action`; two real taps open the box of a leaf, typed text and Enter commit; a long press
  of 500 ms then 8 touch moves with CDP `Input.dispatchTouchEvent` drags `3` of `f(1, g(2), 3)` onto the first gap (`f(3, 1, g(2))`, the drop target outlined, one undo restores, the oracle clean); a fast swipe
  on a block of the 3000-line document scrolls it (`scrollTop` grows), starts no drag and changes no text.
- Found, not fixed: a tap on a call block's own area (its border, away from any child) was taken by Chromium's touch adjustment as a tap on a neighbouring gap and opened an insertion box instead of the whole-block
  box, so the second-tap-on-a-compound case is tested in jsdom only. A real finger is wide: small blocks and the 8-px gaps are hard targets (judgement; the gaps could be larger on touch screens).
- Not tried: a real device, a pen, iOS Safari (Pointer Events and `touchmove` cancelling differ), two-finger gestures, the virtual keyboard moving the page when a box opens.

### Fifth round: what is not done, and what I would do next
- Per-edit cost that grows with the number of roots (3 to 4 ms at 3000 lines, unchanged by step 2): the map of old roots with `mapPos`, the merged error list, `fromTree` collecting every top-level node, the decoration filter.
  Next: make each proportional to the roots near the change.
- The anchors rule is a heuristic (as the root-level rule is); bails are about 1 percent of reconciled roots in the fuzzers. A bail redraws one root, which costs focus identity there.
- Parity table "no" rows (see 1c): collapse and expand (and `aria-expanded` that means something), search, help dialog, drag from a toolbar, comments attached to blocks, sounds, the activity log, click-to-edit a literal with the mouse.
- Selection: by node object, so a block that an edit rebuilds leaves it; no keyboard way to select a range; Delete with a selection keeps the old editor's "outermost" rule but the focus after it is the first removed block's place only.
- Cmd/Ctrl-Enter: blur cancels (the old editor commits on blur); a text that does not parse is accepted, not shown with an error.
- Accessibility: no real screen reader (NVDA, JAWS, VoiceOver) was run: everything above is about the tree and the events. The accessible names have no trailing pause comma; the pieces of a template string are plain text; a block and its
  visible text are both in the tree.
- Touch: one language, Chromium only, no real device; the gaps are small targets for a finger; tap on a call's own area is taken by touch adjustment.
- Not re-measured this round: bundle sizes (the code grew by about 25 KB of source: selection, edit-as-text, anchors, chunks, pieces, touch).
- Preact was not checked (the package has no React or Preact).

## Sixth round (2026-11-16)

The owner's words: "hit the 'selection is lost on any block an edit rebuilds' issue -- if I modify a block, I expect the focus to be on the newly-created block in its place. After that, collapse/expand, single-click literal editing, and then comments. Search can wait."
Order: (1) focus and selection follow a rebuilt block; (2) collapse / expand; (3) click edits a literal; (4) comments; (5) bundle sizes.

### 1. Focus and selection follow a rebuilt block

- Before: focus was restored by the node's old position mapped through the change (`deepestAt`), selection by node object (a replaced block left it silently).
- Now one function pair in `lezer-view.ts`: `placeOf(node)` (the path from the program: owner, slot name, index, slot length at each step; taken BEFORE the edit) and `resolvePlace(path)`
  (after the edit: from the deepest owner on the path that is still in the tree, the node at the same index of the same slot, clamped, then down the same path as far as it goes; `exact` is false when
  the slot got shorter or the path ended early). Used by: focus restore (`restoreFocus`, falls back to the mapped position only if the path leads nowhere), `removeNodes` (focus after a delete: the
  node now at the first removed block's place, else its neighbour, else the owner; this replaced a search by owner position and kind), selection and (step 2) collapsed state (`carryMarks`).
- Choices: edit turned one block into several: the first (same index). Insert: the inserted block (unchanged, the insert code focuses it). Committed text that is an error node or plain text: `nearestDrawn`
  (a neighbour in the slot by distance, then up the parents). Selection: only the OUTERMOST selected blocks are followed; their new node is selected and a pass selects what is inside; a block whose slot got
  shorter (really removed) leaves. A selected ancestor whose descendant was edited is a kept object, so it stays, and the new descendant is selected by the pass.
- Not changed, on purpose: opening an edit box (Enter, Cmd/Ctrl-Enter) still clears the selection, as in the old editor, so the selection follows edits made by paste, the API, undo/redo, drag, delete of other blocks.
- Evidence: `spec/follow.test.ts` (36 tests, 12 per language): leaf edit, leaf into a call, edit as text, one into several (first), top-level, unparseable text, a blank filled, undo/redo, selection of a leaf / ancestor /
  replaced block / removed block / undo. Six of them fail with `carryMarks` switched off.
- 2026-11-16 step 1 checked: jsdom all green (481), tsc clean, model fuzzers at 800 seeds x 25 steps clean, Chromium `select.e2e.ts` 15/15 (the Meta+Enter edit-as-text tests are in that file).

### 2. Collapse and expand (2026-11-16)

Read from `keymap.tsx` and `Node.tsx` of the old editor and matched: Left on an expanded compound block collapses it, else focuses the parent (beep there, silent here); Right on a collapsed block
expands it, else focuses the first child; Shift-Left / Shift-Right collapse / expand every block (focus to the root); Shift-Alt-Left / Right the current root and what is in it (focus to the root);
double click toggles; Enter on a compound block toggles (leaves still edit). `aria-expanded` is now real (`false` when collapsed; leaves have none).
- State: a set of nodes in the `Renderer` (`isCollapsed`, `setCollapsed`, `collapsedNodes`), the same kind of state as the selection. It follows a rebuilt block through the same `placeOf` / `resolvePlace` (step 1), and a removed block drops it (`forget`). Text is never touched.
- Drawing is CSS only (`blocks-collapsed`): the head (keyword, or the operator slot of a call) and an ellipsis (`::after`); the argument list, glue and other slots are `display: none`, so the inside cannot be focused or clicked (the head child of a call has `pointer-events: none`). Arrow Up / Down (`nextBlock`, `prevBlock`, `lastBlock` take a `closed` predicate) skip the inside; collapsing while focus is inside moves focus to the collapsed block.
- Differences from the old editor: collapsing all collapses every compound block (the old list holds every id, leaves included; no visible difference); no sound. Judgement: a collapsed block whose head is a call's function name still has that name as a drawn block that cannot be clicked or reached.
- Evidence: `spec/collapse.test.ts` (24 jsdom tests, 8 per language), `e2e/collapse.e2e.ts` (3 Chromium tests with real keys); `spec/interact.test.ts` changed (ArrowLeft on a compound child collapses first, as the old editor does).

### 3. Click edits a literal (2026-11-16)

Old editor (read from `Node.tsx`, `nodes.tsx`): a block with `normallyEditable` (literals, and comment blocks) runs `handleMakeEditable` in its click handler, focused or not (the mousedown only activates it); other blocks only get focus.
Here (`interact.ts` `onClick`): a mouse or pen click on a leaf block focuses it and opens its edit box (Enter commits, Escape cancels); a compound block only gets focus. Not edited: a click with Shift / Ctrl / Meta / Alt (focus only; the e2e tests use Shift-click to focus a literal), the second click of a double click (`detail > 1`), a touch (the existing rule stays: the second tap on the focused block edits), and the click that ends a drag (it is swallowed, a press that moves 5 px is a drag). Opening a box clears the selection, as it did.
- Side fix found by the Chromium test: the edit box hid the literal's text with `style="display:none"`, and the DOM was left with `style=""` after a cancel (the checker saw it); it is now a class (`blocks-text-hidden`).
- Evidence: `spec/click.test.ts` (15 jsdom tests), `e2e/click.e2e.ts` (3 Chromium tests: real click opens the box, a click on the focused literal opens it again, a real mouse drag does not). Existing e2e files that clicked literals only to focus them now Shift-click.

### 4. Comments that go with a block (2026-11-16)

Old editor (`keymap.tsx`, `Node.tsx`): a comment is a field of the block (`options.comment`); it is drawn with the block, read aloud as "with comment: ..." (`COMMENT_PREFIX`), and Shift-Ctrl-] opens a box for it (on a comment block: says "Press Enter to edit a comment block"; a collapsed block is expanded first).
Decision (cheapest faithful version, judgement): comments stay blocks of their own (the whole design says so; nothing in the tree, the parser or the tables changes), and a comment is ATTACHED by position, computed when a block is drawn: the comment block that is the sibling directly above it (only a line break and indentation between, and that comment is not the trailing comment of the block before it), or the comment block after it on the same line (only spaces or commas between). A blank line breaks it. Why: no new tree state to keep right through reconcile, anchors and undo; the attachment cannot go stale because it is read from the text and the tree each time (a pass after each edit repaints the blocks next to a comment and those that had a marker: `Renderer.refreshComments`).
- Drawn: class `blocks-has-comment`, `data-comment` and `title` = the words (hover), a quote mark before the block, and on focus the words in italics (`style.css`); spoken: the block's aria-label ends `, with comment: <words>`. State classes are kept in one fixed order (`flagClass`) because the checker compares the class string.
- Shift-Ctrl-] (`code BracketRight`, Ctrl and Shift only; Cmd is not it, as in the old editor): a box inside the block, holding the words (line sign stripped, `#| |#` and `/* */` brackets stripped); Enter writes them: replaces the comment (a block comment keeps its brackets), or, with none, writes `<sign> words` + line break + the line's indentation above the block; EMPTY text removes the comment block (trailing one too); Escape, Alt-Q or blur cancel. One text change, one undo step. The block that gets the comment is `commentHost`: the outermost block that starts where the focused one does, moved up to one that is first on its line (so a comment for `x` in `return x;` goes above the `return`, never between `return` and `x`, which would change a JavaScript program). The new table entry per language: `lineComment` (`;`, `//`, `#`).
- Differences from the old editor: the comment is its own block too (it can be focused, deleted, moved on its own; deleting the host leaves the comment); one line of words only; a comment inside a block whose slots are all "one" (a Scheme `define`) is not a block at all there (known, from the fourth round), so nothing attaches in it; cut and copy of the host do not take its comment along (the old editor's cut does).
- Evidence: `spec/attached.test.ts` (15 jsdom tests, 5 per language), `e2e/click.e2e.ts` (3 Chromium tests with the real key); the model fuzzers' DOM oracle now covers the markers and labels.

### 5. Bundle sizes again (2026-11-16, esbuild 0.28 `--minify`, one run each, gzip -9; same entries as round four)

| build | round 4 minified / gzip | now minified / gzip | change |
|---|---|---|---|
| (a) `demo/demo.ts`, three languages, everything bundled | 467,454 / 160,845 | 504,087 / 173,550 | +36,633 / +12,705 |
| (b) same, CM6 (`@codemirror/state`, `view`, `commands`) external | 236,647 / 86,949 | 273,207 / 99,219 | +36,560 / +12,270 |
| `demo/scheme-only.ts`, everything bundled | (not measured in round 4) | 363,654 / 120,102 | |
| (c) `demo/scheme-only.ts`, CM6 external | 102,787 / 35,585 | 132,724 / 45,962 | +29,937 / +10,377 |

About 30 K minified (10 K gzipped) more in the Scheme-only build over round four: the fifth-round work (selection, edit as text, anchors, touch, Python imports, template strings) and this round (places, collapse, click, attached comments, about 2.5 K of CSS text). Grammars are not external in any of these rows.

### Final checks of the sixth round (2026-11-16)
jsdom 535 passed (6 skipped), tsc clean, model fuzzers at 800 seeds x 25 steps per language clean, the whole Chromium suite 49 passed (all e2e files, port 8177, server stopped).
Not done: search; the old editor's cut taking the attached comment along; comments in blocks whose slots are all "one"; a screen reader was never run.

## Seventh round (2026-11-16)

The owner's words: "keep going. And can you make the scheme blocks look as close as possible to the ones in the CM5 branch?"
Order: (1) the Scheme look; (2) round-six leftovers; (3) the parity table's "no" rows; (4) per-edit cost at 3000 lines; (5) bundle sizes. Evidence = a measurement or a test; judgement is said so.

### 1. The Scheme look (2026-11-16)

How the reference was made: `npm run build:libs` (4.6 s; builds the existing editor's libs, which were missing in the worktree), then the existing editor's example page on a port of my own,
`cd packages/codemirror-blocks && npx webpack serve --config webpack/example.config.js --port 8190` (started and stopped by me), and a throwaway Playwright test that is not part of the suite
(`packages/cm6-blocks/e2e/cm5-ref.cm5.ts`, run with `npx playwright test -c packages/cm6-blocks/e2e/cm5-ref.config.ts`; a config of its own without a web server, files named `.cm5.ts` so the normal config never picks them up). It does what `openInBlockMode` does
(`window.cmb.setValue`, click "switch to blocks mode"), at a 1100 x 1300 window. The CSS values were read from `default-style.less`, `blocks.less`, `wescheme/src/style.less` AND measured (`getComputedStyle` in the real page, dumped by `cm5-dump.cm5.ts`).
The pictures: `e2e/screens/scheme-cm5.png` / `scheme-cm6.png` (one program with every form: comment, variable and function definition, nested calls, cond with else, if, lambda, strings, numbers, boolean, symbols, a character, an empty call),
`scheme-large-cm5.png` / `scheme-large-cm6.png` (`packages/wescheme-blocks/dev-server/ast-test.rkt`), and `scheme-states-*`, `scheme-comment-*`, `scheme-edit-*` (focus, selection, collapse, a blank, the comment box, an edit box). The cm6 ones are made by `e2e/scheme-look.e2e.ts` (part of the suite, 3 tests).

What was done (all CSS except two lines in the Scheme table and one in the view):
- `BlockTable.lang` (new, optional): the editor gets the class `blocks-lang-<lang>` (`EditorView.editorAttributes`; the three tables say `scheme`, `javascript`, `python`). All the new rules are under `.blocks-lang-scheme` (about 250 lines at the end of `style.css`). NO shared rule was changed: JavaScript and Python look as before (their screenshots were not retaken; the jsdom and Chromium suites pass).
- `render.ts` is NOT changed. The existing editor's DOM is a column (strip, then arguments); ours is the same for calls. For definitions and lambda, which here have the keyword, the name slot and the value slot as siblings, the strip is made with a CSS grid
  (`1fr auto auto 1fr`, the black band is a background gradient behind the first row, `define (` / `)` / `λ (` are pseudo-elements; the keyword text `lambda` stays in the DOM because the tree's positions need it: the strip shows `λ` by `font-size: 0` and `::before`).
  `(define (f x) ...)` here has a call block in its name slot: it is drawn flat (no frame, no strip) as the existing editor's name + parameter list; `:has()` tells it from `(define x ...)`. cond is a flex column of clauses (the existing editor's table);
  the else row is told by `[aria-label="symbol else"]` (a hack: it works because the label says it; judgement: a node attribute would be cleaner). `if` is a column: test, then, the word `else`, else, as the existing editor (whose `if` is not a table either: read from its CSS and measured).
- A new rule in the Scheme table: the symbol `...` is a blank (kind "blank"), drawn gold with a `?` as the existing editor does (it is the exercises' placeholder).
- Evidence of the match: the sizes of all seven root blocks of the sample, measured in both pages, are IDENTICAL to a tenth of a pixel
  (existing / here: 84.4x48, 194x82, 274x191.8, 167x210, 285.4x48, 35x48, 392x112), and crops of the states look the same by eye (judgement: the pictures, not a pixel diff).

Visible differences that remain (all seen in the pictures):
- A comment is a block of its own here (dark, italic) AND marks the block it goes with; the existing editor draws only the balloon and a box on focus. Cannot change without hiding a block that can be focused (judgement: left).
- The balloon's box sits about 4 px lower than the existing one's; spacing of `define (` / `λ (` differs by a pixel or two (letter widths of pseudo-elements).
- `(lambda (n) ...)`: the parameter list is the first parameter as the call's "function" here, so `λ ( n [gap] )` has its dotted target after `n`, the existing one before and after.
- Drop targets between the clauses of a cond: the existing editor draws none; here a zero-height strip that opens on hover or while dragging (needed to drop there).
- Page chrome (the existing page's toolbar of primitives, line numbers, trash can, the page header) is not part of the editor here. The editor's own frame is the demo page's.
- Hover / drag colours were copied (lightblue, white on hover) but not compared in pictures.
- A character literal is black in both (the existing CSS says `-char`, its class is `-character`: a bug there, copied on purpose).
- NOT a look difference but found here: the published grammar `cm6-lezer-scheme-common-lang` reads `*`, `/` or `#` followed (even after a space) by a parenthesised list as a TAGGED list, so `(* (- 1 2) (+ 9 8))` is a call whose function is the call `(* - 1 2)` (see the large picture).
  The text and the edit paths stay right (blocks are ranges), but the blocks are wrong; the fix belongs in the grammar (a tag must touch its bracket). Not worked around.

### 2. Leftovers from round six (2026-11-16)

- **Delete / Backspace with nothing selected**: read `keymap.tsx` (`"Delete Nodes"`): with nothing selected it says "Nothing selected" and deletes nothing; it uses only the selection. Matched: here too (the words are in `ed.said`, no sound). Cut and Copy keep the focused block when nothing is selected (the old editor's Copy does; its Cut says "Nothing selected": still DIFFERENT here, on purpose: a cut of the focused block is cheap and was asked for in round five; judgement). About 25 existing tests and 3 e2e files pressed Delete on a focused block: they select with Space first now.
- **Cut and copy take the attached comment**: `copyText(node, withComment)`: the comment (above, or after it on its line) goes on the line above the block in the clipboard text (a trailing comment is moved above on purpose: left after the block it would comment out what follows it when pasted into a line). Cut removes the block AND its comment in one change (`removeNodes(nodes, true)`); Delete does not (the old editor's delete keeps the comment: `delete_(..., keepComments = true)`; its cut passes false). Paste writes both back, they attach again by position, and focus goes to the block, not the comment line. A comment that is selected together with its block is not copied twice. Edit-as-text (Cmd/Ctrl-Enter) does not include the comment (it replaces the block's range only).
- **Comments in blocks with no list slot** (`(define x ; about x\n 5)`, `(define (f a)\n ; about the body\n (* a a))`): such a comment is not a block (nothing could hold it), it is found in the owner's text (the parser run on the owner's source finds the comment tokens; those inside a child belong to the child; cached while the owner's text is unchanged) and stands for a made-up comment node (no id, no slot) next to the children, with the same attach rule as in lists. It is drawn (balloon, label "with comment: ...") and edited with Shift-Ctrl-] (write, change, remove; the removal also takes the line break after it); cut takes it; undo works (they are text changes). A block that already has a comment is its own host for Shift-Ctrl-] wherever it stands on its line (before, `x` in `(define x ; c` edited the define). The renderer repaints the children of an owner that has such comments after each edit. DIFFERENT from a comment block: it cannot be focused or selected on its own.
- **Edit box and blur**: the old editor commits on blur (NodeEditable's `handleBlur`); Escape and Alt-Q cancel. Here the same: blur commits what was typed, EXCEPT empty text, which cancels (judgement: an empty literal would otherwise delete the block just by clicking away; Enter on empty still removes it as before); unchanged text changes nothing; a click on another block keeps the focus where the click put it (the box does not take it back). Applies to every box (leaf, whole block as text, comment, insertion).
- Evidence: `spec/leftovers.test.ts` (15 jsdom tests: 4 per language and 3 for the define comments), `spec/editall.test.ts` (blur commits), the Delete tests changed; jsdom 553 passed, tsc clean, Chromium suite 52 passed (all e2e files incl. the 3 look tests).

### 3. The parity table's "no" rows (2026-11-16; search left for later, as the owner said)

- **Drag from the toolbar** (`ed.beginTemplateDrag(pointerdownEvent, name)` called by a toolbar button; `ed.insertTemplateAt(name, target)` is what the drop calls, and can be called on its own): a press that moves 5 px starts a drag, the same targets and marks as a block drag (a gap, a hole, the top or bottom edge of a top-level block), and the block is WRITTEN where the pointer is let go, with its first hole open for typing. A press that does not move is the button's own click (inserts after the focused block, as before). Not allowed where the template cannot go: a statement into an expression list, a "one" slot (use a hole), the text pieces of a template string: the message goes to `lastError` and the live region. Mouse, pen and finger go through pointer events like the block drag (the finger version was not tried in a real touch browser: the block drag's long-press rule is NOT used here, a template button is outside the page's scrolling content). Old editor: react-dnd drag from its primitives list onto a drop target. DIFFERENT: it can also drop onto a block (replaces it); here only gaps, holes and root edges.
- **Shift-Tab / Tab**: option `focusToolbar` (a function); Shift-Tab on a block calls it (the old editor's "Shift Focus": `appHelpers.focusToolbar`); `ed.focusEditor()` puts the focus back on the block that had it (else the first); the demo page calls it from Tab on its last toolbar button. Without the option the key is left to the browser. A library cannot know where a page's toolbar is, hence the option.
- **Help dialog**: `src/keys.ts` is now the one table of keys (command, description, how it is written, a test of the key press); `interact.ts` finds the command with `commandOf` and has `run: Record<Command, handler>` (a command without a handler does not compile); `src/help.ts` makes the dialog from the same table (Shift-Ctrl-/ as in the old editor, Cmd or Ctrl written for the platform; Escape or the button closes it and the focus goes back). A test presses the first key written for every command and checks `commandOf` says that command, so a key that is written but does nothing fails. The onKey chain (about 120 lines of `if`) is gone. Judgement: the table lists what works, not search.
- **Announcements** (compared with every `say(...)` of the old editor): added "UNDID: / REDID: <words of the edit>" (two stacks of descriptions kept in step with the history: "changed 44", "inserted 7", "deleted x"; the old editor's words come from the same kind of annotation); "changed X" / "inserted X" after an edit box commits; "Use enter to edit" 1.25 s after a literal or hole gets focus (cancelled if anything else is said or the focus moves; the old editor's `allowOverride` queue); "Cannot paste before/after this node." when a paste fails; "Block Mode Enabled" / "Text Mode Enabled" 0.5 s after `setBlockMode`; and the first-time summary "At the top level, this program contains 3 definitions and 2 calls." (the old one uses each node type's label and plural label; here the table's labels, plural by adding "s": "1 if" / "2 ifs" is how it reads). Already there before: deleted / cut / copied, the ancestor refusal, "Nothing selected", editing / inserting, ancestors, children. Not added: the search messages (no search), the error notice. DIFFERENT: the words of an edit in "UNDID" are made from the text change, not from the operation's name.
- **Sounds**: not done (the old editor plays a beep for refusals; `beep()` here is still empty). Not trivially cheap in the way that matters: the sound files are the old package's assets, and a synthesized beep would be a new behaviour I cannot judge by ear here. **Activity log**: skipped (it is the old editor's debugging log, `Download Log`).
- **Found and fixed on the way**: a test race that was a real race: `.blocks-gap` animates its width (0.1 s) when a drag starts, so a gap measured just after the start was somewhere else when the pointer arrived (a real hand is slower than the mouse in a test, but the window exists). `.blocks-dragging .blocks-gap` has no transition now. It showed up only because the new announcement changed the timing.
- Evidence: `spec/toolbar.test.ts` (2), `spec/announce.test.ts` (12: 4 per language), `spec/help.test.ts` (4), `e2e/toolbar.e2e.ts` (12 in real Chromium: a real mouse drag of a button onto a gap, a click, a drop that is nowhere, Shift-Tab and Tab, the dialog); jsdom 571 passed, Chromium suite 65 passed.

### 3b. The parity table, after the seventh round (only the rows that changed since the fifth round's table; "yes" = as the existing editor, "different" = said how)

| key or gesture | here now |
|---|---|
| Left / Right, Shift-Left / Right, Shift-Alt-Left / Right, Enter on a block, double click | yes (sixth round) |
| Cmd/Ctrl-Enter | yes (textarea; Enter commits, Shift-Enter newline; blur now commits as in the old editor) |
| Shift-Ctrl-] | yes (the comment of a block; also a comment inside a block that has no list); the comment is a block of its own too |
| Delete, Backspace | yes: the selected blocks; "Nothing selected" when none (as the old editor) |
| Cmd/Ctrl-X, C | yes; the block's comment goes with it (cut removes it, copy writes it above the block); with nothing selected they take the focused block (the old editor's Cut says "Nothing selected": different) |
| Shift-Tab | yes (option `focusToolbar`; Tab back with `focusEditor`) |
| Shift-Ctrl-/ | yes (from the key table) |
| click a literal | yes (sixth round) |
| drag from the toolbar | yes onto a gap, a hole, or the edge of a top-level block; not onto a block |
| PageUp / PageDown, F3, Ctrl-F, Cmd-F, Ctrl-F3 | no: search (left for later) |
| sounds | no |
| activity log | no (skipped) |

### 4. Per-edit cost at 3000 lines (2026-11-16)

Profile (Chromium CDP sampling profiler, non-minified build, `e2e/profile.e2e.ts` with `e2e/profile.config.ts`; 300 one-character edits at the same place in the middle of the document, with forced layout; raw output in `e2e/profile-<lang>.json`).
Where the 2.8 ms of Scheme went (inclusive, per edit): `fromTree` 1.17 (of it the table's "kind" rule run on every one of the 1250 top-level forms, 0.74), the walk for Lezer error nodes from the change to the end of the document 0.69, incremental parse 0.33, the map of old roots (two `mapPos` each, built for ALL roots) and the rest. The cause was ours in three places, all proportional to the number of roots:
1. `old` map of every root with two `mapPos`: now a lookup on demand (the new position is mapped back, binary search in the old roots, checked forward again).
2. `fromTree` read every top-level node and ran the kind rules even for roots that were kept: new `skip(from, to)` callback, asked before the rule, hands back the old root when it is untouched, same range, no error (`LezerOptions.skipRoots`, false for measuring).
3. The walk over the tree for errors: when the old document had no Lezer error, the new tree's errors are looked for in the roots that were built again only (`fastErrors`). A change that makes errors in a root it does not touch is not seen by this fast path. Judgement/evidence: the model fuzzers (800 seeds x 25 steps, and 100 big seeds) compare with a fresh parse and found nothing; they are evidence about their generators, not proof. As soon as the document has an error, the old slow path runs.
Median ms per edit, same harness, before / after: Scheme 2.8 / 1.1 (our part, `restMs`, 2.21 / 0.49), JavaScript 2.0 / 1.8 (0.78 / 0.49), Python 1.8 / 1.5 (0.94 / 0.63). What is left is mostly the Lezer parse (0.46 / 0.99 / 0.68) and two passes that are still proportional to the roots but cheap: stepping the top-level children (`collect`, 0.18 Scheme) and `shiftTree` of the kept roots after the change (0.12). NOT yet "proportional to the roots near the change" in the strict sense; those two remain. The existing `measure.e2e.ts` (edit sync with layout, near top / middle, remove a block): Scheme 4.3 / 3.6 (round 4) -> 2.6 / 2.2, JavaScript 3.0 / 3.3 -> 2.9 / 2.8, Python 3.1 / 2.3 -> 3.1 / 2.3 (block removals, which build more).
Evidence: `spec/perf.test.ts` (600 roots: an edit rebuilds fewer than 12 roots and keeps over 1000; same text and checker result with the fast paths off; an unclosed bracket takes the slow path and is still the fresh parse).

### 5. Bundle sizes (2026-11-16, esbuild `--minify`, one run each, gzip -9, same entries as rounds four and six)

| build | round 4 min / gzip | round 6 min / gzip | now min / gzip |
|---|---|---|---|
| (a) `demo/demo.ts`, three languages, all bundled | 467,454 / 160,845 | 504,087 / 173,550 | 533,363 / 180,512 |
| (b) same, CodeMirror 6 external | 236,647 / 86,949 | 273,207 / 99,219 | 302,469 / 106,184 |
| `demo/scheme-only.ts`, all bundled | n/m | 363,654 / 120,102 | 392,559 / 126,955 |
| (c) `demo/scheme-only.ts`, CodeMirror 6 external | 102,787 / 35,585 | 132,724 / 45,962 | 161,621 / 52,825 |

+29 K minified (+6.9 K gzip) in the Scheme-only build over round six: about 9 K of Scheme-look CSS, the key table, help dialog, announcements, toolbar drag, stray comments, per-edit lookups. Grammars are not external.

### Final checks of the seventh round (2026-11-16)
jsdom 574 passed (6 skipped), tsc clean, model fuzzers at 800 seeds (100 big seeds) clean, whole Chromium suite 65 passed (port 8177, server stopped; the existing editor's page on 8190 stopped too).
Not done: search; sounds; activity log; the strict "proportional to nearby roots" for stepping the top-level children and shifting kept roots; the grammar's `*`/`/` tagged-list bug; a finger drag from the toolbar was not tried on a real touch device.

## Eighth round (2026-11-16)

The owner's words: "Focus on adding search, sounds, the activity log, and a toolbar drag on a real touch device. No need to worry about performance profiling or bundle sizes."
Skipped on purpose: profiling, bundle sizes, the Scheme grammar's tagged-list bug. Order of the work: sounds were built FIRST (search calls them), then search, the activity log, touch.

### Sounds (done first because search plays two of them)

- **What the old editor does** (every call site, read from `packages/codemirror-blocks/src`): `playSound(BEEP)` at `keymap.tsx` 199 (a paste with no valid drop target: "Cannot paste before/after this node."), 222 / 232 (Previous Block, none before), 243 / 253 (Next Block, none after), 285 (Left: not collapsible and no parent), 303 (Right: not expandable and no child), 338 (Collapse Current Root: top-level and already collapsed or not expandable), 388 (`\`, no ancestors), 439 (Space on a block that has a selected ancestor), 464 (Enter on a block that neither edits nor collapses), 683 (search found nothing, or no search set up); `Node.tsx` 213 (Shift-Ctrl-] on a comment block) and 218 (a language with no comments); `DragAndDropEditor.tsx` 73 (a drop on something that is not whitespace or a target); `fakeAstEdits.ts` 168 / 188 (a delete that leaves a blank where a block has to be). `playSound(WRAP)` once, in `Search.tsx`, when a search goes on from the other end of the document. Only two sounds exist: `beep.mp3` (1.6 KB) and `wrap.mp3` (3.1 KB).
- **Audio**: COPIED, byte for byte (a test compares them with the old package's files when that is present): `packages/cm6-blocks/assets/sounds/*.mp3`, inlined as data URLs into `src/sounds.ts` by `scripts/inline-sounds.js` (the same way as the old package: no bundler rule needed; `src/sounds.ts` is 6.4 KB and identical to the old package's). Reusing them was cheap, so nothing is generated with Web Audio (a synthesized beep would be a sound I cannot judge by ear).
- **API**: `LezerOptions.playSound` (a function `(sound, event) => void`, the default is `browserPlayer()` in `src/sound.ts`: `new Audio(url)`, the old interruption rule, quiet where there is no `Audio` or in jsdom, quiet before the first user gesture (`navigator.userActivation.hasBeenActive`), a rejected `play()` is swallowed), `LezerOptions.sounds` (false: none), `ed.setSounds(on)`, `ed.soundsOn()`, `ed.sound(name, event)`. The events are a closed type (`SoundEvent` in `src/sound.ts`, each documented there), so a test says which event asked for which sound.
- **Events here** (all tested in `spec/sound.test.ts`, 3 languages): `no-previous`, `no-next` (Up / Down), `no-parent`, `no-child` (Left / Right), `collapse-root`, `no-ancestors`, `select-refused`, `delete-nothing`, `paste-refused`, `comment-of-comment`, `left-blank` (any removal that puts a hole in a "one" slot; also Cut), `drop-nowhere` (a block or template let go over the editor where nothing takes it; let go outside the editor: silent), `drop-refused` (the drop throws), plus `no-match` and `wrapped` (search, tested in `spec/search.test.ts`).
- **Different from the old editor**: (1) Delete with nothing selected beeps here (the old one says "Nothing selected" and is silent; judgement: the same refusal as the others). (2) Enter on a block that cannot be edited or collapsed (old 464) has no event here: every block here is a leaf (edits) or has slots (collapses). (3) "language has no comments" (old 218): all three tables have comments. (4) `select-refused` cannot be reached from the keyboard here (selecting a block selects what is inside it, so Space on a child unselects it): it is in the code for the same case as the old one and tested by selecting the parent alone through the renderer. (5) The old drop beep is for a drop on "not whitespace"; here it is a drop over the editor with no target.
- Jest 616 passed, tsc clean.

### 1. Search (2026-11-16)

Read: `Search.tsx`, `searchers/ByString.tsx`, `ByBlock.tsx`, the search keys and `goToMatch` in `keymap.tsx`, `spec/search-test.tsx`, `spec/searchers-test.tsx`. What the old editor does, and what is built here (`src/search.ts`, no React; the keys are in `src/keys.ts`, so the help dialog lists them):

| | old editor | here |
|---|---|---|
| open the dialog | F3, Ctrl-F (Cmd-F too on a Mac), with a block focused | same (F3, Ctrl-F, Cmd-F) |
| dialog | react-modal "Search Settings", tabs "Search by string" / "Search by block"; Left / Right change the tab; Enter (keyup) closes and goes to the first match; Escape or Close closes and goes nowhere | plain DOM, `role="dialog"`, `aria-modal`, `aria-label="Search Settings"`, real `role="tab"` buttons with a roving tab stop, Tab kept inside, same keys (on keydown, not keyup); focus goes back to the block that had it |
| by string | text, "Ignore case", "Exact match" (whole word), "Regex"; matched in the whole text of the program with CodeMirror 5's search cursor; the match is the innermost block holding its start; an unfinished regex finds nothing; empty text steps through the blocks | same options and words; a JS regex (flags `gm` + `i`) over the whole text; same innermost block; same empty-text rule |
| by block | `<select>` of the node TYPES in the document (sorted), option text is the label | `<select>` of the table LABELS in the document (sorted): "call", "definition", "number", ... (two table rows with one label, such as the three call forms, are one type: it is what is read aloud) |
| PageDown / PageUp | next / previous match from the focused block (never the focused block itself); at the end go on from the other end with the wrap sound; none: beep. No search chosen yet: beep and "No search settings have been selected" | same, and the same sounds; `ed.sound("wrap", "wrapped")` and `("beep", "no-match")` |
| rotor Ctrl-F3 / Shift-Ctrl-F3 | cycles the types in the document then the last text searched for (a text closed with Enter), with a wrap, saying "Searching by <label>, 2 of 5" / "Searching for text 'xy', 3 of 3" / "No search types available" | same words and order |
| collapsed blocks | a match inside a collapsed block is SKIPPED (not expanded); the collapsed block's own text can match | same: skipped, not expanded |
| the tests | 2 files, React Testing Library | `spec/search.test.ts` (76 jsdom tests, 3 languages: dialog, text options, empty text, wrap, beep, collapsed, block types, rotor, API, keys in the help) and `e2e/search.e2e.ts` (real key presses in Chromium, 3 languages: F3, type, Enter, PageDown x3, wrap with its sound, PageUp, Escape and the focus is the block, no match, Ctrl-F, Tab inside, Right to the block tab, Ctrl-F3) |

API: `ed.search` (`open`, `close(go)`, `next`, `previous`, `rotor(forward)`, `settings`, `set`, `types`, `find`), so a page or a test can search without the dialog.

Differs from the old editor (all deliberate or noted):
- No Ctrl/Cmd-G (the task asked to check: the old editor has none; F3 opens the dialog there and is not "next").
- A match that is in NO block (between top-level blocks, in text that does not parse) is skipped; the old editor's `getNodeContainingBiased` returns nothing there and the search then reports no match. Comments are blocks here, so a match in a comment finds the comment block.
- "No match found" is also said (the old one only beeps); "Searching for next match..." after Enter is said as there.
- The dialog opens on the tab of the search that is current (the old one always on "Search by string"); choosing the "Search by block" tab with no type chosen picks the first type (the old one keeps "" and so finds nothing until a type is picked).
- The search rotor and the dialog work only where a block has the focus (as the old keymap).
- Order of a block-type search is the pre-order of the blocks (parent before children), a text search is by position; the old one does the same in effect (`getNodeAfter` and the search cursor).
- Jest 692 passed, tsc clean, `e2e/search.e2e.ts` 6 passed in Chromium.
