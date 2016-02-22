import React from 'react';
import ReactDOM from 'react-dom';
import Toolbar from './Toolbar';
import Editor from './Editor';

export function renderToolbarInto(blocks) {
  if (blocks.toolbarNode) {
    return ReactDOM.render(<Toolbar primitives={blocks.parser.primitives} />, blocks.toolbarNode);
  }
}

export function renderEditorInto(node, language, options, cmOptions) {
  return ReactDOM.render(
    <Editor language={language} options={options} cmOptions={cmOptions}/>,
    node
  );
}
