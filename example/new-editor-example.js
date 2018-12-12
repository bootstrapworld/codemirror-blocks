import '@babel/polyfill';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/addon/search/searchcursor.js';
import '../src/languages/wescheme';
import React from 'react';
import ReactDOM from 'react-dom';
import Editor from '../src/ui/NewEditor';
import CMBContext from '../src/components/Context';
import './example-page.less';
import Parser from '../src/languages/wescheme/WeschemeParser';
import ByString from '../src/ui/searchers/ByString';
import ByBlock from '../src/ui/searchers/ByBlock';
import attachSearch from '../src/ui/Search';
import Toolbar from '../src/ui/Toolbar';
import classNames from 'classnames';
import {Controlled as CodeMirror} from 'react-codemirror2';

// import exampleWeSchemeCode from './cow-game.rkt';

const exampleWeSchemeCode = `(a)(x y)`;

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



const UpgradedEditor = attachSearch(Editor, [ByString, ByBlock]);

@CMBContext
class EditorInstance extends React.Component {
  state = {
    primitives: null,
    renderer: null,
    language: null,
    blockMode: false,
    code: exampleWeSchemeCode,
  }

  handlePrimitives = primitives => this.setState({primitives})
  handleRenderer = renderer => this.setState({renderer});
  handleLanguage = language => this.setState({language});

  handleToggle = () => {
    this.setState({blockMode: !this.state.blockMode});
  }

  handleChange = (ed, data, value) => {
    this.setState({code: value});
  }

  render() {
    const editorClass = classNames('Editor', 'blocks');
    const toolbarPaneClasses = classNames("col-xs-3 toolbar-pane");
    const glyphClass = classNames('glyphicon', {
      'glyphicon-pencil': this.state.blockMode,
      'glyphicon-align-left': !this.state.blockMode
    });
    const theEditor = this.state.blockMode ? (
      <React.Fragment>
        <div className={toolbarPaneClasses} tabIndex="-1">
          <Toolbar primitives={this.state.primitives}
                   renderer={this.state.renderer}
                   languageId={this.state.language} />
        </div>
        <div className="col-xs-9 codemirror-pane">
          <UpgradedEditor
            language="wescheme"
            value={this.state.code}
            onBeforeChange={this.handleChange}
            options={options}
            parser={parser}
            cmOptions={cmOptions}
            onPrimitives={this.handlePrimitives}
            onRenderer={this.handleRenderer}
            onLanguage={this.handleLanguage} />
        </div>
      </React.Fragment>
    ) : (
      <React.Fragment>
        <div className="col-xs-9 codemirror-pane">
          <CodeMirror
            value={this.state.code}
            onBeforeChange={this.handleChange}
            options={cmOptions} />
        </div>
      </React.Fragment>
    );
    const buttonAria = "Switch to " + (this.state.blockMode ? "text" : "blocks") + " mode";
    return (
      <div className={editorClass}>
        <button className="blocks-toggle-btn btn btn-default btn-sm"
                aria-label={buttonAria}
                onClick={this.handleToggle}
                tabIndex="0">
          <span className={glyphClass}></span>
        </button>
        {theEditor}
      </div>
    );
  }
}

ReactDOM.render(<EditorInstance />, document.getElementById('cmb-editor'));
