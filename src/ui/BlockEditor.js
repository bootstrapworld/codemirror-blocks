import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import './Editor.less';
import {connect} from 'react-redux';
import global from '../global';
import patch from '../ast-patch';
import NodeEditable from '../components/NodeEditable';
import {activate, activateByNId} from '../actions';
import {playSound, BEEP} from '../sound';
import FakeCursorManager from './FakeCursorManager';
import {pos} from '../types';
import Renderer from '../Renderer';
import merge from '../merge';
import CodeMirrorBlocks from '../blocks';
import CodeMirror from './DragAndDropEditor';

const lockedTypes = [];
const helpers = {renderNodeForReact};

function renderNodeForReact(node, key, props={}) {
  if (typeof node.render === 'function') {
    let Renderer = node.render.bind(node);
    return (
      <Renderer
        node        = {node}
        helpers     = {helpers}
        key         = {key}
        lockedTypes = {lockedTypes}
        {...props} />
    );
  } else {
    throw new Error("Don't know how to render node of type: "+node.type);
  }
}

// TODO(Oak): this should really be a new file, but for convenience we will put it
// here for now

class ToplevelBlock extends React.Component {
  constructor(props) {
    super(props);
    this.container = document.createElement('span');
    this.container.className = 'react-container';
  }

  static propTypes = {
    node: PropTypes.object.isRequired,
  }

  render() {
    const {node} = this.props;
    const {from, to} = node;

    const marker = global.cm.markText(from, to, {replacedWith: this.container});
    marker.BLOCK_NODE_ID = node.id;

    // REVISIT: make comments disappear by adding an empty span
    if (node.options.comment) {
      global.cm.markText(
        node.options.comment.from,
        node.options.comment.to,
        {replacedWith: document.createElement('span')}
      );
    }
    // TODO: Emmanuel's recently changes the above.
    return ReactDOM.createPortal(renderNodeForReact(node), this.container);
  }
}

class ToplevelBlockEditableCore extends Component {

  static propTypes = {}

  editableWillInsert = (value, node) => global.options.willInsertNode(
    global.cm,
    value,
    undefined, // TODO(Oak): just only for the sake of backward compat. Get rid if possible
    node.from,
  )

  constructor(props) {
    super(props);
    const [pos] = this.props.quarantine;
    this.container = document.createElement('span');
    this.container.className = 'react-container';
    this.marker = global.cm.setBookmark(pos, {widget: this.container});
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
                    willInsertNode={this.editableWillInsert}
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
    onRenderer: PropTypes.func,
    hasQuarantine: PropTypes.bool.isRequired,

    // this is actually required, but it's buggy
    // see https://github.com/facebook/react/issues/3163
    ast: PropTypes.object,
    dispatch: PropTypes.func.isRequired,
    cur: pos
  }

  constructor(props) {
    super(props);
    this.mouseUsed = false;
    global.keyMap = this.props.keyMap;
  }

