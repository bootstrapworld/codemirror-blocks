# Plan: split `Node.tsx`, and give keyboard focus one owner

Status: proposed, not started. Nothing here changes what the editor does for a
user; it changes where the code that does it lives.

## The problem

The store says which block is focused (`focusId`). The browser says which
element is (`document.activeElement`). They drift apart whenever CodeMirror
moves, removes or redraws a block's elements without React rendering, and the
code that brings them back together is in nine places, each added for one bug:

| #   | Where                               | What it does                                                                            | Trigger                               |
| --- | ----------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------- |
| 1   | `state/actions.ts` `activateByNid`  | sets `focusId`, then focuses the element, or the placeholder if it is not on the page   | every activation                      |
| 2   | `Node.tsx` effect A                 | focuses the block's element when it becomes the focused one                             | render (`isFocused`, `editable`)      |
| 3   | `Node.tsx` effect B                 | refocuses if focus is on the body, for 10 frames (120 if it started there)              | every render of the focused block     |
| 4   | `Node.tsx` effect C                 | refocuses when the page changes and focus is on the body, unless a press was made since | `MutationObserver` on `document.body` |
| 5   | `Node.tsx` effect D                 | takes focus back from CodeMirror's textarea, for 5 frames, after a press on the block   | render, within 500 ms of a press      |
| 6   | `ui/ToplevelBlock.tsx`              | refocuses the focused block after the root's marker is remade                           | every render of a root                |
| 7   | `ui/BlockEditor.tsx` `onUpdate`     | refocuses a parked or dropped focus; scrolls to a block that is not drawn (`owesFocus`) | CodeMirror `update`                   |
| 8   | `ui/BlockEditor.tsx` `hadBlocksRef` | focuses the editor when the last block goes away                                        | render (`ast`)                        |
| 9   | `ui/Search.tsx` `handleAfterClose`  | refocuses the block if the dialog gave focus back to the placeholder                    | dialog close                          |

Three of them define "stranded" (body, null or the placeholder) separately, two
look the element up by `getElementById` and two by `nodeElementMap`, and four
count animation frames with different constants (10, 120, 30, 5). Both focus
bugs found this week were an interaction between two of these, and both were
only visible on Preact or on a slow machine.

`Node.tsx` itself is 808 lines with 12 effects: 5 of them are focus (above), 2
place the comment box, and the rest are what a block is actually for.

## The target

One module, `src/focus.ts`, with one object per editor (made in `BlockEditor`,
where the CodeMirror and the store are both at hand) and one rule:

> If the store names a focused block, and the browser's focus is _stranded_, and
> the user has not _left_ the editor, focus that block's element. If the element
> is not on the page, park focus on the placeholder and scroll to the block, and
> try again when the page next changes.

- _Stranded_: `activeElement` is null, the body, or the placeholder; or it is
  CodeMirror's textarea within a moment of a press on a block (case 5).
- _Left_: a press outside the editor, or focus arriving on an element outside
  it, since focus was last inside. Cleared when focus is next inside. One flag
  for the editor, not one per block.
- It runs the rule when: `focusId` changes, CodeMirror fires `update`, an
  element inside the editor's wrapper is added or removed, or focus leaves an
  element of the editor for nothing. The `focusId` and `update` triggers run at once;
  the mutation and `focusout` triggers run in the next frame, at most once per
  frame. The
  only retry is "the element is not on the page yet", bounded once, in one place.

Then 2 to 9 above are deleted, and 1 keeps only the store update. Edit boxes
(`NodeEditable`) keep their own focus: an open box is not stranded focus, so
the rule leaves it alone.

## Steps

Each step is one commit, and each must pass the full sequence before the next:
jest, eslint, typecheck, and the 145 browser tests on React and on Preact.

**Phase 0: pin what happens today.** For each row of the table, name the test
that fails if it is removed. Where there is none, write one first (jsdom where it
can be shown there, as `spec/focus-rescue-test.tsx` does; otherwise e2e). This
is the list the later steps are checked against. Known gaps to check: 6, 8, 9.

### Phase 0 results

