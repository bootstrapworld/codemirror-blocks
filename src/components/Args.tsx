import React from "react";
import { ASTNode } from "../ast";
import { DropTarget } from "./DropTarget";

export type ArgsProps = {
  field: string;
  children: ASTNode[];
};

const Args = (props: ArgsProps) => {
  const { field, children } = props;
  // elems starts with a dropTarget
  const elems = [<DropTarget key={"drop-0"} field={field} />];
  children.forEach((child, index) => {
    elems.push(child.reactElement({ key: "node" + index }));
    elems.push(<DropTarget key={"drop-" + (index + 1)} field={field} />);
  });
  return <>{elems}</>;
};

export default Args;
