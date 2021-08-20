import CodeMirror from "codemirror";
import { ComponentClass } from "react";
import { ASTNode, Pos } from "../../ast";
import { RootState } from "../../reducers";

export type Searcher<Setting, Props> = {
  label: string,
  setting: Setting,
  component: ComponentClass<Props>,
  search: (
    cur: Pos,
    settings: Setting,
    cm: CodeMirror.Editor,
    state: RootState,
    forward: boolean
  ) => {node: ASTNode, cursor: Pos}
}