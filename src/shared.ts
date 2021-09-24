import type CodeMirror from "codemirror";
import type { AST } from "./ast";
import type { Options } from "./CodeMirrorBlocks";

type Shared = {
  cm: CodeMirror.Editor;
  options: Options;
  buffer: HTMLTextAreaElement;
  search: {
    onSearch: Function;
    search: Function;
    setCursor: Function;
    setCM: Function;
  };
  parse: (code: string) => AST;
  getExceptionMessage: Function;
};

export default {} as Shared;
