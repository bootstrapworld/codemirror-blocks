import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import CodeMirror from 'codemirror';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import './Editor.less';
import {connect} from 'react-redux';
import SHARED from '../shared';
import NodeEditable from '../components/NodeEditable';
import {activate, setCursor, insert, OverwriteTarget} from '../actions';
import {commitChanges} from '../edits/commitChanges';
import {speculateChanges} from '../edits/speculateChanges';
import {playSound, BEEP} from '../sound';
import {pos} from '../types';
import merge from '../merge';
import {addLanguage, getLanguage} from '../languages/';
import DragAndDropEditor from './DragAndDropEditor';
import {poscmp, say} from '../utils';
import BlockComponent from '../components/BlockComponent';



// TODO(Oak): this should really be a new file, but for convenience we will put it
// here for now

class ToplevelBlock extends BlockComponent {
  constructor(props) {
    super(props);
    this.container = document.createElement('span');
    this.container.classList.add('react-container');
  }

  static propTypes = {
    node: PropTypes.object.isRequired,
  }

  // we need to trigger a render if the node was moved or resized at the
  // top-level, in order to re-mark the node and put the DOM in the new marker
  shouldComponentUpdate(nextProps, nextState) {
    return poscmp(this.props.node.from, nextProps.node.from) !== 0 // moved
      ||   poscmp(this.props.node.to,   nextProps.node.to  ) !== 0 // resized
      ||   super.shouldComponentUpdate(nextProps, nextState)       // changed
      ||   !document.contains(this.mark.replacedWith);             // removed from DOM
  }

  componentWillUnmount() { this.mark.clear(); }

  render() {
    const {node} = this.props;
    const {from, to} = node.srcRange(); // includes the node's comment, if any
    // if any prior block markers are in this range, clear them
    SHARED.cm.findMarks(from, to).filter(m=>m.BLOCK_NODE_ID).forEach(m => m.clear());
    this.mark = SHARED.cm.markText(from, to, {replacedWith: this.container});
    this.mark.BLOCK_NODE_ID = node.id;
    return ReactDOM.createPortal(node.reactElement(), this.container);
  }
}

class ToplevelBlockEditableCore extends Component {

  static propTypes = {}

  constructor(props) {
    super(props);
    const [start, end] = this.props.quarantine;
    this.container = document.createElement('span');
    this.container.classList.add('react-container');
    // CM treats 0-width ranges differently than other ranges, so check
    if(poscmp(start, end) === 0) {
      this.marker = SHARED.cm.setBookmark(start, {widget: this.container});
    } else {
      this.marker = SHARED.cm.markText(start, end, {replacedWith: this.container});
    }
  }

  componentWillUnmount() {
    this.marker.clear();
  }

  render() {
    const {onDisableEditable, onChange, quarantine} = this.props;
    const [start, end, value] = quarantine;
    const props = {
      tabIndex          : '-1',
      role              : 'text box',
      'aria-setsize'    : '1',
      'aria-posinset'   : '1',
      'aria-level'      : '1',
    };
    return ReactDOM.createPortal(
      <NodeEditable target={new OverwriteTarget(start, end)}
                    value={value}
                    onChange={onChange}
                    contentEditableProps={props}
                    isInsertion={true}
                    extraClasses={[]}
                    onDisableEditable={onDisableEditable} />,
      this.container
    );
  }
}

const mapStateToProps2 = ({quarantine}) => ({quarantine});
const mapDispatchToProps2 = dispatch => ({
  onDisableEditable: () => dispatch({type: 'DISABLE_QUARANTINE'}),
  onChange: text => dispatch({type: 'CHANGE_QUARANTINE', text}),
});
const ToplevelBlockEditable = connect(mapStateToProps2, mapDispatchToProps2)(ToplevelBlockEditableCore);

