import React from 'react';
import ReactDOM from 'react-dom';
import Toolbar from './Toolbar';
import Editor from './Editor';
import CodeMirrorBlocks from '../blocks';


export function renderToolbarInto(blocks) {
  if (blocks.toolbarNode) {
    ReactDOM.render(
      <Toolbar primitives={blocks.parser.primitives} renderer={blocks.renderer} />,
      blocks.toolbarNode
    );
  }
}

export function renderEditorInto(node, language, options, cmOptions) {
  let editor;
  ReactDOM.render(
    <Editor ref={ed => editor = ed } language={language} options={options} cmOptions={cmOptions}/>,
    node
  );
  return editor;
}