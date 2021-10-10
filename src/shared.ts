import type { AST } from "./ast";
import type { Options } from "./CodeMirrorBlocks";
import { CMBEditor } from "./editor";

type Shared = {
  cm: CMBEditor;
  options: Options;
  search: {
    onSearch: Function;
    search: Function;
    setCursor: Function;
    setCM: Function;
  };
  parse: (code: string) => AST;
};

export default {} as Shared;
