import 'babel-polyfill';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/addon/edit/closebrackets.js';
import WeschemeParser from '../src/parsers/wescheme';
import {renderEditorInto} from '../src/ui';

require('./example-page.less');

var code = require('./ast-test.rkt');

const options = {
  renderOptions: {
    hideNodesOfType: ['comment','functionDef','variableDef','struct']
  },
  toolbar: document.getElementById('toolbar'),
  willInsertNode(sourceNodeText, sourceNode, destination) {
    let line = editor.getCodeMirror().getLine(destination.line);
    let prev = line[destination.ch - 1] || '\n';
    let next = line[destination.ch] || '\n';
    sourceNodeText = sourceNodeText.trim();
    if (!/\s|[\(\[\{]/.test(prev)) {
      sourceNodeText = ' ' + sourceNodeText;
    }
    if (!/\s|[\)\]\}]/.test(next)) {
      sourceNodeText += ' ';
    }
    return sourceNodeText;
  }
};

let editor = renderEditorInto(
  document.getElementById('editor'),
  new WeschemeParser(),
  options
);
editor.getCodeMirror().setValue(code);
