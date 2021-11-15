import React from "react";
import {
  IUnControlledCodeMirror,
  UnControlled as CodeMirror,
} from "react-codemirror2";

type Props = {
  codemirrorOptions?: CodeMirror.EditorConfiguration;
  value: string;
  onBeforeChange?: IUnControlledCodeMirror["onBeforeChange"];
  onMount: (ed: CodeMirror.Editor) => void;
};

const TextEditor = (props: Props) => {
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
        editorDidMount={props.onMount}
      />
    </div>
  );
};

export default TextEditor;
