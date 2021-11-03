import React from "react";
import {
  IUnControlledCodeMirror,
  UnControlled as CodeMirror,
} from "react-codemirror2";
import { API } from "./ToggleEditor";
import { CodeMirrorFacade } from "../editor";

// CodeMirror APIs that we need to disallow
// NOTE(Emmanuel): we should probably block 'on' and 'off'...
const unsupportedAPIs = ["startOperation", "endOperation", "operation"];

const buildAPI = () => {
  const api = {};
  // show which APIs are unsupported
  unsupportedAPIs.forEach(
    (f) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((api as any)[f] = () => {
        throw `The CM API '${f}' is not supported in CodeMirrorBlocks`;
      })
  );
  return api as API;
};

type Props = {
  codemirrorOptions?: CodeMirror.EditorConfiguration;
  value: string;
  onBeforeChange?: IUnControlledCodeMirror["onBeforeChange"];
  onMount: (ed: CodeMirrorFacade, api: API) => void;
};

const TextEditor = (props: Props) => {
  // build the API on mount
  const handleEditorDidMount = (ed: CodeMirror.Editor) => {
    props.onMount(new CodeMirrorFacade(ed), buildAPI());
  };

  // Build the API for a text editor, restricting APIs that are
  // incompatible with our toggleable block editor
  return (
    // we add a wrapper div to maintain a consistent DOM with BlockEditor
    // see DragAndDropEditor.js for why the DND context needs a wrapper
    <div>
      <CodeMirror
        value={props.value}
        onBeforeChange={props.onBeforeChange}
        options={props.codemirrorOptions}
        editorDidMount={handleEditorDidMount}
      />
    </div>
  );
};

export default TextEditor;
