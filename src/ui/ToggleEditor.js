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
    options: PropTypes.object,
    external: PropTypes.object,
    appElement: PropTypes.instanceOf(Element).isRequired
  }

  constructor(props) {
    super(props);

    this.cmOptions = merge(defaultCmOptions, props.cmOptions);
    this.language = props.language;
    this.parser = this.language.getParser();

    // export the handleToggle method
    this.props.external.handleToggle = this.handleToggle;

    let defaultOptions = {
      parser: this.parser,
      renderOptions: props.language.getRenderOptions
        ? props.language.getRenderOptions()
        : {},
      collapseAll: true
    };
    this.options = merge(defaultOptions, props.options);
    this.hasMounted = false;
  }

  componentDidMount() {
    this.hasMounted = true;
  }

  handleToggle = blockMode => {
    this.setState((state, props) => {
      try {
        let ast = SHARED.parser.parse(SHARED.cm.getValue());
        let code = ast.toString();
        this.props.external.blockMode = blockMode;
        if (blockMode) {
          say("Switching to block mode");
          SHARED.cm.setValue(code);
          return {blockMode: true};
        } else {
          say("Switching to text mode");
          SHARED.cm.setValue(code);
          return {blockMode: false};
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
    let code = this.hasMounted ? SHARED.cm.getValue() : this.props.initialCode;
    return (
      <TextEditor
        cmOptions={this.cmOptions}
        parser={this.parser}
        initialCode={code}
        external={this.props.external} />
    );
  }

  renderBlocks() {
    let code = this.hasMounted ? SHARED.cm.getValue() : this.props.initialCode;
    return (
      <UpgradedBlockEditor
        cmOptions={this.cmOptions}
        parser={this.parser}
        value={code}
        external={this.props.external}
        appElement={this.props.appElement}
        language={this.language.id}
        options={this.options} />
    );
  }
}
