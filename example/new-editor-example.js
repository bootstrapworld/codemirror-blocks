import '@babel/polyfill';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/addon/search/searchcursor.js';
import '../src/languages/wescheme';
import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import BlockEditor from '../src/ui/BlockEditor';
import TextEditor from '../src/ui/TextEditor';
import CMBContext from '../src/components/Context';
import './example-page.less';
import Parser from '../src/languages/wescheme/WeschemeParser';
import ByString from '../src/ui/searchers/ByString';
import ByBlock from '../src/ui/searchers/ByBlock';
import attachSearch from '../src/ui/Search';
import Toolbar from '../src/ui/Toolbar';
import ToggleButton from '../src/ui/ToggleButton';
import {say} from '../src/utils';
import classNames from 'classnames';

// import exampleWeSchemeCode from './cow-game.rkt';

const exampleWeSchemeCode = `(cond (true 1) (false 2))(define (f x) x)`;

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



const UpgradedBlockEditor = attachSearch(BlockEditor, [ByString, ByBlock]);

@CMBContext
class EditorInstance extends React.Component {
  state = {
    primitives: null,
    renderer: null,
    language: null,
    blockMode: false,
    ast: null,
    code: exampleWeSchemeCode,
  }

  handlePrimitives = primitives => this.setState({primitives})
  handleRenderer = renderer => this.setState({renderer});
  handleLanguage = language => this.setState({language});
  handleAST = ast => this.setState({ast});
  handleChange = (ed, data, value) => {
    this.setState({code: value});
  }
  handleToggle = blockMode => {
    if (blockMode) {
      this.setState((state, props) => {
        try {
          let ast = parser.parse(state.code);
          let code = ast.toString();
          say("Switching to block mode");
          return {blockMode: true,
                  ast: ast,
                  code: code};
        } catch (err) {
          // TODO(Justin): properly deal with parse errors
          let msg = parser.getExceptionMessage(err);
          say(msg);
        }
      });
    } else {
      this.setState((state, props) => {
        let code = state.ast.toString();
        say("Switching to text mode");
        return {blockMode: false,
                code: code};
      });
    }
  }

  render() {
    const editorClass = classNames('Editor', 'blocks');
    return (
      <div className={editorClass}>
        <ToggleButton onToggle={this.handleToggle}/>
        {this.state.blockMode ? this.renderBlocks() : this.renderCode()}
      </div>
    );
  }

  renderCode() {
    return (
      <TextEditor
        cmOptions={cmOptions}
        parser={parser}
        code={this.state.code}
        onBeforeChange={this.handleChange} />
    );
  }

  renderBlocks() {
    const toolbarPaneClasses = classNames("col-xs-3 toolbar-pane");
    return (
      <React.Fragment>
        <div className={toolbarPaneClasses} tabIndex="-1">
          <Toolbar primitives={this.state.primitives}
                   renderer={this.state.renderer}
                   languageId={this.state.language} />
        </div>
        <div className="col-xs-9 codemirror-pane">
          <UpgradedBlockEditor
            language="wescheme"
            value={this.state.code}
            onBeforeChange={this.handleChange}
            onAST={this.handleAST}
            options={options}
            parser={parser}
            cmOptions={cmOptions}
            onPrimitives={this.handlePrimitives}
            onRenderer={this.handleRenderer}
            onLanguage={this.handleLanguage} />
        </div>
      </React.Fragment>
    );
  }
}

ReactDOM.render(<EditorInstance />, document.getElementById('cmb-editor'));
