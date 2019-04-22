import React from 'react';
import ReactDOM from 'react-dom';
import ToggleEditor from './ui/ToggleEditor';
import merge from './merge';
import pyret from './languages/pyret';
export const Args = require('./components/Args');
export const DropTarget = require('./components/DropTarget');
export const AST = require('./ast');
export const Nodes = require('./nodes');
export const Languages = require('./languages');
export const DefaultStyle = require('./less/default-style.less');

// Consumes a DOM node to host the editor, a language object and the code
// to render. Produces an object-representation of CMB, allowing for
// integration with external (non-react) code
export default class CodeMirrorBlocks {
  constructor(container, options = {}, language = pyret) {
    let api = {};
    let initialCode = options.value;
    ReactDOM.render(
      <ToggleEditor
        language={language}
        initialCode={(initialCode == null)? "" : initialCode}
        api={api}
        appElement={container}
        options={options}
      />,
      container
    );
    merge(api, this.buildAPI());
    return api;
  }

  buildAPI = () => {
    return {
      'fromTextArea': this.fromTextArea,
    };
  }

  fromTextArea = myTextArea => {
    myTextArea.parentNode.replaceChild(<ToggleEditor
      initialCode={myTextArea.value}
    />, myTextArea);
  }
}

module.exports = CodeMirrorBlocks;
