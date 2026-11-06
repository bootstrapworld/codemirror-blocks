import React from "react";
import { ASTNode } from "../ast";
import { DropTarget } from "./DropTarget";

export type ArgsProps = {
  field: string;
  children: ASTNode[];
};

const Args = ({ field, children }: ArgsProps) => {
  // elems starts with a dropTarget
  const elems = [<DropTarget key={"drop-0"} field={field} index={0} />];
  children.forEach((child, index) => {
    elems.push(child.reactElement({ key: "node" + index }));
    // Blocks and drop targets are identified by their place in the list: node
    // ids change with every parse, so keying by id would remount every block
    // on every edit.
    const after = index + 1;
    const key = "drop-" + after;
    elems.push(<DropTarget key={key} field={field} index={after} />);
  });
  return <>{elems}</>;
};

export type ListItem = {
  /** the element of the list */
  node: ASTNode;
  /**
   * Its place in the list, which is what a DropTarget before it is given as its
   * `index` (the one after the last has the length of the list). Orphan
   * comments in the list are elements, and count.
   */
  index: number;
  /** it is an orphan comment, that goes with no node */
  isOrphan: boolean;
  /**
   * What to number it as, for a layout that shows numbers (1, 2, 3, ...): the
   * count of the elements that are not orphan comments up to and including
   * it, or null for an orphan comment. It is not its `index`.
   */
  number: number | null;
};

/**
 * The elements of a list field, each with its place in the list and whether it
 * is an orphan comment (see {@link ListItem}), for a layout that draws the list
 * in a way of its own. Use every one: leaving the comments out would make the
 * index of the drop targets after them too low.
 */
export function listItems(list: readonly ASTNode[]): ListItem[] {
  let count = 0;
  return list.map((node, index) => {
    const isOrphan = Boolean(node.options.orphan);
    if (!isOrphan) count++;
    return { node, index, isOrphan, number: isOrphan ? null : count };
  });
}

export default Args;
