import React from "react";
import { ASTNode } from "../ast";
import { DropTarget } from "./DropTarget";

export type ArgsProps = {
  field: string;
  children: ASTNode[];
};

const Args = ({ field, children }: ArgsProps) => {
  // elems starts with a dropTarget
  const elems = [<DropTarget key={"drop-0"} field={field} />];
  children.forEach((child, index) => {
    elems.push(child.reactElement({ key: "node" + index }));
    // Blocks and drop targets are identified by their place in the list: node
    // ids change with every parse, so keying by id would remount every block
    // on every edit.
    // eslint-disable-next-line @eslint-react/no-array-index-key
    elems.push(<DropTarget key={"drop-" + (index + 1)} field={field} />);
  });
  return <>{elems}</>;
};

export default Args;
