/*
 * EXPERIMENT (see doc/experiments/cm6-direct-tree.md). The contract between the
 * parts of this package. Nothing here imports React, CodeMirror 5 or the
 * `codemirror-blocks` package.
 *
 * The idea being tried: ONE tree, kept for the life of the document, that is
 * changed in place by a few explicit operations. Each operation says exactly
 * what changed, so the text, the positions and the page are each patched for
 * that change only. Nothing parses the whole document again after an edit and
 * nothing compares an old tree with a new one.
 */

/** A node of the tree. It is mutable, and its `id` never changes. */
export interface BNode {
  readonly id: number;
  /**
   * What it is: "literal", "blank", "call", "define", "lambda", "cond",
   * "clause", "if", "unknown" (a list that is none of those), "program" (the
   * one root: its only slot is the list "roots").
   */
  kind: string;
  /** Offsets in the document. Kept right by `shift` after every change. */
  from: number;
  to: number;
  parent: BNode | null;
  /** the slot of `parent` this node is in (null for the program) */
  slot: Slot | null;
  /** The children, in the order they are written in the text. */
  slots: Slot[];
  /** for a literal or a blank: its text as written (`42`, `"hi"`, `x`, `...`) */
  value?: string;
  /** for a literal: "number" | "string" | "symbol" | "boolean" | "char" | "other" */
  dataType?: string;
  /**
   * ADDED by the model core: for a node with a `keyword`, the offset where the
   * keyword ends in the text (so a child can be put right after it, however much
   * space or comment the source has between the bracket and the keyword).
   */
  keywordTo?: number;
  /** the word drawn at the head of a compound node (`define`, `cond`, `if`, `lambda`); none for a call */
  keyword?: string;
  /** the brackets it is written in: "()" or "[]" (compound nodes only) */
  brackets?: "()" | "[]";
}

/**
 * A named place for children.
 * - "one": always exactly one node. Deleting it puts a blank (`...`) there.
 * - "list": any number. Nodes are inserted and removed.
 */
export interface Slot {
  readonly name: string;
  readonly kind: "one" | "list";
  readonly owner: BNode;
  nodes: BNode[];
}

/** A change of the text: replace [from, to) with `insert`. Offsets are in the text BEFORE the change. */
export interface TextChange {
  from: number;
  to: number;
  insert: string;
}

/**
 * What an operation did. One operation makes ONE text change and one of three
 * changes to the tree, which is all a listener (the page, the editor) needs in
 * order to patch itself.
 */
export type TreeChange =
  | { type: "insert"; node: BNode; slot: Slot; index: number }
  | { type: "remove"; node: BNode; slot: Slot; index: number }
  /** `old` is out of the tree, `node` is where it was (same slot, same index) */
  | { type: "replace"; old: BNode; node: BNode; slot: Slot; index: number };

export interface OpResult {
  text: TextChange;
  tree: TreeChange;
}

/** A language: how text becomes nodes, and how a node is written. */
export interface Language {
  /**
   * Parse `text` (a whole document, or a part of one that starts and ends
   * between top-level forms). Offsets of the nodes are offsets in `text` plus
   * `offset`. Throws `ParseError` if the text is not a sequence of whole forms.
   * Comments are skipped: they stay in the text, and no node holds them.
   */
  parse(text: string, offset?: number): BNode[];
  /** The text of a node that is not in a document yet (it is written on one line). */
  print(node: BNode): string;
  /** A blank: what is left where a node that has to be there is deleted. */
  blank(): BNode;
  /**
   * ADDED by the model core (optional): read `text` as a node of the given
   * `kind` that is not a form of its own (a cond clause `[a 1]` reads as a call
   * on its own), with offsets plus `offset`. Null if it cannot. Used to place a
   * node that was written alone.
   */
  parseAs?(kind: string, text: string, offset: number): BNode | null;
  /** What a screenreader says of the node. */
  describe(node: BNode): string;
}

export class ParseError extends Error {}

/** The document: the program node and the text it stands for. */
export interface Doc {
  readonly language: Language;
  /** kind "program", from 0 to the length of the text, one list slot "roots" */
  readonly program: BNode;
  /** every node in the tree, by id (kept up to date by the operations) */
  readonly byId: Map<number, BNode>;
}
