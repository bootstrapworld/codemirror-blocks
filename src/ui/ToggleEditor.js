import React from 'react';
import PropTypes from 'prop-types/prop-types';
import CodeMirror from 'codemirror';
import BlockEditor from './BlockEditor';
import TextEditor from './TextEditor';
import CMBContext from '../components/Context';
import ByString from './searchers/ByString';
import ByBlock from './searchers/ByBlock';
import attachSearch from './Search';
import Toolbar from './Toolbar';
import ToggleButton from './ToggleButton';
import TrashCan from './TrashCan';
import SHARED from '../shared';
import './ToggleEditor.less';

const UpgradedBlockEditor = attachSearch(BlockEditor, [ByString, ByBlock]);

const defaultCmOptions = {
  lineNumbers: true,
  viewportMargin: 10,
};

// This is the complete list of methods exposed by the CodeMirror object
// SOME of them we override, but many can be exposed directly
// See buildAPI() in the ToggleEditor component
const codeMirrorAPI = ['getValue', 'setValue', 'getRange', 'replaceRange', 'getLine', 
  'lineCount', 'firstLine', 'lastLine', 'getLineHandle', 'getLineNumber', 'eachLine'
  , 'markClean', 'changeGeneration', 'isClean', 'getSelection', 'getSelections', 
  'replaceSelection', 'replaceSelections', 'getCursor', 'listSelections', 
  'somethingSelected', 'setCursor', 'setSelection', 'setSelections', 'addSelection', 
  'extendSelection', 'extendSelections', 'extendSelectionsBy', 'setExtending', 'getExtending', 
  'hasFocus', 'findPosH', 'findPosV', 'findWordAt', 'setOption', 'getOption', 'addKeyMap', 
  'removeKeyMap', 'addOverlay', 'removeOverlay', 'on', 'off', 'undo', 'redo', 'undoSelection', 
  'redoSelection', 'historySize', 'clearHistory', 'getHistory', 'setHistory', 'markText', 
  'setBookmark', 'findMarks', 'findMarksAt', 'getAllMarks', 'setGutterMarker', 
  'clearGutter', 'addLineClass', 'removeLineClass', 'lineInfo', 'addWidget', 'addLineWidget', 
  'setSize', 'scrollTo', 'getScrollInfo', 'scrollIntoView', 'cursorCoords', 'charCoords', 
  'coordsChar', 'lineAtHeight', 'heightAtLine', 'defaultTextHeight', 'defaultCharWidth', 
  'getViewport', 'refresh', 'operation', 'startOperation', 'endOperation', 'indentLine', 
  'toggleOverwrite', 'isReadOnly', 'lineSeparator', 'execCommand', 'posFromIndex', 
  'indexFromPos', 'focus', 'phrase', 'getInputField', 'getWrapperElement', 
  'getScrollerElement', 'getGutterElement'];