class BlockEditor extends Component {
  static propTypes = {
    value: PropTypes.string.isRequired,
    options: PropTypes.object,
    cmOptions: PropTypes.object,
    keyMap: PropTypes.object,
    language: PropTypes.string.isRequired,
    parser: PropTypes.object.isRequired,
    setAST: PropTypes.func.isRequired,
    setCursor: PropTypes.func.isRequired,
    setQuarantine: PropTypes.func.isRequired,
    setAnnouncer: PropTypes.func.isRequired,
    clearFocus: PropTypes.func.isRequired,
    activate: PropTypes.func.isRequired,
    search: PropTypes.shape({
      onSearch: PropTypes.func.isRequired,
      search: PropTypes.func.isRequired,
      setCursor: PropTypes.func.isRequired,
    }),
    onBeforeChange: PropTypes.func,
    onMount:PropTypes.func.isRequired,
    hasQuarantine: PropTypes.bool.isRequired,
    api: PropTypes.object,

    // this is actually required, but it's buggy
    // see https://github.com/facebook/react/issues/3163
    ast: PropTypes.object,
    dispatch: PropTypes.func.isRequired,
    cur: pos
  }

  constructor(props) {
    super(props);
    this.mouseUsed = false;
    SHARED.keyMap = this.props.keyMap;
    SHARED.keyName = CodeMirror.keyName;
  }

  static defaultProps = {
    options: {},
    cmOptions: {},
    keyMap : {
      'Down'      : 'nextNode',
      'Up'        : 'prevNode',
      'Home'      : 'firstNode',
      'End'       : 'lastVisibleNode',
      'Left'      : 'collapseOrSelectParent',
      'Right'     : 'expandOrSelectFirstChild',
      'Shift-Left': 'collapseAll',
      'Shift-Right':'expandAll',
      'Shift-Alt-Left': 'collapseCurrentRoot',
      'Shift-Alt-Right':'expandCurrentRoot',
      'Enter'     : 'edit',
      'Cmd-Enter' : 'edit',
      'Ctrl-Enter': 'edit',
      'Space'     : 'toggleSelection',
      'Esc'       : 'clearSelection',
      'Alt-Q'     : 'clearSelection',
      'Delete'    : 'delete',
      'Backspace' : 'delete',
      'Ctrl-['    : 'insertLeft',
      'Ctrl-]'    : 'insertRight',
      'Shift-,'   : 'jumpToRoot',
      '\\'        : 'readAncestors',
      'Shift-\\'  : 'readChildren',
      'PageUp'    : 'searchPrevious',
      'PageDown'  : 'searchNext',
      'F3'        : 'activateSearchDialog',
      'Ctrl-F'    : 'activateSearchDialog',
      'Tab'       : 'changeFocus',
      'Ctrl-Z'    : 'undo',
      'Cmd-Z'     : 'undo',
      'Ctrl-Y'    : 'redo',
      'Cmd-Shift-Z':'redo',
      'Cmd-C'     : 'copy',
      'Ctrl-C'    : 'copy',
      'Cmd-V'     : 'paste',
      'Ctrl-V'    : 'paste',
      'Cmd-X'     : 'cut',
      'Ctrl-X'    : 'cut'
    },
    search: {
      search: () => null,
      onSearch: () => {},
      setCursor: () => {},
    },
    api: {}
  }

  // NOTE: if there's a focused node, this handler will not be activated
  handleKeyDown = (ed, e) => {
    const {dispatch} = this.props;

    const activateNoRecord = node => {
      dispatch(activate(node.id, {record: false, allowMove: true}));
    };

    dispatch((_, getState) => {
      const state = getState();
      const {ast, focusId} = state;
      const message = SHARED.keyMap[SHARED.keyName(e)];
      console.log("message:", message);
      switch (message) {
      case 'nextNode': {
        e.preventDefault();
        const nextNode = ast.getNodeAfterCur(this.props.cur);
        console.log(nextNode);
        if (nextNode) {
          console.log("about to activate");
          this.props.activate(nextNode.id, {allowMove: true});
          console.log("done activating");
        } else {
          playSound(BEEP);
        }
        return;
      }

      case 'prevNode': {
        e.preventDefault();
        const prevNode = ast.getNodeBeforeCur(this.props.cur);
        if (prevNode) {
          this.props.activate(prevNode.id, {allowMove: true});
        } else {
          playSound(BEEP);
        }
        return;
      }

      case 'firstNode':
        // NOTE(Emmanuel): shouldn't this go to the first node?
        e.preventDefault();
        this.props.setCursor(null, {line: 0, ch: 0});
        return;

      case 'lastVisibleNode':
        // NOTE(Emmanuel): shouldn't this go to the last visible node?
        e.preventDefault();
        const idx = SHARED.cm.lastLine(), text = SHARED.cm.getLine(idx);
        this.props.setCursor(null, {line: idx, ch: text.length});
        return;

      case 'changeFocus':
        // NOTE(Emmanuel): this is dead code, unless we can trap tab events
        e.preventDefault();
        if (focusId === null) {
          if (ast.rootNodes.length > 0) {
            dispatch(activate(ast.getFirstRootNode(), {allowMove: true}));
            // NOTE(Oak): can also find the closest node based on current cursor
          }
        } else {
          dispatch(activate(null, {allowMove: true}));
        }
        return;

      case 'activateSearchDialog':
        e.preventDefault();
        SHARED.search.onSearch(
          state, 
          () => {}, 
          () => SHARED.search.search(true, state)
        );
        return;

      case 'searchPrevious':
        e.preventDefault();
        const result = SHARED.search.search(false, state);
        activateNoRecord(result);
        return;

      case 'searchNext':
        e.preventDefault();
        activateNoRecord(SHARED.search.search(true, state));
        return;

      case 'undo':
        e.preventDefault();
        SHARED.cm.undo();
        return;

      case 'redo':
        e.preventDefault();
        SHARED.cm.redo();
        return;

      case 'delete':
        e.preventDefault();
        const dFrom = SHARED.cm.getCursor(true);
        const dTo = SHARED.cm.getCursor(false);
        insert("", new OverwriteTarget(dFrom, dTo));
        return;
      }
    });
  }

