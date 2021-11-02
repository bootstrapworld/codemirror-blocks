import { ComponentClass } from "react";
import { ASTNode, Pos } from "../../ast";
import { ReadonlyCMBEditor } from "../../editor";
import { RootState } from "../../state/reducers";

export type Searcher<Setting, Props> = {
  label: string;
  setting: Setting;
  component: ComponentClass<Props>;
  search: (
    cur: Pos,
    settings: Setting,
    editor: ReadonlyCMBEditor,
    state: RootState,
    forward: boolean
  ) => { node: ASTNode; cursor: Pos } | null;
};
