import React from "react";
import {
  IUnControlledCodeMirror,
  UnControlled as CodeMirror,
} from "react-codemirror2";
import SHARED from "../shared";
import { API } from "./ToggleEditor";
import { AST } from "../ast";
import { Editor } from "codemirror";

// CodeMirror APIs that we need to disallow
// NOTE(Emmanuel): we should probably block 'on' and 'off'...
const unsupportedAPIs = ["startOperation", "endOperation", "operation"];

const buildAPI = () => {
  const api = {};
  // show which APIs are unsupported
  unsupportedAPIs.forEach(
    (f) =>
      ((api as any)[f] = () => {
        throw `The CM API '${f}' is not supported in CodeMirrorBlocks`;
      })
  );
  return api as API;
};

type Props = {
  cmOptions?: {};
  value: string;
  onBeforeChange?: IUnControlledCodeMirror["onBeforeChange"];
  onMount: (ed: Editor, api: API, ast: AST) => void;
  api?: API;
  passedAST?: AST;
};

const TextEditor = (props: Props) => {
  const { onMount, passedAST, value, onBeforeChange, cmOptions } = props;

  // build the API on mount
  const handleEditorDidMount = (ed: Editor) => {
    onMount(ed, buildAPI(), passedAST);
  };

  // Build the API for a text editor, restricting APIs that are
  // incompatible with our toggleable block editor
  return (
    // we add a wrapper div to maintain a consistent DOM with BlockEditor
    // see DragAndDropEditor.js for why the DND context needs a wrapper
    <div>
      <CodeMirror
        value={value}
        onBeforeChange={onBeforeChange}
        options={cmOptions}
        editorDidMount={handleEditorDidMount}
      />
    </div>
  );
};

export default TextEditor;
