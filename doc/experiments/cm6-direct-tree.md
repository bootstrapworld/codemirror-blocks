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
