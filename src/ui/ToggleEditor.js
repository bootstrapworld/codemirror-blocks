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
    SHARED.recordedMarks = new Map();
  }

  buildAPI(ed) {
    return {
      'getBlockMode': () => this.state.blockMode,
      'setBlockMode': this.handleToggle,
      'getValue': (sep) => ed.getValue(sep),
      'setValue': (value) => ed.setValue(value),
      'getScrollerElement': () => ed.getScrollerElement(),
      'getWrapperElement': () => ed.getWrapperElement(),
      'getGutterElement': () => ed.getGutterElement(),
      'getInputField': () => ed.getInputField(), // wasn't in text editor
      'getCursor': (start) => ed.getCursor(start),
      'replaceRange': (str, from, to, origin) => ed.replaceRange(str, from, to, origin),
      'refresh': () => ed.refresh(),
      'defineOption': (name, _default, updateFunc) => ed.defineOption(name, _default, updateFunc),
      'Pos': (line, ch, sticky) => ed.Pos(line, ch, sticky),
      'Doc': (text, mode, firstLineNumber, lineSeparator) => ed.Doc(text, mode, firstLineNumber, lineSeparator),
      'swapDoc': (doc) => ed.swapDoc(doc),
      'getDoc': () => ed.getDoc(),
      'charCoords': (pos, mode) => ed.charCoords(pos, mode),
      'getScrollInfo': () => ed.getScrollInfo(),
      'scrollIntoView': (what, margin) => ed.scrollIntoView(what, margin),
      'addLineClass': (line, where, _class) => ed.addLineClass(line, where, _class),
      'on': (type, func) => ed.on(type, func), // another on(obj, type, func) version...
      'off': (type, func) => ed.off(type, func),
      'removeLineClass': (line, where, _class) => ed.removeLineClass(line, where, _class),
      'normalizeKeyMap': (keymap) => ed.normalizeKeyMap(keymap),
      'getOption': (option) => ed.getOption(option),
      'clearHistory': () => ed.clearHistory(),
      'posFromIndex': (index) => ed.posFromIndex(index),
    };
  }

  handleEditorMounted = (ed) => {
    merge(this.props.api, this.buildAPI(ed));
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
        <ToggleButton setBlockMode={this.handleToggle} blockMode={this.state.blockMode} />
          <div className={"col-xs-3 toolbar-pane"} tabIndex="-1" aria-hidden={!this.state.blockMode}>
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
        options={this.options} />
    );
  }
}
