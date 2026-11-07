# Notes from writing Routine

Routine (`packages/codemirror-blocks/src/languages/routine`) is a small
language written to use the editor's newer API as a language author would:

| What it shows                                                                             | Where                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A block drawn from its state (`useNodeState`)                                             | a name shows what is defined before it while it is edited (`ScopeHint`, as the `editingHint`); a collapsed loop says how many steps are hidden (`LoopStatus`); a value says it would be replaced while something is dragged over it (`ReplaceHint`)                           |
| Drop targets that are not beside the elements they are for (`DropTarget` with an `index`) | a loop's steps are a numbered list with a target for each gap in the gutter, and the target for the end of the list is in the loop's head, above all the steps                                                                                                                |
| `listItems`, with orphan comments in the list                                             | the step numbers skip a comment, the drop-target indices do not                                                                                                                                                                                                               |
| A drop target for an empty optional field                                                 | `(let spare)` has a target where the start would be; `(if test then)` has one for the `otherwise`, drawn up beside the test and not where the otherwise will be                                                                                                               |
| `pretty()` that returns text                                                              | the atoms (a number, a name, a text)                                                                                                                                                                                                                                          |
| What is spoken, made from the label                                                       | the label of each kind of node is declared once in the spec; the aria label (`name minutes`, `calculation +`) and the long descriptions (`a repeat loop, number 4 times, of 2 definitions, 2 show steps and a calculation`) are made from `node.label` and `node.pluralLabel` |
| Comments                                                                                  | `;` and `#                                                                                                                                                                                                                                                                    |     | #`, on the line above a node (goes with it) or on their own (a block among the steps) |

Try it with `npm start` in `packages/codemirror-blocks` and open
`/?lang=routine` (the example page shows another language for `?lang=<id>`).
The tests are `spec/routine-roundtrip-test.ts`, `spec/routine-test.tsx` and
`e2e/routine.e2e.ts`.

