import React from 'react';
import ReactDOM from 'react-dom';
import {Toolbar} from './toolbar';

export function renderToolbarInto(node) {
  ReactDOM.render(<Toolbar />, node);
}