Method: each mechanism was disabled by a one-line text replacement, and jest, the
145 browser tests on React and on Preact, and `e2e/random.e2e.ts` at
`CMB_CPU_THROTTLE=4` on Preact were run (`--workers=2 --retries=0`). The baseline
with nothing disabled was clean: jest 2001/2001, browser 145/145 on both, random
17/17. Row numbers are those of the table at the top.

| #   | Mechanism disabled                         | jest                                                        | React browser                         | Preact browser                                  | Throttled random | Verdict                                             |
| --- | ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------- | ----------------------------------------------- | ---------------- | --------------------------------------------------- |
| 1a  | `activateByNid`: focus the element         | 22 tests                                                    | 9 (collapse-all, search, undo-focus)  | the same 9                                      | -                | covered                                             |
| 1b  | `activateByNid`: focus the placeholder     | 2 (`focus-recovery`: undrawn block; search dialog)          | -                                     | -                                               | -                | covered by jsdom only                               |
| 2   | `Node.tsx` effect A                        | -                                                           | -                                     | -                                               | -                | **possibly redundant** (see below)                  |
| 3   | `Node.tsx` effect B (frame watch)          | -                                                           | -                                     | -                                               | -                | **possibly redundant** (see below)                  |
| 4   | `Node.tsx` effect C (observer)             | 1 (`focus-rescue`: takes focus back after the page changes) | -                                     | -                                               | 1 (seed 270)     | covered; the browser tests alone do not see it      |
| 5   | `Node.tsx` effect D (textarea after press) | -                                                           | -                                     | 1 (`moved-blocks`: several inserts and deletes) | -                | covered **on Preact only** (fails 6 of 6 repeats)   |
| 6   | `ToplevelBlock` refocus                    | -                                                           | 1 (`edit-comment`: drop, unsaved box) | -                                               | -                | **not covered**: that failure was noise (see below) |
| 7   | `BlockEditor` `onUpdate`                   | 1 (`focus-recovery`: undrawn block)                         | 3 (collapse-all x2, `focus-dropped`)  | the same 3                                      | -                | covered                                             |
| 8   | `BlockEditor` last block gone              | 2 (`focus-recovery`; search rotor)                          | 1 (`trash-can`)                       | 7 (matrix, `insert-beside-root`, `trash-can`)   | -                | covered                                             |
| 9   | `Search` after close                       | 1 (`focus-recovery`: search dialog)                         | -                                     | -                                               | -                | covered by jsdom only                               |

Reading it:

- **Covered on one framework only (5, 6).** 5 is a real Preact-only catch: with it
  disabled, `moved-blocks` "blocks keep working after several inserts and deletes
  above them" fails 6 of 6 repeats on Preact and passes 6 of 6 on React. Whoever
  replaces it must run the Preact suite. The one failure of 6 (React,
  `edit-comment` "a drop with a comment box that cannot be saved") did not
  repeat: 0 of 6 failures on either framework, with or without the mechanism.
  That is a flaky test under load (it fails once in a full run), not coverage of 6.
- **Covered only by the throttled run (4, in the browser).** The jsdom test
  `focus-rescue-test.tsx` also covers it, so a refactor has a fast check.
- **Noise.** Nothing in the baseline failed or was flaky. Failures that appear
  under several mutations (the `collapse-all-focus`, `search` and `matrix`
  groups) come from 1a, 7 and 8 all being on the path of the same user actions.
- **Possibly redundant: 2, 3 and 6.** No test fails when they are disabled, on
  jest, React, Preact or the throttled run. For each, scenarios that a user would
  notice (which element has keyboard focus afterwards) were tried, with the
  mechanism disabled, and all passed:
  - 2 (effect A): committing an edit with Enter, cancelling it with Escape, undo of
    a delete, switching to text mode and back, and an edit of a sibling or of a
    later root through the API (jsdom); committing an edit and undo in the browser.
  - 3 (effect B): the widget swapped with focus dropped to the body, text changed
    in a sibling or in a later root, a root added after, a line inserted before
    (jsdom); a line inserted before, and the focused root scrolled out of the
    window and back (browser).
  - 6 (`ToplevelBlock`): the same API edits before and after the focused root with
    a child or the root itself focused, with focus dropped to the body first
    (jsdom); a line inserted before the focused root (browser).

  Effects C and D, 1a and 7 each do the same work in these cases, so A, B and 6
  are masked while those are in place. Removing them is safe only together with
  the move to one rule; no test says otherwise, so if a bug turns up that only one
  of them fixed, the test for it is the thing missing. No test was written for
  these, because none could be made to fail.

