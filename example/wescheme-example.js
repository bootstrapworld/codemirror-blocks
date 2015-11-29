import 'babel-polyfill';
import CodeMirror from 'CodeMirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import CodeMirrorBlocks from '../src/blocks.js';
import WeschemeParser from './wescheme-parser.js';

require('./example.css');
require('./example-page.css');

var cm = CodeMirror.fromTextArea(
  document.getElementById("code"),
  {theme:'3024-day'}
);

var cm2 = CodeMirror.fromTextArea(
  document.getElementById('code2'),
  {theme:'3024-day'}
);

var code = require('./ast-test.rkt');
//var code = require('./cow-game.rkt');
//var code = "(sum (+   (- 1 2)  3)\n (*  3  4)\n (/ 5 6))\n(product 5 6 7)"
cm.setValue(code);
cm2.swapDoc(cm.getDoc().linkedDoc({sharedHist: true}));

var blocks = new CodeMirrorBlocks(
  cm2,
  new WeschemeParser(),
  {
    willInsertNode(sourceNodeText, sourceNode, destination) {
      let line = cm2.getLine(destination.line);
      let prev = line[destination.ch - 1];
      let next = line[destination.ch];
      return (
        (/\s|[\(\[\{]/.test(prev) ? "":" ") +
        sourceNodeText.trim() +
        (/\s|[\)\]\}]/.test(next) ? "":" ")
      );
    }
  }
);
blocks.setBlockMode(true);