  static defaultProps = {
    options: {},
    cmOptions: {},
    keyMap : {
      'ArrowDown' : 'nextNode',
      'ArrowUp'   : 'prevNode',
      'Home'      : 'firstNode',
      'End'       : 'lastVisibleNode',
      'ArrowLeft' : 'collapseOrSelectParent',
      'ArrowRight': 'expandOrSelectFirstChild',
      'Enter'     : 'edit',
      ' '         : 'toggleSelection',
      'Escape'    : 'clearSelection',
      'Delete'    : 'delete',
      'Backspace' : 'delete',
      '['         : 'insertLeft',
      ']'         : 'insertRight',
      '<'         : 'jumpToRoot',
      '\\'        : 'readAncestors',
      '|'         : 'readChildren',
      'c'         : 'copy',
      'v'         : 'paste',
      'x'         : 'cut',
      'z'         : 'undo',
      'y'         : 'redo',
      'PageUp'    : 'searchPrevious',
      'PageDown'  : 'searchNext',
      'F3'        : 'activateSearchDialog',
      'Tab'       : 'changeFocus',
    },
    search: {
      search: () => null,
      onSearch: () => {},
      setCursor: () => {},
    },
    onRenderer: () => {},
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

      switch (global.keyMap[e.key]) {
      case 'nextNode': {
        e.preventDefault();
        const nextNode = ast.getNodeAfterCur(this.props.cur);
        if (nextNode) this.props.activateByNId(nextNode.nid, {allowMove: true});
        else playSound(BEEP);
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
        // NOTE: this changes the semantics of normal Home button behavior from what's normal.
        // If users complain, we should just delete this entire case
        e.preventDefault();
        this.props.setCursor(null, {line: 0, ch: 0});
        return;

      case 'lastVisibleNode': {
        // NOTE: this changes the semantics of normal End button behavior from what's normal.
        // If users complain, we should just delete this entire case
        e.preventDefault();
        const idx = global.cm.lastLine(), text = global.cm.getLine(idx);
        this.props.setCursor(null, {line: idx, ch: text.length});
        return;
      }

      case 'changeFocus':
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
        global.search.onSearch(state, () => {});
        return;

      case 'searchPrevious':
        e.preventDefault();
        const result = global.search.search(false, state);
        console.log(result);
        activateNoRecord(result);
        return;

      case 'searchNext':
        e.preventDefault();
        activateNoRecord(global.search.search(true, state));
        return;
      }
    });
  }

  handleKeyPress = (ed, e) => {
    if (e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    const text = e.key;
    const cur = global.cm.getCursor();
    this.props.setQuarantine(cur, text);
  }

  handlePaste = (ed, e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const cur = global.cm.getCursor();
    this.props.setQuarantine(cur, text);
  }

  editorChange = (cm, changes) => {
    // This if statement has something to do with undo/redo.
    if (!changes.every(change => change.origin.startsWith('cmb:'))) {
      const newAST = global.parser.parse(cm.getValue());
      const patched = patch(this.props.ast, newAST);
      this.props.setAST(patched.tree);
      // TODO(Oak): should we do anything with patched.firstNewId?
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

    global.cm = ed;
    const ast = this.props.parser.parse(ed.getValue());
    this.props.setAST(ast);
    this.props.setAnnouncer(announcements);

    // if we have nodes, default to the first one. Note that does NOT
    // activate a node; only when the editor is focused, the focused node will be
    // active
    if (ast.rootNodes.length > 0) {
      this.props.dispatch({type: 'SET_FOCUS', focusId: 0});
    }

    this.props.search.setCM(ed);
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
    global.buffer.remove();
  }

  componentDidMount() {
    const {
      parser, language, options, search,
      onRenderer,
    } = this.props;

    global.parser = parser;
    global.options = options;
    global.search = search;

    let languageObj = null;

    if (CodeMirrorBlocks.languages.getLanguage(language)) {
      languageObj = CodeMirrorBlocks.languages.getLanguage(language);
    }
    // TODO(Oak): this is awkward. parser is already available to Toolbar.
    // Just use it there instead.

    const extraOptions = languageObj.getRenderOptions ? languageObj.getRenderOptions() : {};

    const renderOptions = merge(
      options.renderOptions || {lockNodesOfType: []},
      extraOptions
    );
    const renderer = new Renderer(global.cm, renderOptions);
    onRenderer(renderer);

    const clipboardBuffer = document.createElement('textarea');
    clipboardBuffer.ariaHidden = true;
    clipboardBuffer.tabIndex = -1;
    global.buffer = clipboardBuffer;
    // don't make it transparent so that we can debug easily for now
    // global.buffer.style.opacity = 0;
    // global.buffer.style.height = '1px';
    document.body.appendChild(global.buffer);
  }

  handleCursor = (ed, data) => {
    this.props.setCursor(ed, data);
  }

  render() {
    const classes = [];
    if (this.props.language) {
      classes.push(`blocks-language-${this.props.language}`);
    }
    return (
      <div className="Editor blocks">
        <div className="codemirror-pane">
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
                      onCursor={this.handleCursor}
                      editorDidMount={this.handleEditorDidMount} />
        </div>
        {this.renderPortals()}
        <FakeCursorManager />
      </div>
    );
  }

  renderPortals = () => {
    const portals = [];
    if (global.cm && this.props.ast) {
      // NOTE(Oak): we need to clear all Blocks markers (containing a NODE_ID)
      // to prevent overlapping the marker issue
      for (const marker of global.cm.getAllMarks().filter(m => m.BLOCK_NODE_ID)) {
        console.log('portals rendered!');

        // NOTE(Oak): we need to clear all markers up front to prevent
        // overlapping the marker issue
        marker.clear();
      }
      for (const r of this.props.ast.rootNodes) {
        portals.push(<ToplevelBlock key={r.id} node={r} />);
      }
      if (this.props.hasQuarantine) portals.push(<ToplevelBlockEditable key="-1" />);
      setTimeout(() => { global.cm.refresh(); console.log('refreshed CM'); }, 1000);
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
