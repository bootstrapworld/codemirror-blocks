import '@babel/polyfill';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/addon/search/searchcursor.js';
import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import BlockEditor from './BlockEditor';
import TextEditor from './TextEditor';
import CMBContext from '../components/Context';
import ByString from './searchers/ByString';
import ByBlock from './searchers/ByBlock';
import attachSearch from './Search';
import Toolbar from './Toolbar';
import ToggleButton from './ToggleButton';
import {say} from '../utils';
import merge from '../merge';


const UpgradedBlockEditor = attachSearch(BlockEditor, [ByString, ByBlock]);

const defaultCmOptions = {
  lineNumbers: true,
  viewportMargin: 10,
};

@CMBContext
export default class ToggleEditor extends React.Component {
  state = {
    renderer: null, // Not actually stateful, but can only be constructed after the editor has mounted.
    blockMode: false,
    code: ""
  }

  static propTypes = {
    initialCode: PropTypes.string,
    cmOptions: PropTypes.object,
    language: PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      getParser: PropTypes.func.isRequired,
      getRenderOptions: PropTypes.func
    })
  }

  constructor(props) {
    super(props);
    this.state.code = props.initialCode || "";

    this.cmOptions = merge(defaultCmOptions, props.cmOptions);
    this.language = props.language;
    this.parser = this.language.getParser();

    this.options = {
      parser: this.parser,
      renderOptions: props.language.getRenderOptions
        ? props.language.getRenderOptions()
        : {},
      willInsertNode: (cm, sourceNodeText, sourceNode, destination) => {
        // TODO: If we pretty-print on every block edit, all this code can go.
        const line = cm.getLine(destination.line);
        const prev = line[destination.ch - 1] || '\n';
        const next = line[destination.ch] || '\n';
        // Trim spaces and tabs, but not newlines!
        sourceNodeText.replace(/^[ \t]+|[ \t]+$/gm, '');
        if (!/\s|[([{]/.test(prev)) {
          sourceNodeText = ' ' + sourceNodeText;
        }
        if (!/\s|[)\]}]/.test(next)) {
          sourceNodeText += ' ';
        }
        return sourceNodeText;
      }
    };
  }

  handleRenderer = renderer => this.setState({renderer});

  handleChange = (ed, data, value) => {
    this.setState({code: value});
  }

  handleToggle = blockMode => {
    this.setState((state, props) => {
      try {
        let ast = parser.parse(state.code);
        let code = ast.toString();
        if (blockMode) {
          say("Switching to block mode");
          return {blockMode: true,
                  code: code};
        } else {
          say("Switching to text mode");
          return {blockMode: false,
                  code: code};
        }
      } catch (err) {
        // TODO(Justin): properly deal with parse errors
        let msg = parser.getExceptionMessage(err);
        say(msg);
      }
    });
  };

  render(_props) { // eslint-disable-line no-unused-vars
    const classes = 'Editor ' + (this.state.blockMode ? 'blocks' : 'text');
    return (
      <div className={classes}>
        <ToggleButton onToggle={this.handleToggle}  />
        <React.Fragment>
          <div className={"col-xs-3 toolbar-pane"} tabIndex="-1">
          <Toolbar primitives={this.parser.primitives}
                   renderer={this.state.renderer}
                   languageId={this.language.id} />
          </div>
          {this.state.blockMode ? this.renderBlocks() : this.renderCode()}
        </React.Fragment>
      </div>
    );
  }

  renderCode() {
    return (
      <TextEditor
        cmOptions={this.cmOptions}
        parser={this.parser}
        code={this.state.code}
        onBeforeChange={this.handleChange} />
    );
  }

  renderBlocks() {
    return (
        <div className="col-xs-9 codemirror-pane">
          <UpgradedBlockEditor
            language={this.language.id}
            value={this.state.code}
            options={this.options}
            parser={this.parser}
            cmOptions={this.cmOptions}
            onBeforeChange={this.handleChange}
            onRenderer={this.handleRenderer} />
        </div>
    );
  }
}
