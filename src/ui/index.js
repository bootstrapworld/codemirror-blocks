import React from 'react';
import ReactDOM from 'react-dom';
import {Toolbar} from './toolbar';
import {Editor} from './editor';

export function renderToolbarInto(blocks) {
  if (blocks.toolbarNode) {
    ReactDOM.render(<Toolbar blocks={blocks} />, blocks.toolbarNode);
  }
}

export function renderEditorInto(node, parser, options, cmOptions) {
  return ReactDOM.render(
    <Editor parser={parser} options={options} cmOptions={cmOptions}/>,
    node
  );
}