- **A mismatch seen while looking, not changed.** When the text of one root is
  changed through the API (`replaceRange`) while a block of another root has
  keyboard focus, the store moves `focusId` to the edited root, and the keyboard
  focus stays on the block it was on. Effect A does not take focus then, because
  the editor does not "have focus" and something else (a block) does. This is
  today's behaviour; the rule under "The target" would bring them together
  (decision 2 above). It is a user-visible change if so decided.

**Phase 1: split `Node.tsx`, moving code and changing none.**

- `components/commentBox.ts`: `placeCommentBox`, `onEditorUpdate` and the two
  layout effects, as `useCommentBoxPlacement(...)`.
- `components/useNodeFocus.ts`: effects A to D and `pressedAtRef`, verbatim.
- `Node.tsx` keeps state, handlers, drag and drop, and the render. About 500 lines.

**Phase 2: move the mechanisms into `focus.ts`, one at a time.** In this order,
because it goes from the ones that already overlap to the ones that stand alone:

1. **Done** (2026-11-12). 4, 6 and 7 (focus dropped with no render): the three
   became the rule's triggers. This is the step most likely to show a difference on Preact.
2. **Done** (2026-11-12). 3 (the frame-counting watch): deleted. No trigger had
   to be added: nothing failed without it.
3. **Done** (2026-11-12). 5 (the textarea after a press): deleted, and not moved
   into the keeper. With the keeper in place, a press on a block no longer ends
   with CodeMirror's textarea having focus, with or without effect D:
   `e2e/press-focus.e2e.ts` and `moved-blocks.e2e.ts:87` pass on Preact with it
   disabled. Before the keeper, a second focus call on the block came right
   before the textarea took focus, so effect D was guarding against a call made
   by a mechanism that step 1 removed. Which one was not identified.
   `press-focus.e2e.ts` stays as the guard.
4. 2, and the element focus in 1.
5. 8 and 9.

**Phase 3: soak.** React (jsdom and e2e), React motion, Preact e2e, Preact
motion, and the random suite at `CMB_CPU_THROTTLE=4` on both.

## When to stop

- If a step only passes by adding a new timing constant, stop: the rule is
  missing a trigger, and that is worth understanding before going on.
- If Phase 0 shows behaviour that the rule above would change for a user (not
  only for a test), stop and decide it, do not let the refactor decide it.

## Decisions made

Made by the owner on 2026-11-12.

1. **"Left" is per editor, and a press outside the editor is leaving.** After
   one, the editor does not take keyboard focus back. (Today effect B takes focus
   back for about 10 frames even after a press on the page background.)
2. **A programmatic change while focus is elsewhere on the page** (`setValue`
   from the page's own code, while the user is typing in another field) does not
   bring focus into the editor. This is what happens today; the rule makes it
   explicit.
3. **One way to find a block's element:**
   `document.getElementById("block-node-" + id)`. `nodeElementMap` is deleted at
   the end, if nothing else needs it.
4. **A programmatic edit (through the API) while a block has keyboard focus does
   not move the focused block in the store:** the store and the keyboard stay on
   the block the user was on. (Today the store moves `focusId` to the edited root
   and the keyboard stays: see "A mismatch seen while looking" above.) This is a
   change in the edit path, not in the focus code: it is Phase 2, step 6, after
   the mechanisms have moved.

## Who does it

Phase 1 is mechanical and suits a cheaper model with the checks above. Phases 0
and 2 need judgment about what a failing test means, so they are better done
with review of each step. Phase 3 is machine time.
