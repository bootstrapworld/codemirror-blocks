import type CodeMirror from "codemirror";
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
  parse: Function;
  getExceptionMessage: Function;
  recordedMarks: Map<number, {
    from: CodeMirror.Position;
    to: CodeMirror.Position;
    options: CodeMirror.TextMarkerOptions;
  }>;
  announcer: HTMLElement;
}

export default {} as Shared;
