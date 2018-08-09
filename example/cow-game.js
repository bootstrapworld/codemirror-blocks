import 'babel-polyfill';
import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/addon/search/searchcursor.js';
import CodeMirrorBlocks from '../src/blocks';
import '../src/languages/wescheme';

require('./example-page.less');
var code = require('./cow-game.rkt'), cm;
document.getElementById("code").value = code;

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
        cm.focus();
      }
    };
    help.focus();
  }
}
document.getElementById('mode').onchange = function(e) {
  if(e.target.checked) {
    cm = CodeMirror.fromTextArea(
      document.getElementById("code"),
      {lineNumbers: true, theme:'3024-day'}
    );


    cm.doc.clearHistory();

    const options = {
      willInsertNode(cm, sourceNodeText, sourceNode, destination) {
        let line = cm.getLine(destination.line);
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
    var blocks = new CodeMirrorBlocks(cm, 'wescheme', options);
    blocks.setBlockMode(true);
    window.blocks = blocks;
  } else {
    cm.toTextArea();
  }
};
