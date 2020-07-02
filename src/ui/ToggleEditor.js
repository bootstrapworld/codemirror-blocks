import '@babel/polyfill';
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
import TrashCan from './TrashCan';
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
    appElement: PropTypes.instanceOf(Element).isRequired,
    debuggingLog: PropTypes.object,
  }

  static defaultProps = {
    debuggingLog: {}
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
    SHARED.recordedMarks = new Map();
  }

  loadLoggedActions = (jsonLog) => {
    console.log('log is', jsonLog);
    this.setState({debuggingLog: jsonLog});
    this.props.api.setValue(jsonLog.startingSource);
  }

  buildAPI(ed) {
    return {
      // CMB methods
      'getBlockMode': () => this.state.blockMode,
      'setBlockMode': this.handleToggle,
      // CM methods
      'addLineClass': (line, where, _class) => ed.addLineClass(line, where, _class),
      'charCoords': (pos, mode) => ed.charCoords(pos, mode),
      'clearHistory': () => ed.clearHistory(),
      'clearGutter': () => ed.clearGutter(),
      'defineOption': (name, _default, updateFunc) => ed.defineOption(name, _default, updateFunc),
      'Doc': (text, mode, firstLineNumber, lineSeparator) => ed.Doc(text, mode, firstLineNumber, lineSeparator),
      'eachLine': (f) => ed.eachLine(f),
      'focus': () => ed.focus(),
      'getCursor': (start) => ed.getCursor(start),
      'getDoc': () => ed.getDoc(),
      'getGutterElement': () => ed.getGutterElement(),
      'getInputField': () => ed.getInputField(),
      'getOption': (option) => ed.getOption(option),
      'getScrollerElement': () => ed.getScrollerElement(),
      'getScrollInfo': () => ed.getScrollInfo(),
      'getTextArea': () => ed.getTextArea(), // errors if not created from text area?
      'getValue': (sep) => ed.getValue(sep),
      'getWrapperElement': () => ed.getWrapperElement(),
      'normalizeKeyMap': (keymap) => ed.normalizeKeyMap(keymap),
      'off': (type, func) => ed.off(type, func),
      'on': (type, func) => ed.on(type, func), // another on(obj, type, func) version...
      'operation': (fun) => ed.operation(fun),
      'Pos': (line, ch, sticky) => ed.Pos(line, ch, sticky),
      'posFromIndex': (index) => ed.posFromIndex(index),
      'refresh': () => ed.refresh(),
      'removeLineClass': (line, where, _class) => ed.removeLineClass(line, where, _class),
      'replaceRange': (str, from, to, origin) => ed.replaceRange(str, from, to, origin),
      'scrollIntoView': (what, margin) => ed.scrollIntoView(what, margin),
      'setOption': (option, value) => ed.setOption(option, value),
      'setValue': (value) => ed.setValue(value),
      'swapDoc': (doc) => ed.swapDoc(doc),
    };
  }

  handleEditorMounted = (ed) => {
    merge(this.props.api, this.buildAPI(ed));
    this.props.api.display = ed.display;
  }

  componentDidMount() {
    this.hasMounted = true;
  }

  componentDidUpdate() {
    setTimeout(this.reconstituteMarks, 250);
  }

  // save any non-block, non-bookmark markers, and the NId they cover
  recordMarks(oldAST, postPPcode) {
    SHARED.recordedMarks.clear();
    let newAST = SHARED.parser.parse(postPPcode);
    SHARED.cm.getAllMarks().filter(m => !m.BLOCK_NODE_ID && m.type !== "bookmark")
      .forEach(m => {
        let {from: oldFrom, to: oldTo} = m.find(), opts = {};
        let node = oldAST.getNodeAt(oldFrom, oldTo);    // find the node corresponding to the mark
        if(!node) { // bail on non-node markers
          console.error(`Removed TextMarker at [{line:${oldFrom.line}, ch:${oldFrom.ch}},` +
          `{line:${oldTo.line}, ch:${oldTo.ch}}], since that range does not correspond to a node boundary`);
          return;
        }
        let {from, to} = newAST.getNodeByNId(node.nid); // use the NID to look node up srcLoc post-PP
        opts.css = m.css; opts.title = m.title; opts.className = m.className;
        SHARED.recordedMarks.set(node.nid, {from: from, to: to, options: opts});
      });
  }

  handleToggle = blockMode => {
    this.setState((state, props) => {
      try {
        let ast = SHARED.parser.parse(SHARED.cm.getValue());
        let code = ast.toString(); // pretty-print
        this.props.api.blockMode = blockMode;
        // record mark information
        this.recordMarks(ast, code);
        if (blockMode) {
          SHARED.cm.setValue(code);
          return {blockMode: true};
        } else {
          SHARED.cm.setValue(code);
          return {blockMode: false};
        }
      } catch (err) {
        // TODO(Justin): properly deal with parse errors
        let _msg = SHARED.parser.getExceptionMessage(err);
        throw err;
      }
    });
  };

  render(_props) { // eslint-disable-line no-unused-vars
    const classes = 'Editor ' + (this.state.blockMode ? 'blocks' : 'text');
    return (
      <div className={classes}>
        <ToggleButton setBlockMode={this.handleToggle} blockMode={this.state.blockMode} />
        {this.state.blockMode ? <TrashCan/> : null}
        <div className={"col-xs-3 toolbar-pane"} tabIndex="-1" aria-hidden={!this.state.blockMode}>
          <Toolbar primitives={this.parser.primitives}
                   languageId={this.language.id}
                   blockMode={this.state.blockMode} />
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
        onMount={this.handleEditorMounted}
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
        onMount={this.handleEditorMounted}
        api={this.props.api}
        appElement={this.props.appElement}
        language={this.language.id}
        options={this.options}
        debugHistory={this.props.debuggingLog.history}
     />
    );
  }
}
