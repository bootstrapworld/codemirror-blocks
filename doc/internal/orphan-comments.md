# Orphan comments (exploration)

A comment is one of two things.

- **Attached**: it goes with a node. It is data (`node.options.comment`), shown
  in a popup while the node is active (`aria-hidden`, not a tab stop), and the node's spoken
  description gains "with comment: <text>".
- **Orphan**: it goes with no node. It is a real `comment` node
  (`options.orphan`), a sibling among the nodes of a list that can hold it. It
  is focusable (a tree item), reads as `comment: <text>`, is edited with
  Enter (not Shift-Ctrl-]) and deleted like any block.

## The rule

| Where the comment is                                                   | It goes with                         |
| ---------------------------------------------------------------------- | ------------------------------------ |
| On the line where code ends, after it                                  | that code                            |
| On its own line(s), and the next node starts on the very next line     | that node                            |
| On its own line(s), a blank line before the next node                  | nothing: an orphan                   |
| Before a node on that node's line                                      | that node                            |
| After the last node of the program, on the next line                   | the last node                        |
| After the last node of the program, a blank line between               | nothing: an orphan                   |
| In a list that cannot hold an orphan (cond clauses, `let` bindings...) | the node after it, or else before it |
| A program of only comments                                             | a program of one orphan              |

Comments in a row (no blank line between them) are one comment.

## Where orphans can live

`Spec.list(name, { orphans: true })` declares that a list can hold them.
Core: function application arguments, `begin`/`when`/`unless` bodies,
`cond` clause bodies; lambda: program statements and call arguments. A node
can opt out for one instance with `options.noOrphans` (WeScheme's `let`
binding list, which shares `sequence` with `begin`). The top level always can.

## Making and printing them

- WeScheme: the lexer hands a node the comment on the line above it and drops
  the rest, so `src/orphans.ts` scans the text for comments, takes those no node
  has, and `placeOrphans` puts each where it belongs. The lexer also gives a
  list any comment that came before it however far above, and the one above
  `'x` to the `x`: both are corrected.
- Lambda: the parser knows each list it fills, so it makes orphans there.
- An orphan prints followed by a blank line (that is what reads back as an
  orphan), which also keeps a call's arguments from printing on one line; one
  that comes after the last node of a program is set apart by a blank line
  before it too. Commas and semicolons are for real arguments and statements only.

## Editing

- Shift-Ctrl-] on an owner edits its comment; emptying it removes it. On an
  orphan it only says to press Enter: an orphan is edited like any block.
- An owner's comment shows in a popup beside the node while it is active; there is no badge. Only orphans are always visible.
- Deleting an owner leaves its comment behind as an orphan. Cutting or moving
  one takes the comment along. Moving an orphan moves only the orphan.

## Spoken text (needs the user's eye)

- Owner: "…, with comment: <text>" (the comment text is read once, after the
  node, as before the popup; the popup itself is `aria-hidden`).
- Orphan: "comment: <text>".
- "with N arguments", "N expressions" and WeScheme's "applying f to N
  arguments" do not count orphans. The summary counts them as "comments".

## Open questions

1. **Same-start ambiguity.** `#| c |#\nx = 1` is a comment on the assignment or
   on `x`: the text cannot say, so a comment on the left operand moves up to the
   whole assignment after a round trip. (Before this change too.) The random
   round-trip invariant compares the words of attached comments, not which node.
2. **Two comments on one node** (leading and trailing) are still joined into
   one.
3. **Required fields.** Deleting an owner that sits in a required field (not a
   list) loses the comment: the field becomes a blank.
4. **WeScheme `'x`, `#(...)`, and forms with no block** (quote, local, case...)
   keep a comment above them as an orphan, or inside their text.
5. **A line comment is written back as a block comment** (`#| |#`), as before.
6. **Multi-line attached comments.** The WeScheme lexer gives an attached group
   of `;` lines the location of its last line only, so the first lines are
   outside the node's range.
7. **Pre-existing, found on the way**: WeScheme prints a string with `\"` in it
   without the backslash.
8. **`options.comment` is a node, `options.orphan` a flag**: an orphan made by
   hand needs the flag for its printing and its rendering.
9. Dragging an orphan within a list prints it with a blank line after it, so it
   stays an orphan; an owner dragged into a place where the next line is another
   node's start carries its comment above it as before.
10. Search (`ByString`) and the toolbar are untouched; whether the search
    should match comment text is open.
