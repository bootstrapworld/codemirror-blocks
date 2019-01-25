import '@babel/polyfill';
import 'codemirror/lib/codemirror.css';
import React from 'react';
import ReactDOM from 'react-dom';
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
import SHARED from '../shared';

const UpgradedBlockEditor = attachSearch(BlockEditor, [ByString, ByBlock]);

const defaultCmOptions = {
  lineNumbers: true,
  viewportMargin: 10,
};

@CMBContext
export default class ToggleEditor extends React.Component {
  state = {
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
    }),
    external: PropTypes.object,
    appElement: PropTypes.instanceOf(Element).isRequired
  }

  constructor(props) {
    super(props);
    this.state.code = props.initialCode || "";

    this.cmOptions = merge(defaultCmOptions, props.cmOptions);
    this.language = props.language;
    this.parser = this.language.getParser();

    // export the handleToggle method
    this.props.external.handleToggle = this.handleToggle;

    this.options = {
      parser: this.parser,
      renderOptions: props.language.getRenderOptions
        ? props.language.getRenderOptions()
        : {}
    };
  }

  handleChange = (ed, data, value) => {
    this.setState({code: value});
  }

  handleToggle = blockMode => {
    this.setState((state, props) => {
      try {
        let ast = SHARED.parser.parse(state.code);
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
        let msg = SHARED.parser.getExceptionMessage(err);
        say(msg);
      }
    });
  };

  render(_props) { // eslint-disable-line no-unused-vars
    const classes = 'Editor ' + (this.state.blockMode ? 'blocks' : 'text');
    return (
      <div className={classes}>
        <ToggleButton onToggle={this.handleToggle}  />
          <div className={"col-xs-3 toolbar-pane"} tabIndex="-1">
            <Toolbar primitives={this.parser.primitives}
                     languageId={this.language.id} />
          </div>
          <div className="col-xs-9 codemirror-pane">
            {this.state.blockMode ? this.renderBlocks() : this.renderCode()}
          </div>
      </div>
    );
  }

  renderCode() {
    return (
      <TextEditor
        cmOptions={this.cmOptions}
        parser={this.parser}
        code={this.state.code}
        onBeforeChange={this.handleChange} 
        external={this.props.external} />
    );
  }

  renderBlocks() {
    return (
      <UpgradedBlockEditor
        cmOptions={this.cmOptions}
        parser={this.parser}
        value={this.state.code}
        onBeforeChange={this.handleChange} 
        external={this.props.external}
        appElement={this.props.appElement}
        language={this.language.id}
        options={this.options} />
    );
  }
}