export default @CMBContext class ToggleEditor extends React.Component {
  state = {
    blockMode: false,
    dialog: false
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
    debuggingLog: {},
    cmOptions: {},
  }

  constructor(props) {
    super(props);

    this.cmOptions = Object.assign(defaultCmOptions, props.cmOptions);
    this.language = props.language;
    this.parser = this.language.getParser();

    let defaultOptions = {
      parser: this.parser,
      incrementalRendering: true,
      renderOptions: props.language.getRenderOptions
        ? props.language.getRenderOptions()
        : {},
      collapseAll: true
    };
    this.options = Object.assign(defaultOptions, props.options);
    this.hasMounted = false;
    SHARED.recordedMarks = new Map();

    // make sure 'this' always refers to ToggleEditor
    // see https://reactjs.org/docs/handling-events.html
    this.showDialog = this.showDialog.bind(this);
    this.closeDialog = this.closeDialog.bind(this);
  }

  loadLoggedActions = (jsonLog) => {
    console.log('log is', jsonLog);
    this.setState({debuggingLog: jsonLog});
    this.props.api.setValue(jsonLog.startingSource);
  }

  buildAPI(ed) {
    const base = {};
    // any CodeMirror function that we can call directly should be passed-through
    // TextEditor and BlockEditor can add their own, or override them
    codeMirrorAPI.forEach(f => base[f] = function(){ return ed[f](...arguments); });

    const api = {
      // custom CMB methods
      'getBlockMode': () => this.state.blockMode,
      'setBlockMode': this.handleToggle,
      'getCM': () => ed,
      'on' : () => { throw "Custom event handlers are not supported in CodeMirror-blocks"; },
      'off': () => { throw "Custom event handlers are not supported in CodeMirror-blocks"; },
      'runMode': () => { throw "runMode is not supported in CodeMirror-blocks"; },
    };
    return Object.assign(base, api);
  }

  handleEditorMounted = (ed) => {
    Object.assign(this.props.api, this.buildAPI(ed));
    this.props.api.display = ed.display;
  }

  componentDidMount() {
    this.hasMounted = true;
  }

  componentDidUpdate() {
    setTimeout(this.reconstituteMarks, 250);
  }

  // save any non-block, non-bookmark markers, and the NId they cover
  recordMarks(oldAST) {
    SHARED.recordedMarks.clear();
    let newAST = this.ast;
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

  showDialog(contents) { this.setState( () =>({dialog: contents}));  }
  closeDialog()        { this.setState( () =>({dialog: false}));     }

  handleToggle = blockMode => {
    this.setState( () => {
      try {
        let oldCode = SHARED.cm.getValue();
        const WS = oldCode.match(/\s+$/);                 // match ending whitespace
        let oldAst = SHARED.parser.parse(oldCode, false); // parse the code, but don't annotate
        let code = oldAst.toString() + (WS? WS[0] : "");  // pretty-print and restore whitespace
        this.ast = SHARED.parser.parse(code);             // parse the pretty-printed (PP) code
        SHARED.cm.setValue(code);                         // update CM with the PP code
        this.props.api.blockMode = blockMode;
        // record mark information
        // TODO(Emmanuel): this is going to have to save ALL state (selection, cursor, etc)
        this.recordMarks(oldAst, code);
        // Parsing and state-saving was successful! Set the blockMode state and return
        return {blockMode: blockMode};
      } catch (err) {
        let error;
        try {
          error = SHARED.parser.getExceptionMessage(err);
        } catch(e) {
          error = "The parser failed, and the error could not be retrieved";
        }
        return {dialog: (
          <>
          <span className="dialogTitle">Could not convert to Blocks</span>
          <p></p>
          {error.toString()}
          </>
        )};
      }
    });
  }

  render(_props) { // eslint-disable-line no-unused-vars
    const classes = 'Editor ' + (this.state.blockMode ? 'blocks' : 'text');
    return (
      <>
      { this.state.dialog? this.renderDialog() : ""}
      <div className={classes}>
        <ToggleButton setBlockMode={this.handleToggle} blockMode={this.state.blockMode} />
        {this.state.blockMode ? <TrashCan/> : null}
        <div className={"col-xs-3 toolbar-pane"} tabIndex="-1" aria-hidden={!this.state.blockMode}>
          <Toolbar primitives={this.parser.primitives}
                   languageId={this.language.id}
                   blockMode={this.state.blockMode} />
        </div>
        <div className="col-xs-9 codemirror-pane">
        { this.state.blockMode? this.renderBlocks() : this.renderCode() }
        </div>
      </div>
      </>
    );
  }

  renderDialog() {
    const dialogKeyDown = e => {
      if(CodeMirror.keyName(e) == "Esc") this.closeDialog();
    };
    return (
      <div id="Dialog" onKeyDown={dialogKeyDown} tabIndex="0">
        {this.state.dialog}
        <span className="closeDialog" onClick={() => this.closeDialog()}>OK</span>
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
        passedAST={this.ast}
        showDialog={this.showDialog}
        closeDialog={this.closeDialog}
        debugHistory={this.props.debuggingLog.history}
     />
    );
  }
}
