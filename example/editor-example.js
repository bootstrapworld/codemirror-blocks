import 'babel-polyfill';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/addon/search/searchcursor.js';
import '../src/languages/wescheme';
import '../src/languages/example';
import '../src/languages/lambda';
import {renderEditorInto} from '../src/ui';
import CodemirrorBlocks from '../src/blocks.js';
import React from 'react';
import ReactDOM from 'react-dom';

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
  'wescheme',
  options
);
editor.getCodeMirror().setValue(code);
editor.getCodeMirror().setOption("lineNumbers", true);
editor.getCodeMirror().setOption("viewportMargin", 10);
editor.getCodeMirror().doc.clearHistory();

ReactDOM.render((
  <select onChange={function(event){
    ReactDOM.unmountComponentAtNode(document.getElementById('editor'));
    var editor = renderEditorInto(
        document.getElementById('editor'),
        event.target.value,
        options
    );
    var exampleCode = CodemirrorBlocks.languages.getLanguage(event.target.value).example;
    editor.getCodeMirror().setValue(exampleCode || "");
  }}>
    <option>
      Choose Language...
    </option>
    {CodemirrorBlocks.languages.getLanguages().map(
       language => (
         <option value={language.id} key={language.id}>{language.name}</option>
       )
     )}
  </select>
),document.getElementById('language-selector')
);


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