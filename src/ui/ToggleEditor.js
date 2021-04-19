import React, {Component, createRef} from 'react';
import PropTypes from 'prop-types/prop-types';
import CodeMirror from 'codemirror';
import BlockEditor from './BlockEditor';
import TextEditor from './TextEditor';
import CMBContext from '../components/Context';
import ByString from './searchers/ByString';
import ByBlock from './searchers/ByBlock';
import attachSearch from './Search';
import Toolbar from './Toolbar';
import { ToggleButton, BugButton } from './EditorButtons';
import { say } from '../utils';
import TrashCan from './TrashCan';
import SHARED from '../shared';
import './ToggleEditor.less';

const UpgradedBlockEditor = attachSearch(BlockEditor, [ByString, ByBlock]);

const defaultCmOptions = {
  lineNumbers: true,
  viewportMargin: 10,
  extraKeys: {"Shift-Tab": false},
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

export default @CMBContext class ToggleEditor extends Component {
  state = {
    blockMode: false,
    dialog: false,
  }

  static propTypes = {
    initialCode: PropTypes.string,
    cmOptions: PropTypes.object,
    language: PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      getParser: PropTypes.func.isRequired,
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
    this.toolbarRef = createRef();

    // construct announcer DOM node
    const announcements = document.createElement('div');
    announcements.setAttribute('aria-live', 'assertive');
    announcements.setAttribute('aria-atomic', 'true');
    SHARED.announcer = announcements;

    let defaultOptions = {
      parser: this.parser,
      incrementalRendering: true,
      collapseAll: true
    };
    this.options = Object.assign(defaultOptions, props.options);
    this.hasMounted = false;
    SHARED.recordedMarks = new Map();
    this.eventHandlers = {}; // blank event-handler record

    // make sure 'this' always refers to ToggleEditor
    // see https://reactjs.org/docs/handling-events.html
    this.showDialog  = this.showDialog.bind(this);
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
      'on' : (type, fn) => { 
        if(!this.eventHandlers[type]) { this.eventHandlers[type] = [fn]; }
        else { this.eventHandlers[type].push(fn); }
        SHARED.cm.on(type, fn);
      },
      'off' : (type, fn) => { 
        this.eventHandlers[type]?.filter(h => h !== fn);
        SHARED.cm.off(type, fn);
      },
      'runMode': () => { throw "runMode is not supported in CodeMirror-blocks"; },
      // Expose a scheduler for after react's render cycle is over
      // see https://stackoverflow.com/questions/26556436/react-after-render-code/28748160#28748160
      'afterDOMUpdate' : (f) => {
        window.requestAnimationFrame(() => setTimeout(f, 0));
      }
    };
    return Object.assign(base, api);
  }

  // After a mode switch, rebuild the API and re-assign events
  handleEditorMounted = (ed, api, ast) => {
    // set CM aria attributes, and add announcer
    const mode = this.state.blockMode ? 'Block' : 'Text';
    ed.getScrollerElement().setAttribute('role', 'presentation');
    ed.getWrapperElement().setAttribute('aria-label', mode+' Editor');
    ed.getWrapperElement().appendChild(SHARED.announcer);
    // Rebuild the API and assign re-events
    Object.assign(this.props.api, this.buildAPI(ed), api);
    Object.keys(this.eventHandlers).forEach(type => {
      this.eventHandlers[type].forEach(h => ed.on(type, h));
    });
    
    // once the DOM has loaded, reconstitute any marks and render them
    // see https://stackoverflow.com/questions/26556436/react-after-render-code/28748160#28748160
    window.requestAnimationFrame( () => setTimeout(() => {
      SHARED.recordedMarks.forEach((m, k) => {
        let node = ast.getNodeByNId(k);
        this.props.api.markText(node.from, node.to, m.options);
      });
    }, 0));
    // save the editor, and announce completed mode switch
    SHARED.cm = ed;
    say(mode + " Mode Enabled", 500);
  }

  componentDidMount() { 
    this.hasMounted = true;
    this.currentCode = SHARED.cm.getValue();
  }

  // save any non-block, non-bookmark markers, and the NId they cover
  copyMarks(oldAST) {
    SHARED.recordedMarks.clear();
    SHARED.cm.getAllMarks().filter(m => !m.BLOCK_NODE_ID && m.type !== "bookmark")
      .forEach(m => {
        let {from: oldFrom, to: oldTo} = m.find(), opts = {};
        let node = oldAST.getNodeAt(oldFrom, oldTo); // find the node for the mark
        if(!node) { // bail on non-node markers
          console.error(`Removed TextMarker at [{line:${oldFrom.line}, ch:${oldFrom.ch}},` +
          `{line:${oldTo.line}, ch:${oldTo.ch}}], since that range does not correspond to a node boundary`);
          return;
        }
        const {from, to} = this.newAST.getNodeByNId(node.nid); // use the NID to look node up srcLoc post-PP
        opts.css = m.css; opts.title = m.title; opts.className = m.className;
        SHARED.recordedMarks.set(node.nid, {from: from, to: to, options: opts});
      });
  }

  showDialog(contents) { this.setState( () =>({dialog: contents}));  }
  closeDialog()        { this.setState( () =>({dialog: false}));     }

  handleToggle = blockMode => {
    this.setState( () => {
      let oldAst, WS, code;
      try {
        try {
          let oldCode = SHARED.cm.getValue();
          oldCode.match(/\s+$/);                        // match ending whitespace
          oldAst = SHARED.parser.parse(oldCode);        // parse the code (WITH annotations)
        } catch (err) {
          try   { throw SHARED.parser.getExceptionMessage(err); }
          catch(e){ throw "The parser failed, and the error could not be retrieved"; }
        }
        try {
          code = oldAst.toString() + (WS? WS[0] : "");  // pretty-print and restore whitespace
          this.ast = SHARED.parser.parse(code);         // parse the pretty-printed (PP) code
        } catch (e) {
          throw `An error occured in the language module 
          (the pretty-printer probably produced invalid code)`;
        }
        this.copyMarks(oldAst, code);                   // Preserve old TextMarkers
        this.currentCode = code;                  // update CM with the PP code
        this.props.api.blockMode = blockMode;
        return {blockMode: blockMode};                  // Success! Set the blockMode state
      } catch (e) {                                     // Failure! Set the dialog state
        return {dialog: (
          <>
          <span className="dialogTitle">Could not convert to Blocks</span>
          <p></p>
          {e.toString()}
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
        {this.state.blockMode ? <BugButton/> : null}
        <ToggleButton 
          setBlockMode={this.handleToggle} 
          blockMode={this.state.blockMode} />
        {this.state.blockMode ? <TrashCan/> : null}
        <div className={"col-xs-3 toolbar-pane"} tabIndex="-1" aria-hidden={!this.state.blockMode}>
          <Toolbar 
            primitives={this.parser.primitives}
            languageId={this.language.id}
            blockMode={this.state.blockMode} 
            ref={this.toolbarRef} />
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
    let code = this.hasMounted ? this.currentCode : this.props.initialCode;
    return (
      <TextEditor
        cmOptions={this.cmOptions}
        parser={this.parser}
        initialCode={code}
        onMount={this.handleEditorMounted}
        api={this.props.api} 
        passedAST={this.ast}
      />
    );
  }

  renderBlocks() {
    let code = this.hasMounted ? this.currentCode : this.props.initialCode;
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
        toolbarRef={this.toolbarRef}
        debugHistory={this.props.debuggingLog.history}
     />
    );
  }
}
