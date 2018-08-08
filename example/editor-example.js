import 'babel-polyfill';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/addon/search/searchcursor.js';
import '../src/languages/wescheme';
import '../src/languages/example';
import '../src/languages/lambda';
import CodemirrorBlocks from '../src/blocks.js';
import React from 'react';
import ReactDOM from 'react-dom';
import Editor from '../src/ui/Editor';
import './example-page.less';
import exampleWeSchemeCode from './ast-test.rkt';

const exampleCodes = {
  wescheme: exampleWeSchemeCode,
  example: "1",
  lambda: "2",
};

class EditorInstance extends React.Component {
  constructor(props) {
    super(props);
    this.ref = React.createRef();
    this.options = {
      renderOptions: {
        lockNodesOfType: ['comment', 'functionDef', 'variableDef', 'struct']
      },
      willInsertNode: (sourceNodeText, sourceNode, destination) => {
        // TODO: the need of this.ref here indicates that `willInsertNode` has
        // a bad interface. Perhaps it should also provide editor

        const line = this.ref.current.getCodeMirror().getLine(destination.line);
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
      }
    };
    this.state = {language: 'wescheme'};
  }

  getCmOptions() {
    return {
      value: exampleCodes[this.state.language],
      lineNumbers: true,
      viewportMargin: 10,
    };
  }

  handleChange = event => {
    this.ref.current.getCodeMirror().doc.clearHistory();
    this.setState({language: event.target.value});
  }

  render() {
    const choices = CodemirrorBlocks.languages.getLanguages().map(
      language => (
        <option value={language.id} key={language.id}>{language.name}</option>
      )
    );
    return (
      <React.Fragment>
        <select value={this.state.language} onChange={this.handleChange}
                id="language-chooser">
          {choices}
        </select>
        <Editor ref={this.ref}
                language={this.state.language}
                options={this.options}
                cmOptions={this.getCmOptions()} />
      </React.Fragment>
    );
  }
}

ReactDOM.render(<EditorInstance />, document.getElementById('editor'));