What follows is what felt clunky or too complex while writing it (item 4 of
#451), and where the editor's styles helped or had to be overridden (item 2).
Each item says what I did, and what I would want instead.

## API: clunky or too much

Size first. The language is about 500 lines, and three quarters of that is
boilerplate that every language would repeat. A kind of node costs about 30
lines before it does anything.

1. **A node said its fields four times.** The spec, the constructor's parameters,
   the `fields: { ... }` of `makeNode`, and the parser's call. That is now
   `defineNode({ type, label, fields: { name: field.required(), ... }, pretty,
render })`, which gives the constructor (#811): Routine's nodes went from 435
   lines to about 330, with the fields typed.

2. **Every language wrote its own `make` wrapper**, to give a node its comment
   and its aria label. The editor prints the comment of every node now (#812),
   by one set of rules, and a kind made with `defineNode` declares its aria
   label once.

3. **The label was declared per kind of node, the aria label per node.** `label`
   is in the spec, written once, but `ariaLabel` was in `options`, so `name
minutes` had to be put on every name that was made. A kind made with
   `defineNode` declares `ariaLabel` once (it is made from the node, and so from
   its label). Everything built from the label follows: a rename of a label
   renames it in `shortDescription` and in every long description.

4. **No helper to describe what is in a list.** The summary "2 definitions, 2
   show steps and a calculation" needs the plural label of each kind and a
   count: `pluralize` and `enumerateList` exist but are `@internal`, and know
   nothing of labels, so `summarize` in `ast.tsx` is my own. _Want:_ a public
   `describeKinds(nodes)` (or an option of `describe`) that does this.

5. **A block cannot ask for the AST.** The scope hint has to know the names
   defined before it. There is no hook: I used `useStore()`, the internal
   `selectors.getAST` and `currentNode(ast, node)`, and then walked up the
   parents to find the list that holds a node by hand (`findInsertionPlace` does
   this, and is not public). _Want:_ `useAST()`, or `useNodeContext()` giving
   `{ parent, siblings, ancestors }`, read-only, like `useNodeState`.

6. **`useNodeState` has gaps.**
   - `over` is only true for blocks that a drop _replaces_ (the ones drawn with
     `normallyEditable`), not for a container: a loop cannot say "drop to add a
     step" of itself, and I had to move that to the values. A language wants it
     for any block, or for its drop targets.
   - There was no `editing`, and while a block is edited its children are _not
     drawn_ (the box takes their place). So the scope hint, which is the
     dropdown that #451 item 3 asks for, was not there while the name was being
     edited, which is the moment it is wanted. It is now: `useNodeState` has
     `editing`, and `<Node editingHint={...}>` is drawn beside the edit box
     (#815).

7. **`Args` drew no container**, and the editor's style lays out the arguments of
   a call in `.blocks-args`, so a language had to write `<span
className="blocks-args">` around it, from reading the stylesheet. It takes a
   `className` now (#816): `<Args className="blocks-args" field="args">`.

8. **Pretty-printing a form with optional children and a list body was manual.**
   `P.standardSexpr("let", [name, start ?? ""])` left a trailing space for an
   absent `start`, and a form with a list body, one to a line, with the closing
   bracket after the last, was built from `vert`, `horz` and `vertArray`; an
   orphan comment in it printed a blank line with the indentation in it. They
   are `sexpr` and `formSexpr` now, and a document is printed with no whitespace
   on a line of nothing else (#817).

9. **Comments in the parser were a second parser.** Finding the comments again,
   deciding which node each goes with, and giving the rest to `placeOrphans` was
   about 40 lines, and the WeScheme and lambda parsers each did their own. It is
   now `attachComments(code, roots, { blockComment, comments })`, which Routine
   uses (#818): the reader reports the comments it skips, and that is all.

10. **Types are heavy at the edges.** `Spec.value<number, "value">("value")`
    (the type parameters are in the wrong order for what a person knows: the
    name is the thing written), `Parameters<typeof RoutineAST.makeNode<T>>[0]`
    for a wrapper, `fields` typed through the spec so that `node.fields.name` is
    an `ASTNode` and `node.fields.name.fields.name` is `unknown`. I did not find
    a way to write the wrapper without the `Parameters<...>` form.

11. **A language registers itself with `require("./style.less")`** in its index.
    That is the dependence on a bundler of #509, and it has to be there for the
    language to have any look at all (see the next section).

12. **The example page and the test helpers know one language.** `createDebugging
Interface(language, code)` was fine, but `editor-example.js` was WeScheme only
    (I added `?lang=`), and `openInBlockMode` in the e2e helpers had no language
    (I added a parameter). A new language should be a one-line addition.

13. **An empty toolbar.** A language with no `primitivesFn` gets the search box
    and nothing else (the empty panel on the left of the editor). Fine for
    Routine, but nothing says that it is optional or what it would hold.

What was nice: `listItems` made the numbered list with the targets away from the
steps short and obviously right (the number and the index cannot be mixed up);
the drop target needing only `field` and `index` (and nothing at all but `field`
for an empty optional field); `useNodeState` being one hook that returns plain
booleans; and labels being one place for everything that is spoken.

## Styles: what I took, what I overrode

The editor has no stylesheet that works for a new language, and that is the
biggest thing. With an empty `style.less` Routine is **bare text**: no frames, no
drop targets to see, nothing to tell a block from its neighbour. What I did:

- **Took** the editor's default style by importing it inside the language's
  class (`.blocks-language-routine { @import "../../less/default-style.less"; }`,
  as WeScheme does). That gives, for any language: the drop target squares and
  how they look under the pointer and when something is dragged over; selection,
  focus, the edit box, an error; comments (the balloon, the popup, a comment
  that is a block of its own); collapsing; the lock. This part worked, and I
  wanted all of it.
- **Had to borrow** the frame of a compound block and the pill of a value,
  because the default style listed WeScheme's kinds of node by name
  (`.blocks-functionApp, .blocks-ifExpression, ...`): a new language's kinds got
  none of it until it said so, with LESS `:extend` (which had to be _outside_ the
  language's block: inside it, the class is put on the selector twice and
  nothing matches; I lost some time to this). That is now `<Node
variant="compound">` and `variant="value"` (#819), which put `blocks-compound`
  and `blocks-value`, which the default style styles: Routine's style has no
  `:extend` any more. The black strip at the top is `.blocks-operator`, which
  the render still puts on by hand.
- **Overrode** what is Routine's own: the loop's numbered list (resetting `ol`),
  the gutter, the rows, the branches of a choice; the things that sit in the black
  strip of a loop and a choice (the number, the white-space targets: light pills
  on black); and `.routine-body`, a wrapping row for what is in a
  `let` or a `show`. About 100 lines, all layout.
- **Wanted from the editor, and did not have:**
  - The look of a _hint_ or a _badge_ that a block draws about its own state: I
    made `.routine-hint`. That is the class `blocks-hint` now (#819).
  - A way to get all this **without LESS** (#509): the import of
    `default-style.less` inside a class is how the variables (`@border-radius`,
    the colors) are passed in. CSS custom properties would do the same with a
    plain stylesheet and no compile step.
  - **Reduced motion.** The default style put `transition: all 0.5s` on blocks,
    and the editor fades blocks in and slides the toolbar open; there was no
    `prefers-reduced-motion` anywhere in the style (now fixed, #820).
    A Playwright click on a small target also missed once, because the toolbar
    slides open for half a second when block mode starts and everything is
    moving (the test now waits for the target to stop).
  - The toolbar's empty state (above).