  handleKeyPress = (ed, e) => {
    const text = e.key;
    // let CM handle kbd shortcuts or whitespace insertion
    if (e.ctrlKey || e.metaKey || text.match(/\s+/)) return;
    e.preventDefault();
    const start = SHARED.cm.getCursor(true);
    const end = SHARED.cm.getCursor(false);
    this.props.setQuarantine(start, end, text);
  }

  handlePaste = (ed, e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const start = SHARED.cm.getCursor(true);
    const end = SHARED.cm.getCursor(false);
    this.props.setQuarantine(start, end, text);
  }


  handleBeforeChange = (cm, change) => {
    let knownOrigin = (origin) =>
      origin && (origin.startsWith("cmb:") || origin=="undo" || origin=="redo");
    if (!knownOrigin(change.origin)) {
      // We did not produce this change. It may not be valid.
      // Check to see if it's valid, and if not cancel the change.
      if (!speculateChanges([change])) {
        change.cancel();
      }
    }
  }

  handleChanges = (cm, changes) => {
    this.props.dispatch((dispatch, getState) => {
      if (!changes.every(c => c.origin && c.origin.startsWith("cmb:"))) {
        // These changes did not originate from us. However, they've all gone
        // passed the `handleBeforeChange` function, so they must be valid edits.
        // (There's almost certainly just one edit here; I (Justin) am not
        // convinced this will always work if there is more than one edit here.)
        // Since the edit(s) is valid, commit it.
        if (changes[0].origin === "undo") {
          for (let c of changes) c.origin = "cmb:undo";
          const undoFocusStack = getState().undoFocusStack;
          const {oldFocusNId, _newFocusNId} = undoFocusStack[undoFocusStack.length - 1];
          const focusHint = (newAST) => newAST.getNodeByNId(oldFocusNId);
          commitChanges(changes, true, focusHint);
          dispatch({type: 'UNDO'});
        } else if (changes[0].origin === "redo") {
          for (let c of changes) c.origin = "cmb:redo";
          const redoFocusStack = getState().redoFocusStack;
          const {_oldFocusNId, newFocusNId} = redoFocusStack[redoFocusStack.length - 1];
          const focusHint = (newAST) => newAST.getNodeByNId(newFocusNId);
          commitChanges(changes, true, focusHint);
          dispatch({type: 'REDO'});
        } else {
          commitChanges(changes, false);
        }
      }
    });
  }

