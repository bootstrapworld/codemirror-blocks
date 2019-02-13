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
    api: PropTypes.object,
    appElement: PropTypes.instanceOf(Element).isRequired
  }

  constructor(props) {
    super(props);

    this.cmOptions = merge(defaultCmOptions, props.cmOptions);
    this.language = props.language;
    this.parser = this.language.getParser();

    let defaultOptions = {
      parser: this.parser,
      renderOptions: props.language.getRenderOptions
        ? props.language.getRenderOptions()
        : {},
      collapseAll: true
    };
    this.options = merge(defaultOptions, props.options);
    this.hasMounted = false;

    merge(this.props.api, this.buildAPI());
  }

  buildAPI() {
    return {
      'blocks': {
        'getBlockMode': () => this.props.dispatch((_, getState) => getState().blockMode),
        'setBlockMode': this.handleToggle
      }
    };
  }

  componentDidMount() {
    this.hasMounted = true;
  }

  // save any non-block, non-bookmark marks
  // reconstruct the options object and use pre-computed from/to
  recordMarks() {
    SHARED.recordedMarks = SHARED.cm.getAllMarks()
      .filter(m => !m.BLOCK_NODE_ID && m.type !== "bookmark")
      .map(m => {
        let {from, to} = m.find(), opts = {};
        for(var k in m) if(m.hasOwnProperty(k)) {
          if(!['lines','type','doc','id','from','to'].includes(k)) opts[k] = m[k];
        }
        return {from: from, to: to, options: opts};
      });
  }

  handleToggle = blockMode => {
    this.setState((state, props) => {
      try {
        let ast = SHARED.parser.parse(SHARED.cm.getValue());
        let code = ast.toString();
        this.props.external.blockMode = blockMode;
        // record mark information
        this.recordMarks();
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
        api={this.props.api} />
    );
  }

  renderBlocks() {
    let code = this.hasMounted ? SHARED.cm.getValue() : this.props.initialCode;
    return (
      <UpgradedBlockEditor
        cmOptions={this.cmOptions}
        parser={this.parser}
        value={code}
        api={this.props.api}
        appElement={this.props.appElement}
        language={this.language.id}
        blockoptions={this.options} />
    );
  }
}
