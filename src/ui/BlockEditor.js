import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import './Editor.less';
import {connect} from 'react-redux';
import SHARED from '../shared';
import patch from '../ast-patch';
import NodeEditable from '../components/NodeEditable';
import {activate, activateByNId} from '../actions';
import {playSound, BEEP} from '../sound';
import FakeCursorManager from './FakeCursorManager';
import {pos} from '../types';
import merge from '../merge';
import {addLanguage, getLanguage} from '../languages/';
import CodeMirror from './DragAndDropEditor';
import {computeFocusIdFromChanges} from '../utils';


// TODO(Oak): this should really be a new file, but for convenience we will put it
// here for now

class ToplevelBlock extends React.Component {
  constructor(props) {
    super(props);
    this.container = document.createElement('span');
    this.container.classList.add('react-container');
  }

  static propTypes = {
    node: PropTypes.object.isRequired,
  }

  render() {
    const {node} = this.props;
    const {from, to} = node.srcRange(); // includes the node's comment, if any

    const mark = SHARED.cm.markText(from, to, {replacedWith: this.container});
    mark.BLOCK_NODE_ID = node.id;

    return ReactDOM.createPortal(node.reactElement(), this.container);
  }
}

class ToplevelBlockEditableCore extends Component {

  static propTypes = {}

  constructor(props) {
    super(props);
    const [pos] = this.props.quarantine;
    this.container = document.createElement('span');
    this.container.classList.add('react-container');
    this.marker = SHARED.cm.setBookmark(pos, {widget: this.container});
  }

  componentWillUnmount() {
    this.marker.clear();
  }

