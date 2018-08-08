import 'babel-polyfill';
import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/addon/search/searchcursor.js';
import CodeMirrorBlocks from '../src/blocks';
import '../src/languages/wescheme';
import './example-page.less';
import code from './ast-test.rkt';

let cm;
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
};

document.getElementById('mode').onchange = function(e) {
  if(e.target.checked) {
    const codeNode = document.getElementById("code");
    cm = CodeMirror.fromTextArea(
      codeNode,
      {lineNumbers: true, theme:'3024-day'}
    );

    let searchNode = document.getElementById("search");
    if (!searchNode) {
      searchNode = document.createElement("div");
      codeNode.parentNode.appendChild(searchNode);
    }

    cm.doc.clearHistory();

    const options = {
      search: searchNode,
      willInsertNode(cm, sourceNodeText, sourceNode, destination) {
        let line = cm.getLine(destination.line);
        let prev = line[destination.ch - 1] || '\n';
        let next = line[destination.ch] || '\n';
        sourceNodeText = sourceNodeText.trim();
        if (!/\s|[([{]/.test(prev)) {
          sourceNodeText = ' ' + sourceNodeText;
        }
        if (!/\s|[)\]}]/.test(next)) {
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
