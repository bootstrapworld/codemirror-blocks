import React from 'react';
import ReactDOM from 'react-dom';
import ToggleEditor from './ui/ToggleEditor';
const Args = require('./components/Args');
const DropTarget = require('./components/DropTarget');
const Node = require('./components/Node');
const AST = require('./ast');
const Nodes = require('./nodes');
const NodeSpec = require('./nodeSpec');
const Languages = require('./languages');
const Pretty = require('pretty-fast-pretty-printer');
const { PrimitiveGroup } = require('./parsers/primitives');

// Consumes a DOM node to host the editor, a language object and the code
// to render. Produces an object-representation of CMB, allowing for
// integration with external (non-react) code
export default class CodeMirrorBlocks {
  constructor(container, options = {}, language, cmOptions = {}) {
    let api = {};
    let initialCode = options.value;
    ReactDOM.render(
      <ToggleEditor
        language={language}
        initialCode={(initialCode == null) ? "" : initialCode}
        api={api}
        appElement={container}
        options={options}
        cmOptions={cmOptions}
      />,
      container
    );
    Object.assign(api, this.buildAPI());
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
module.exports.Node = Node.default;
module.exports.Nodes = Nodes;
module.exports.NodeSpec = NodeSpec;
module.exports.Languages = Languages;
module.exports.Pretty = Pretty;
module.exports.PrimitiveGroup = PrimitiveGroup;