  handleEditorDidMount = ed => {
    const wrapper = ed.getWrapperElement();
    wrapper.setAttribute('role', 'tree');
    wrapper.setAttribute('aria-label', 'Block Editor');

    const scroller = ed.getScrollerElement();
    scroller.setAttribute('role', 'presentation');

    const announcements = document.createElement('span');
    announcements.setAttribute('role', 'log');
    announcements.setAttribute('aria-live', 'assertive');
    wrapper.appendChild(announcements);
    ed.on('beforeChange', this.handleBeforeChange);
    ed.on('changes', this.handleChanges);

    SHARED.cm = ed;
    const ast = this.props.parser.parse(ed.getValue());
    this.props.setAST(ast);
    if (this.props.options.collapseAll) {
      this.props.dispatch({type: 'COLLAPSE_ALL'});
    }
    this.props.setAnnouncer(announcements);
    say("Block Mode Enabled", 500);

    // if we have nodes, default to the first one. Note that does NOT
    // activate a node; only when the editor is focused, the focused node will be
    // active
    if (ast.rootNodes.length > 0) {
      this.props.dispatch({type: 'SET_FOCUS', focusId: ast.rootNodes[0].id});
    }
    // a tree element should know how many roots it has
    wrapper.setAttribute('aria-setsize', ast.rootNodes.length);
    this.props.search.setCM(ed);

    // once the DOM has loaded, reconstitute any marks and render them
    // see https://stackoverflow.com/questions/26556436/react-after-render-code/28748160#28748160
    window.requestAnimationFrame( () => setTimeout(() => {
      this.markMap = new Map();
      SHARED.recordedMarks.forEach((m, k) => {
        let node = this.props.ast.getNodeByNId(k);
        this.markText(node.from, node.to, m.options);
      });
    }, 0));

    this.props.onMount(ed);

    // export methods to the object interface
    merge(this.props.api, this.buildAPI(ed));
  }

  buildAPI(ed) {
    let withState = (func) => this.props.dispatch((_, getState) => func(getState()));
    return {
      // cm methods
      'findMarks':  (from, to) => this.findMarks(from, to),
      'findMarksAt':(pos) => this.findMarksAt(pos),
      'getAllMarks':() => this.getAllMarks(),
      'markText':   (from, to, opts) => this.markText(from, to, opts),
      'runMode': (_src, _lang, _container) => () => {}, // no-op since not an editing command
      'setCursor': (pos) => this.props.setCursor(ed, pos),
      // block methods
      'getAst':
        () => withState((state) => state.ast),
      'getFocusedNode':
        () => withState(({focusId, ast}) => focusId ? ast.getNodeById(focusId) : null),
      'getSelectedNodes':
        () => withState(({selections, ast}) => selections.map(id => ast.getNodeById(id))),
      // testing methods
      'getQuarantine': () => withState(({quarantine}) => quarantine),
      'setQuarantine': (q) => this.props.setQuarantine(q),
    };
  }

  markText(from, to, options) {
    let node = this.props.ast.getNodeAt(from, to);
    if(!node) {
      throw new Error('Could not create TextMarker: there is no AST node at [',from, to,']');
    }
    let supportedOptions = ['css','className','title'];
    for (let opt in options) {
      if (!supportedOptions.includes(opt))
        throw new Error(`markText: option "${opt}" is not supported in block mode`);
    }
    let mark = SHARED.cm.markText(from, to, options); // keep CM in sync
    mark._clear = mark.clear;
    mark.clear = () => { mark._clear(); this.props.dispatch({type: 'CLEAR_MARK', id: node.id}); };
    mark.find = () => { let {from, to} = this.props.ast.getNodeById(node.id); return {from, to}; };
    mark.options = options;
    this.props.dispatch({type: 'ADD_MARK', id: node.id, mark: mark});
    return mark;
  }
  findMarks(from, to) {
    return SHARED.cm.findMarks(from, to).filter(m => !m.BLOCK_NODE_ID);
  }
  findMarksAt(pos) {
    return SHARED.cm.findMarksAt(pos).filter(m => !m.BLOCK_NODE_ID);
  }
  getAllMarks() {
    return SHARED.cm.getAllMarks().filter(m => !m.BLOCK_NODE_ID);
  }
  // clear all non-block marks
  _clearMarks() {
    this.getAllMarks().map(m => m.clear());
  }

  renderMarks() {
    SHARED.cm.getAllMarks().filter(m => !m.BLOCK_NODE_ID && m.type !== "bookmark")
      .forEach(m => m.clear());
    this.props.dispatch((_, getState) => {
      const {markedMap} = getState();
      markedMap.forEach(v => {
        let {from, to} = v.find();
        SHARED.cm.markText(from, to, v.options);
      });
    });
  }

  handleEditorWillUnmount = ed => {
    ed.off('beforeChange', this.handleBeforeChange);
    ed.off('changes', this.handleChanges);
  }