  render() {
    const {onDisableEditable, onChange, quarantine} = this.props;
    const [pos, value] = quarantine;
    const node = {id: 'editing', from: pos, to: pos};
    const props = {
      tabIndex          : '-1',
      role              : 'text box',
      'aria-setsize'    : '1',
      'aria-posinset'   : '1',
      'aria-level'      : '1',
    };
    return ReactDOM.createPortal(
      <NodeEditable node={node}
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
    activateByNId: PropTypes.func.isRequired,
    search: PropTypes.shape({
      onSearch: PropTypes.func.isRequired,
      search: PropTypes.func.isRequired,
      setCursor: PropTypes.func.isRequired,
    }),
    onBeforeChange: PropTypes.func,
    hasQuarantine: PropTypes.bool.isRequired,
    external: PropTypes.object,

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

    // HERE BE DRAGONS
    this.props.external.getState = this.getState;
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
      'Enter'     : 'edit',
      'Cmd-Enter' : 'edit',
      'Ctrl-Enter': 'edit',
      'Space'     : 'toggleSelection',
      'Esc'       : 'clearSelection',
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

      switch (SHARED.keyMap[SHARED.keyName(e)]) {
      case 'nextNode': {
        e.preventDefault();
        const nextNode = ast.getNodeAfterCur(this.props.cur);
        if (nextNode) {
          this.props.activateByNId(nextNode.nid, {allowMove: true});
        } else {
          playSound(BEEP);
        }
        return;
      }

      case 'prevNode': {
        e.preventDefault();
        const prevNode = ast.getNodeBeforeCur(this.props.cur);
        if (prevNode) {
          this.props.activateByNId(prevNode.nid, {allowMove: true});
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
        if (focusId === -1) {
          if (ast.rootNodes.length > 0) {
            dispatch(activateByNId(0, {allowMove: true}));
            // NOTE(Oak): can also find the closest node based on current cursor
          }
        } else {
          dispatch(activateByNId(null, {allowMove: true}));
        }
        return;

      case 'activateSearchDialog':
        e.preventDefault();
        SHARED.search.onSearch(state, () => {});
        return;

      case 'searchPrevious':
        e.preventDefault();
        const result = SHARED.search.search(false, state);
        console.log(result);
        activateNoRecord(result);
        return;

      case 'searchNext':
        e.preventDefault();
        activateNoRecord(SHARED.search.search(true, state));
        return;
      }
    });
  }

  handleKeyPress = (ed, e) => {
    if (e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    const text = e.key;
    const cur = SHARED.cm.getCursor();
    this.props.setQuarantine(cur, text);
  }

  handlePaste = (ed, e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const cur = SHARED.cm.getCursor();
    this.props.setQuarantine(cur, text);
  }

  editorChange = (cm, changes) => {
    // We only care about changes whose origin is *not* 'cmb:'
    // cmb-originating changes are handled by commitChanges (see codeMirror.js)
    if (!changes.every(c => c.origin && c.origin.startsWith('cmb:'))) {
      const newAST = SHARED.parser.parse(cm.getValue());
      const tree = patch(this.props.ast, newAST);
      let focusNId = computeFocusIdFromChanges(changes, tree);
      this.props.setAST(tree);
      this.props.activateByNId(focusNId);
    }
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

    ed.on('changes', this.editorChange);

    SHARED.cm = ed;
    const ast = this.props.parser.parse(ed.getValue());
    this.props.setAST(ast);
    this.props.dispatch({type: 'COLLAPSE_ALL'});
    this.props.setAnnouncer(announcements);

    // if we have nodes, default to the first one. Note that does NOT
    // activate a node; only when the editor is focused, the focused node will be
    // active
    if (ast.rootNodes.length > 0) {
      this.props.dispatch({type: 'SET_FOCUS', focusId: 0});
    }

    this.props.search.setCM(ed);

    // export methods to the object interface
    this.setExternalMethods(ed, this.props.external);
  }

  // attach all the CM methods to the external object, and 
  // add/override with CMB-specific methods
  setExternalMethods(ed, ext) {
    let protoChain = Object.getPrototypeOf(ed);
    Object.getOwnPropertyNames(protoChain).forEach(m => 
      ext[m] = (...args) => ed[m](...args));
    // attach a getState method for debugging
    ext.getState = () => this.props.dispatch((_, getState) => getState());
    // override the default markText method with one of our own
    ext.markText = (from, to, opts) => alert('not yet implemented');
  }

  handleEditorWillUnmount = ed => {
    ed.off('changes', this.editorChange);
  }

  handleFocus = (ed, e) => {
    const {dispatch} = this.props;
    dispatch((_, getState) => {
      const {cur} = getState();
      if (!this.mouseUsed && cur === null) {
        // NOTE(Oak): use setTimeout so that the CM cursor will not blink
        setTimeout(() => this.props.activateByNId(null, {allowMove: true}), 10);
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
  }

  // TODO(Emmanuel): is 'data' even needed?
  // this change was introduced during the switch from onCursor to onCursorActivity
  // if there are selections, pass null. otherwise pass the cursor
  handleCursor = (ed, data) => {
    let cur = (ed.getSelection().length > 0)? null : ed.getCursor();
    this.props.setCursor(ed, cur);
  }

  render() {
    const classes = [];
    if (this.props.language) {
      classes.push(`blocks-language-${this.props.language}`);
    }
    return (
      <React.Fragment>
        <CodeMirror options={this.props.cmOptions}
                    className={classNames(classes)}
                    value={this.props.value}
                    onBeforeChange={this.props.onBeforeChange}
                    onKeyPress={this.handleKeyPress}
                    onKeyDown={this.handleKeyDown}
                    onMouseDown={this.handleMouseDown}
                    onFocus={this.handleFocus}
                    onPaste={this.handlePaste}
                    cursor={this.props.cur ? this.props.cur : {line: -1, ch: 0}}
                    onCursorActivity={this.handleCursor}
                    editorDidMount={this.handleEditorDidMount} />
        {this.renderPortals()}
        <FakeCursorManager />
      </React.Fragment>
    );
  }

  renderPortals = () => {
    const portals = [];
    if (SHARED.cm && this.props.ast) {
      // NOTE(Oak): we need to clear all Blocks markers (containing a NODE_ID)
      // to prevent overlapping the marker issue
      for (const marker of SHARED.cm.getAllMarks().filter(m => m.BLOCK_NODE_ID)) {
        console.log('portals rendered!');

        // NOTE(Oak): we need to clear all markers up front to prevent
        // overlapping the marker issue
        marker.clear();
      }
      for (const r of this.props.ast.rootNodes) {
        portals.push(<ToplevelBlock key={r.id} node={r} />);
      }
      if (this.props.hasQuarantine) portals.push(<ToplevelBlockEditable key="-1" />);
      setTimeout(() => { SHARED.cm.refresh(); console.log('refreshed CM'); }, 100);
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
  setCursor: (_, cur) => dispatch({type: 'SET_CURSOR', cur}),
  clearFocus: () => dispatch({type: 'SET_FOCUS', focusId: -1}),
  setQuarantine: (pos, text) => dispatch({type: 'SET_QUARANTINE', pos, text}),
  activateByNId: (nid, options) => dispatch(activateByNId(nid, options)),
});

export default connect(mapStateToProps, mapDispatchToProps)(BlockEditor);
