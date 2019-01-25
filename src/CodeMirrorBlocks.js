import React from 'react';
import ReactDOM from 'react-dom';
import ToggleEditor from './ui/ToggleEditor';
import wescheme from '../src/languages/wescheme';

// Consumes a DOM node to host the editor, a language object and the code
// to render. Produces an object-representation of CMB, allowing for
// integration with external (non-react) code
export default class CodeMirrorBlocks {
  constructor(dom, language = wescheme, code = "") {
    let obj = {};
    ReactDOM.render(
      <ToggleEditor language={language} initialCode={code} external={obj} AppElement={dom}/>,
      dom
    );
    return obj;
  }
}

module.exports = CodeMirrorBlocks;