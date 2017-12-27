import 'babel-polyfill';
import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/addon/search/searchcursor.js';
import CodeMirrorBlocks from '../src/blocks';
import '../src/languages/wescheme';

require('./example-page.less');

var cm = CodeMirror.fromTextArea(
  document.getElementById("code"),
  {lineNumbers: true, theme:'3024-day'}
);
var cm2 = CodeMirror.fromTextArea(
  document.getElementById('code2'),
  {lineNumbers: true, theme:'3024-day'}
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
cm.doc.clearHistory();
cm2.swapDoc(cm.getDoc().linkedDoc({sharedHist: true}));

const options = {
  renderOptions: {
    lockNodesOfType: ['comment','functionDef','variableDef','struct'],
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
window.blocks = blocks;

document.getElementById('mode').onchange = function(e){ blocks.setBlockMode(e.target.checked); };

// Toggle the help HUD
document.body.onkeydown = function(k) {
  if(!(k.key == "/" && k.ctrlKey == true)) return;
  let help = document.getElementById('helpDialog');
  if(help && help.style.display !== "block"){
    help.style.display = "block";
    help.onkeydown = (k) => { 
      k.preventDefault();
      k.stopPropagation();
      if(k.key == "/" && k.ctrlKey == true) {
        help.style.display = "none";
        cm2.focus();
      }
    };
    help.focus();
  }
}