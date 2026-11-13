# Experiment: "plain" mode (structured editing that looks like text)

Status: idea, spike pending. Block mode already edits through the AST and rejects any change that would not leave a valid program. A "plain" look would draw the blocks with no decoration (no borders, colours, drag handles; the editor's own font) and style the inline edit box like text, keeping focus movement, screen-reader labels and keyboard commands. See issue #106.

Open questions: whether rendered nodes keep the source's line breaks and indentation; what the caret does (block mode has none between characters); free-form text in strings and comments; pointer selection across nodes.

## Spike findings (2026-11-03, branch `claude/spike-plain-c1d013`, not for merge)

Code: on the branch `claude/spike-plain-c1d013` (local and on origin), not on `master`: `packages/codemirror-blocks/spike/` (Playwright scripts, `plain.css`; run against the example page on another port, e.g. `npm start -- --port 8124`) and a gated change in `src/components/Node.tsx` (`plainBody`, switched by `window.__cmbPlain`). Programs: `spike/programs.mjs` (wescheme only; the example page has no lambda page). Side-by-side screenshots (text mode | default blocks | plain) are in `doc/experiments/plain-mode/`.

### Verdict

Viable for the _look_, and cheap, once nodes render from the source text. Not viable by CSS alone. The obstacle for "feels like a text editor" is not the renderer but that block mode re-prints the program on every edit.

### 1. CSS alone: does not work

Stripping borders, backgrounds, padding, margins and forcing `display: inline; white-space: pre` on every node turns the program into a jumble: `define (f x)letbindingsdefiney+x1definez"hi there"cond>y3yelsez` (8 text rows become 2). The renderers (`render()` in each language's `ast.tsx`) build children from the AST _fields_, so no source whitespace is ever emitted, and they emit things that are not in the source: `define (` without the outer paren, a `bindings` pseudo-node for `let`, `define` labels for `let` bindings, `else`/`begin` nodes added by the parser, and a `drop-target` between children. Default block mode against text mode: line count 8 → 15, 7 → 7, 5 → 13, height 160px → 445px, 80 → 301.

### 2. Layout fidelity: two separate losses

(a) Toggling to block mode already rewrites the document (the pretty-printer, `ToggleEditor`: "pretty-print and re-parse to canonicalize"). `getValue()` right after the toggle, on my three programs: `; a comment` becomes `#| a comment |#`; `3.14` becomes `157/50`; `[ ]` bindings in `let` become `( )`; runs of spaces collapse (`(f   2)` → `(f 2)`); blank lines are normalised; `(define (fact n) (if ...))` is pulled onto ONE line (5 text lines → 2). Total nonspace characters differing from the original: 5 missing / 8 added (program 1), 4 / 9 (program 2), 0 / 0 (program 3, but 5 lines → 2). So block mode is not whitespace-faithful to what was typed, whatever the renderer does. Every later edit goes through the same printer (`performEdits.ts`, "user-entered text may not obey pretty-printing").

(b) The renderer, once it renders from the source: SPIKE change in `Node.tsx`. In plain mode a node renders its children as `editor.getRange()` slices of the document, with its child nodes' elements spliced in at their `srcRange()`s (gaps between children kept verbatim; synthetic children with overlapping or empty ranges skipped; comment elements not rendered since the comment is in the gap text). Result against the block-mode document text: **100% identical rows** (text and indentation) on all 3 programs (7/7, 5/5, 2/2 non-blank lines), line pitch identical (20px, same CodeMirror font), same x of first character, blank lines kept. Remaining difference to the _original_ text is only (a). The change is about 25 lines and language-independent (needs real `srcRange` on children; hand-built nodes would not have them).

### 4. Caret and editing feel (Chromium, plain mode)

- Click between two characters inside `define`: focuses the enclosing node (the whole top-level define); the CodeMirror caret does not move (stays at 0,0). No caret placement at all inside a node.
- Click on empty space below the code: puts the CodeMirror caret at the end of the line (focus in CM's hidden textarea) and no node is focused; click beside the code near the toolbar hits the mode toggle.
- Arrow keys move node to node (Down/Up/Left/Right work as in block mode). They visit the synthetic nodes too (`f,`, `1 argument: x,`, `y bound to + expression`) which have no visible text: focus moves but nothing visibly changes. The focus ring (dotted outline in the spike) is the only cue.
- Typing a character on a focused node does nothing (editing starts only on Enter / Ctrl-Enter).
- Ctrl/Cmd-Enter opens the edit box in place with no vertical jump (same y, same font metrics, 16px row) but with width 0 until text is typed (default blocks: min 20px); in my runs the box showed no initial text (`textContent` empty) in default mode too, so I did not establish whether that is how the box works or an artifact of driving it with `focus()`. Typing `7` then Enter replaced `2` and the document updated correctly: `(* y 7)`. After commit, focus jumped to the top-level node, not the edited one.
- Double-click on a small literal opened the edit box in default block mode but not in plain mode (unexplained: the 8px target? not investigated).

What a text-editor user would find surprising: no caret and no selection between characters; the whole expression reflows (including collapsed newlines/spacing and comment syntax) when a node is committed or the mode is toggled; arrow keys stop on invisible nodes; changes are rejected unless the result parses; no free-form typing in strings/comments.

### What it would take

1. A `plain` option (class on the wrapper plus `Node` reading it, not a `window` flag) with `plain.css` or a Less mixin: small.
2. Keep the user's text instead of pretty-printing: commit a node edit as a replacement of just the edited node's range (what the AST edit already knows), and do not re-print on toggle. This is the real work: `performEdits`/`ToggleEditor` assume canonical text, and the pretty-printer is how inserted and dropped nodes get their layout.
3. Caret model for plain mode (map a click/offset to the nearest node edge or to inside a literal) and skip nodes without visible text when arrowing.
4. Comments (`; x` vs the `#| |#` the printer produces), `[ ]` vs `( )`, and numbers (`3.14` vs `157/50`) need to round-trip from the source rather than the AST.
