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
import classNames from 'classnames';
import Editor from '../src/ui/Editor';
import './example-page.less';
import exampleWeSchemeCode from './cow-game.rkt';

const exampleCodes = {
  wescheme: exampleWeSchemeCode,
  example: "1",
  lambda: "2",
};

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
  }
};

class EditorInstance extends React.Component {
  constructor(props) {
    super(props);
    this.ref = React.createRef();
    this.state = {selectedLanguage:'wescheme', activeLanguage: 'wescheme'};
  }


  handleSelectChange = event => {
    this.ref.current.getCodeMirror().doc.clearHistory();
    this.setState({selectedLanguage: event.target.value});
  }

  changeActiveLanguage = event => {
    this.setState({activeLanguage: this.state.selectedLanguage});
  }

  render() {
    const glyphClass = classNames('glyphicon', 'glyphicon-pencil');
    const choices = CodemirrorBlocks.languages.getLanguages().map(
      language => (
        <option value={language.id} key={language.id}>{language.name}</option>
      )
    );
    return (
      <React.Fragment>
        <select value={this.state.language} onChange={this.handleSelectChange}
                id="language-chooser">
          {choices}
        </select>
        <button className="btn btn-default btn-sm"
                  onClick={this.changeActiveLanguage}>
            <span className={glyphClass}></span>
        </button>
        <Editor ref={this.ref}
                language={this.state.activeLanguage}
                value={exampleCodes[this.state.activeLanguage]}
                options={options}
                cmOptions={cmOptions} />
      </React.Fragment>
    );
  }
}

ReactDOM.render(<EditorInstance />, document.getElementById('editor'));
