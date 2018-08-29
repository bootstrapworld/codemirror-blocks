import 'babel-polyfill';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/addon/search/searchcursor.js';
import '../src/languages/wescheme';
import React from 'react';
import ReactDOM from 'react-dom';
import Editor from '../src/ui/NewEditor';
import './example-page.less';
import Parser from '../src/languages/wescheme/WeschemeParser';
// import exampleWeSchemeCode from './cow-game.rkt';

const exampleWeSchemeCode = `
(a b) c
`;

const parser = new Parser();

const cmOptions = {
  lineNumbers: true,
  viewportMargin: 10,
};

const options = {
  renderOptions: {
    lockNodesOfType: ['comment', 'functionDef', 'variableDef', 'struct']
  },
  willInsertNode: (cm, sourceNodeText, sourceNode, destination) => {
    const line = cm.getLine(destination.line);
    const prev = line[destination.ch - 1] || '\n';
    const next = line[destination.ch] || '\n';
    sourceNodeText = sourceNodeText.trim();
    if (!/\s|[([{]/.test(prev)) {
      sourceNodeText = ' ' + sourceNodeText;
    }
    if (!/\s|[)\]}]/.test(next)) {
      sourceNodeText += ' ';
    }
    return sourceNodeText;
  },
  parser
};

class EditorInstance extends React.Component {
  render() {
    return (
      <Editor language="wescheme"
              value={exampleWeSchemeCode}
              options={options}
              parser={parser}
              cmOptions={cmOptions} />
    );
  }
}

ReactDOM.render(<EditorInstance />, document.getElementById('editor'));
