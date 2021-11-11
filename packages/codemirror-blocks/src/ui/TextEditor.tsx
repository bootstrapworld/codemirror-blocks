import React from "react";
import {
  IUnControlledCodeMirror,
  UnControlled as CodeMirror,
} from "react-codemirror2";
import { CodeMirrorFacade } from "../editor";

type Props = {
  codemirrorOptions?: CodeMirror.EditorConfiguration;
  value: string;
  onBeforeChange?: IUnControlledCodeMirror["onBeforeChange"];
  onMount: (ed: CodeMirrorFacade) => void;
};

const TextEditor = (props: Props) => {
  // build the API on mount
  const handleEditorDidMount = (ed: CodeMirror.Editor) => {
    props.onMount(new CodeMirrorFacade(ed));
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
