import React from 'react';
import ReactDOM from 'react-dom';
import ToggleEditor from './ui/ToggleEditor';
import merge from './merge';
import pyret from './languages/pyret';
import {store} from './store';
import {Provider} from 'react-redux';
const Args = require('./components/Args');
const DropTarget = require('./components/DropTarget');
const Node = require('./components/Node');
const AST = require('./ast');
const Nodes = require('./nodes');
const Languages = require('./languages');
const Pretty = require('./pretty');

// Consumes a DOM node to host the editor, a language object and the code
// to render. Produces an object-representation of CMB, allowing for
// integration with external (non-react) code
export default class CodeMirrorBlocks {
  constructor(container, options = {}, language = pyret) {
    let api = {};
    let initialCode = options.value;
    ReactDOM.render(
      <Provider store={store}>
        <ToggleEditor
          language={language}
          initialCode={(initialCode == null) ? "" : initialCode}
          api={api}
          appElement={container}
          options={options}
        />
      </Provider>,
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

module.exports.CodeMirrorBlocks = CodeMirrorBlocks;
module.exports.Args = Args.default;
module.exports.DT = DropTarget;
module.exports.AST = AST;
module.exports.Nodes = Nodes;
module.exports.Node = Node.default;
module.exports.Languages = Languages;
module.exports.Pretty = Pretty;

console.log(module.exports);