  handleFocus = (ed, e) => {
    const {dispatch} = this.props;
    dispatch((_, getState) => {
      const {cur} = getState();
      if (!this.mouseUsed && (cur === null)) {
        // NOTE(Oak): use setTimeout so that the CM cursor will not blink
        setTimeout(() => this.props.activate(null, {allowMove: true}), 0);
        this.mouseUsed = false;
      }
    });
  }

  handleMouseDown = () => {
    this.mouseUsed = true;
    setTimeout(() => this.mouseUsed = false, 200);
  }

  componentWillUnmount() {
    SHARED.buffer.remove();
  }

  componentDidMount() {
    const {
      parser, language, options, search,
    } = this.props;

    // TODO: pass these with a React Context or something sensible like that.
    SHARED.parser = parser;
    SHARED.options = options;
    SHARED.search = search;

    let languageObj = null;

    if (getLanguage(language)) {
      languageObj = getLanguage(language);
    }

    const clipboardBuffer = document.createElement('textarea');
    clipboardBuffer.ariaHidden = true;
    clipboardBuffer.tabIndex = -1;
    SHARED.buffer = clipboardBuffer;
    // don't make it transparent so that we can debug easily for now
    // SHARED.buffer.style.opacity = 0;
    // SHARED.buffer.style.height = '1px';
    document.body.appendChild(SHARED.buffer);
    this.afterDOMUpdate();
  }

  componentDidUpdate() { this.afterDOMUpdate(); }

  // NOTE(Emmanuel): use requestAnimationFrame to make sure that cm.refresh() is called
  // after the DOM has completely finished updating.
  // see https://stackoverflow.com/questions/26556436/react-after-render-code/28748160#28748160
  afterDOMUpdate() {
    window.requestAnimationFrame(() => setTimeout( () => {
      const {dispatch} = this.props;
      dispatch((_, getState) => {
        const {quarantine} = getState();
        if(!quarantine) SHARED.cm.refresh(); // don't refresh mid-quarantine
      });
      }, 0));
  }

  // TODO(Emmanuel): is 'data' even needed?
  // this change was introduced during the switch from onCursor to onCursorActivity
  // if there are selections, pass null. otherwise pass the cursor
  handleCursor = (ed, data) => {
    let cur = (ed.getSelection().length > 0)? null : ed.getCursor();
    this.props.setCursor(ed, cur);
  }

  render() {
    this.startTime = Date.now();
    const classes = [];
    if (this.props.language) {
      classes.push(`blocks-language-${this.props.language}`);
    }
    return (
      <React.Fragment>
        <DragAndDropEditor
          options={this.props.cmOptions}
          className={classNames(classes)}
          value={this.props.value}
          onBeforeChange={this.props.onBeforeChange}
          onKeyPress={this.handleKeyPress}
          onKeyDown={this.handleKeyDown}
          onMouseDown={this.handleMouseDown}
          onFocus={this.handleFocus}
          onPaste={this.handlePaste}
          onCursorActivity={this.handleCursor}
          editorDidMount={this.handleEditorDidMount} />
        {this.renderPortals()}
      </React.Fragment>
    );
  }

  renderPortals = () => {
    let portals;
    if (SHARED.cm && this.props.ast) {
      // Render all the portals and add TextMarkers -- thunk this so CM only recalculates once
      portals = this.props.ast.rootNodes.map(r => <ToplevelBlock key={r.id} node={r} />);
      if (this.props.hasQuarantine) portals.push(<ToplevelBlockEditable key="-1" />);
    }
    return portals;
  }
}

const mapStateToProps = ({ast, cur, quarantine}) => ({
  ast,
  cur,
  hasQuarantine: !!quarantine
});
const mapDispatchToProps = dispatch => ({
  dispatch,
  setAST: ast => dispatch({type: 'SET_AST', ast}),
  setAnnouncer: announcer => dispatch({type: 'SET_ANNOUNCER', announcer}),
  setCursor: (_, cur) => dispatch(setCursor(cur)),
  clearFocus: () => dispatch({type: 'SET_FOCUS', focusId: null}),
  setQuarantine: (start, end, text) => dispatch({type: 'SET_QUARANTINE', start, end, text}),
  activate: (id, options) => dispatch(activate(id, options)),
});

export default connect(mapStateToProps, mapDispatchToProps)(BlockEditor);
