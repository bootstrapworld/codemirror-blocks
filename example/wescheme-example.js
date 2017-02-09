import 'babel-polyfill';
import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/addon/edit/closebrackets.js';
import 'codemirror/addon/search/searchcursor.js';
import CodeMirrorBlocks from '../src/blocks';
import '../src/languages/wescheme';

require('./example-page.less');

var cm = CodeMirror.fromTextArea(
  document.getElementById("code"),
  {theme:'3024-day',
   autoCloseBrackets: true}
);
var cm2 = CodeMirror.fromTextArea(
  document.getElementById('code2'),
  {theme:'3024-day',
   autoCloseBrackets: false,
   extraKeys: {
     "Shift-9" : function(cm){
       cm.replaceSelection("(...)");
     }
   }
 }
);

var focusCarousel = [cm, cm2, document.getElementById("mode")];
var currentFocusId = null;
document.addEventListener("keydown", function(e){
  var mode = document.getElementById("mode");
  if(e.key == "F6") {
    if(currentFocusId === "code"){
      currentFocusId = e.shiftKey? "mode" : "code2";
      (e.shiftKey? mode : cm2).focus();
    } else if(currentFocusId === "code2"){
      currentFocusId = e.shiftKey? "code" : "mode";
      (e.shiftKey? cm : mode).focus();
    } else {
      currentFocusId = e.shiftKey? "code2" : "code";
      (e.shiftKey? cm2 : cm).focus();
    } 
  }
});


var code = require('./react-test.rkt');
//var code = require('./cow-game.rkt');
//var code = "(sum (+   (- 1 2)  3)\n (*  3  4)\n (/ 5 6))\n(product 5 6 7)"
cm.setValue(code);
cm2.swapDoc(cm.getDoc().linkedDoc({sharedHist: true}));

const options = {
  renderOptions: {
    lockNodesOfType: ['comment','functionDef','variableDef','struct']
  },
  willInsertNode(sourceNodeText, sourceNode, destination) {
    let line = cm2.getLine(destination.line);
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
var blocks = new CodeMirrorBlocks(cm2, 'wescheme', options);
blocks.setBlockMode(true);

document.getElementById('mode').onchange = function(e){ blocks.setBlockMode(e.target.checked); };