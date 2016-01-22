import React from 'react';
import ReactDOM from 'react-dom';
import {Toolbar} from './toolbar';

export function renderToolbarInto(blocks) {
  if (blocks.toolbarNode) {
    ReactDOM.render(<Toolbar blocks={blocks} />, blocks.toolbarNode);
  }
}
