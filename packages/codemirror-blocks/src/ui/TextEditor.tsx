import React from "react";
import CodeMirror from "codemirror";
import CodeMirrorHost from "./CodeMirrorHost";

type Props = {
  codemirror: CodeMirror.Editor;
  value: string;
  onMount: (ed: CodeMirror.Editor) => void | (() => void);
};

const TextEditor = (props: Props) => {
  return (
    // we add a wrapper div to maintain a consistent DOM with BlockEditor
    // see DragAndDropEditor.js for why the DND context needs a wrapper
    <div>
      <CodeMirrorHost
        codemirror={props.codemirror}
        value={props.value}
        editorDidMount={props.onMount}
      />
    </div>
  );
};

export default TextEditor;
