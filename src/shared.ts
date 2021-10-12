import type { AST } from "./ast";
import type { Options } from "./CodeMirrorBlocks";

type Shared = {
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
