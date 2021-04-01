import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import 'codemirror/addon/search/search';
import 'codemirror/addon/search/searchcursor';
import classNames from 'classnames';
import PropTypes from 'prop-types/prop-types';
import './Editor.less';
import {connect} from 'react-redux';
import SHARED from '../shared';
import NodeEditable from '../components/NodeEditable';
import {activateByNid, setCursor, OverwriteTarget} from '../actions';
import {commitChanges} from '../edits/commitChanges';
import {speculateChanges, getTempCM} from '../edits/speculateChanges';
import {pos} from '../types';
import DragAndDropEditor from './DragAndDropEditor';
import {poscmp, say, resetNodeCounter, minpos, maxpos,
  validateRanges, BlockError} from '../utils';
import BlockComponent from '../components/BlockComponent';
import { defaultKeyMap, keyDown } from '../keymap';
import {store} from '../store';

// CodeMirror APIs that we need to disallow
const unsupportedAPIs = ['indentLine', 'toggleOverwrite', 'setExtending',
  'getExtending', 'findPosH', 'findPosV', 'setOption',
  'addOverlay', 'removeOverlay', 'undoSelection', 'redoSelection',
  'charCoords', 'coordsChar', 'cursorCoords', 'startOperation',
  'endOperation', 'operation', 'addKeyMap', 'removeKeyMap', 
  //'on', 'off',
  'extendSelection', 'extendSelections', 'extendSelectionsBy'];

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

  // by default, let's render a placeholder
  state = { renderPlaceholder: this.props.incrementalRendering };

  // we need to trigger a render if the node was moved or resized at the
  // top-level, in order to re-mark the node and put the DOM in the new marker
  shouldComponentUpdate(nextProps, nextState) {
    return poscmp(this.props.node.from, nextProps.node.from) !== 0 // moved
      ||   poscmp(this.props.node.to,   nextProps.node.to  ) !== 0 // resized
      ||   super.shouldComponentUpdate(nextProps, nextState)       // changed
      ||   !document.contains(this.mark.replacedWith);             // removed from DOM
  }

  componentWillUnmount() { this.mark.clear(); }

  // once the placeholder has mounted, wait 250ms and render
  componentDidMount() {
    if(!this.props.incrementalRendering) return; // bail if incremental is off
    window.requestAnimationFrame( () => {
      setTimeout(() => this.setState({ renderPlaceholder: false }), 50);
    });
  }

  render() {
    const {node} = this.props;

    // set elt to a cheap placeholder, OR render the entire rootNode
    const elt = this.state.renderPlaceholder? (<div/>) : node.reactElement();

    // if any prior block markers are in this range, clear them
    const {from, to} = node.srcRange(); // includes the node's comment, if any
    SHARED.cm.findMarks(from, to).filter(m=>m.BLOCK_NODE_ID).forEach(m => m.clear());
    this.mark = SHARED.cm.markText(from, to, {replacedWith: this.container});
    this.mark.BLOCK_NODE_ID = node.id;
    node.mark = this.mark;
    return ReactDOM.createPortal(elt, this.container);
  }
}

class ToplevelBlockEditableCore extends Component {

  static propTypes = {
    quarantine: PropTypes.array.isRequired,
    onDisableEditable: PropTypes.func.isRequired,
    onChange: PropTypes.func.isRequired,
  }

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
    activateByNid: PropTypes.func.isRequired,
    search: PropTypes.shape({
      onSearch: PropTypes.func.isRequired,
      search: PropTypes.func.isRequired,
      setCursor: PropTypes.func.isRequired,
      setCM: PropTypes.func.isRequired,
    }),
    onBeforeChange: PropTypes.func,
    onMount:PropTypes.func.isRequired,
    hasQuarantine: PropTypes.bool.isRequired,
    api: PropTypes.object,
    passedAST: PropTypes.object,

    // this is actually required, but it's buggy
    // see https://github.com/facebook/react/issues/3163
    ast: PropTypes.object,
    dispatch: PropTypes.func.isRequired,
    cur: pos
  }

  constructor(props) {
    super(props);
    this.mouseUsed = false;

    // stick the keyDown handler in the store
    store.onKeyDown = this.handleKeyDown;
  }

  static defaultProps = {
    options: {},
    keyMap : defaultKeyMap,
    search: {
      search: () => null,
      onSearch: () => {},
      setCursor: () => {},
    },
    api: {}
  }

  // Anything that didn't come from cmb itself must be speculatively
  // checked. NOTE: this only checks the *first change* in a changeset!
  handleBeforeChange = (cm, change) => {
    let notFromCMB = (origin) => origin && origin.startsWith("cmb:");
    if (!notFromCMB(change.origin)) {
      let {successful, newAST} = speculateChanges([change]);
      // Successful! Let's save all the hard work we did to build the new AST
      if (successful) { this.newAST = newAST; }
      // Error! Cancel the change
      else {
        change.cancel();
        throw new BlockError("An invalid change was rejected", "Invalid Edit", change);
      }
    }
  }

  handleChanges = (cm, changes) => {
    this.props.dispatch((dispatch, getState) => {
      if (!changes.every(c => c.origin && c.origin.startsWith("cmb:"))) {
        // These changes did not originate from us. However, they've all
        // passed the `handleBeforeChange` function, so they must be valid edits.
        // (There's almost certainly just one edit here; I (Justin) am not
        // convinced this will always work if there is more than one edit here.)
        // Since the edit(s) is valid, commit it without calling speculateChanges.

        // Turn undo and redo into cmb actions, update the focusStack, and
        // provide a focusHint
        if (changes[0].origin === "undo") {
          for (let c of changes) c.origin = "cmb:undo";
          const {oldFocusNId, _newFocusNId} = getState().actionFocus;
          const focusHint = (newAST) => newAST.getNodeByNId(oldFocusNId);
          commitChanges(changes, true, focusHint, this.newAST);
          dispatch({type: 'UNDO'});
        } else if (changes[0].origin === "redo") {
          for (let c of changes) c.origin = "cmb:redo";
          const {_oldFocusNId, newFocusNId} = getState().actionFocus;
          const focusHint = (newAST) => newAST.getNodeByNId(newFocusNId);
          commitChanges(changes, true, focusHint, this.newAST);
          dispatch({type: 'REDO'});
        } else {
          // This (valid) changeset is coming from outside of the editor, but we
          // don't know anything else about it. Apply the change, set the focusHint
          // to the top of the tree (-1), and provide an astHint so we don't need
          // to reparse and rebuild the tree
          let annt = '';
          for (let i = changes.length - 1; i >= 0; i--) {
            annt = annt + changes[i].origin;
            if (i !== 0) annt = ' and ' + annt;
          }
          if (annt === '') annt = 'change';
          getState().undoableAction = annt; //?
          //console.log('BlockEditor.js calling commitChanges', changes)
          commitChanges(changes, false, -1, this.newAST);
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

    var ast = this.props.passedAST;
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

    // pass the block-mode CM editor, API, and current AST
    SHARED.cm = ed;
    this.props.onMount(ed, this.buildAPI(ed), ast);
  }

  executeAction(action) {
    // convert code to AST
    if(action.type == "SET_AST") {
      SHARED.cm.setValue(action.code);
      action.ast = this.props.ast;
      delete action.code;
    }
    // convert nid to node id, and use activate to generate the action
    if(action.type == "SET_FOCUS") {
      // NOTE(Emmanuel): the following line is probably dead code
      action.focusId = this.props.ast.getNodeByNId(action.nid).id;
      //console.log('XXX BlockEditor:311 calling activateByNid');
      this.props.activateByNid(action.nid, {allowMove: true});
      delete action.nid;
      return;
    }
    // ignore set announcer
    if(action.type == "SET_ANNOUNCER"){ return; }
    this.props.dispatch(action);
  }

  buildAPI(ed) {
    let withState = (func) => this.props.dispatch((_, getState) => func(getState()));
    const cm = SHARED.cm;
    const api = {
      /*****************************************************************
      * CM APIs WE WANT TO OVERRIDE
      */
      'findMarks':  (from, to) => SHARED.cm.findMarks(from, to).filter(m => !m.BLOCK_NODE_ID),
      'findMarksAt': (pos) => SHARED.cm.findMarksAt(pos).filter(m => !m.BLOCK_NODE_ID),
      'getAllMarks': () => SHARED.cm.getAllMarks().filter(m => !m.BLOCK_NODE_ID),
      'markText': (from, to, opts) => this.markText(from, to, opts),
      // Something is selected if CM has a selection OR a block is selected
      'somethingSelected': () => withState(({selections}) =>
        Boolean(SHARED.cm.somethingSelected() || selections.length)),
      // CMB has focus if CM has focus OR a block is active
      'hasFocus': () =>
        cm.hasFocus() || Boolean(document.activeElement.id.match(/block-node/)),
      'extendSelection': (from, to, opts) => this.extendSelections([from], opts, to),
      'extendSelections': (heads, opts) => this.extendSelections(heads, opts),
      'extendSelectionsBy': (f, opts) =>
        this.extendSelections(this.listSelections().map(f), opts),
      'getSelections': (sep) =>
        this.listSelections().map(s => SHARED.cm.getRange(s.anchor, s.head, sep)),
      'getSelection': (sep) =>
        this.listSelections().map(s => SHARED.cm.getRange(s.anchor, s.head, sep)).join(sep),
      'listSelections' : () => this.listSelections(),
      'replaceRange': (text, from, to, origin) => withState(({ast}) => {
        validateRanges([{anchor:from, head:to}], ast);
        SHARED.cm.replaceRange(text, from, to, origin);
      }),
      'setSelections': (ranges, primary, opts) => this.setSelections(ranges, primary, opts),
      'setSelection': (anchor, head=anchor, opts) =>
        this.setSelections([{anchor: anchor, head: head}], null, opts),
      'addSelection': (anchor, head) =>
        this.setSelections([{anchor: anchor, head: head}], null, null, false),
      'replaceSelections': (rStrings, select) => this.replaceSelections(rStrings, select),
      'replaceSelection': (rString, select) =>
        this.replaceSelections(Array(this.listSelections().length).fill(rString), select),
      // If a node is active, return the start. Otherwise return the cursor as-is
      'getCursor': (where) => this.getCursor(where),
      // If the cursor falls in a node, activate it. Otherwise set the cursor as-is
      'setCursor': (cur) => withState(({ast}) => {
        const node = ast.getNodeContaining(cur);
        if(node) {
          //console.log('XXX BlockEditor:365 calling activateByNid');
          this.props.activateByNid(node.nid, {record: false, allowMove: true});
        }
        this.props.setCursor(ed, cur);
      }),
      // As long as widget isn't defined, we're good to go
      'setBookmark': (pos, opts) => {
        if(opts.widget) {
          throw new BlockError("setBookmark() with a widget is not supported in Block Mode", "API Error");
        }
        SHARED.cm.setBookmark(pos, opts);
      },

      /*****************************************************************
      * APIs THAT ARE UNIQUE TO CODEMIRROR-BLOCKS
      */
      'getAst':
        () => withState((state) => state.ast),
      'getFocusedNode': // activation-test.js expects undefined
        () => withState(({focusId, ast}) => focusId ? ast.getNodeById(focusId) : undefined),
      'getSelectedNodes':
        () => withState(({selections, ast}) => selections.map(id => ast.getNodeById(id))),

      /*****************************************************************
      * APIs FOR TESTING
      */
      'getQuarantine': () => withState(({quarantine}) => quarantine),
      'setQuarantine': (q) => this.props.setQuarantine(q),
      'resetNodeCounter': () => resetNodeCounter(),
      'executeAction' : (action) => this.executeAction(action),
    };
    // show which APIs are unsupported
    unsupportedAPIs.forEach(f =>
      api[f] = () => {
        throw BlockError(
          `The CM API '${f}' is not supported in the block editor`,
          'API Error');
      });
    return api;
  }

  markText(from, to, options) {
    let node = this.props.ast.getNodeAt(from, to);
    if(!node) {
      throw new BlockError(
        'Could not create TextMarker: there is no AST node at [',from, to,']',
        'API Error');
    }
    let supportedOptions = ['css','className','title'];
    for (let opt in options) {
      if (!supportedOptions.includes(opt))
        throw new BlockError(
          `markText: option "${opt}" is not supported in block mode`,
          `API Error`);
    }
    let mark = SHARED.cm.markText(from, to, options); // keep CM in sync
    mark._clear = mark.clear;
    mark.ID = node.id;
    console.log(mark);
    mark.clear = () => { console.log('clearing'); mark._clear(); this.props.dispatch({type: 'CLEAR_MARK', id: node.id}); };
    mark.find = () => { let {from, to} = this.props.ast.getNodeById(node.id); return {from, to}; };
    mark.options = options;
    this.props.dispatch({type: 'ADD_MARK', id: node.id, mark: mark});
    return mark;
  }
  // disallow widget option
  setBookmark(pos, options) {
    if(options.widget) {
      throw new BlockError(
        `setBookmark: option 'widget' is not supported in block mode`,
        `API Error`);
    }
    return SHARED.cm.setBookmark(pos, options);
  }
  getCursor(where="from") {
    const dispatch = this.props.dispatch;
    const {focusId, ast} = dispatch((_, getState) => getState());
    if(focusId && document.activeElement.id.match(/block-node/)) {
      const node = ast.getNodeById(focusId);
      if(where == "from") return node.from;
      if(where == "to") return node.to;
      else throw new BlockError(
        `getCursor() with ${where} is not supported on a focused block`,
        `API Error`);
    } else { return SHARED.cm.getCursor(where); }
  }
  listSelections() {
    const dispatch = this.props.dispatch;
    const {selections, ast} = dispatch((_, getState) => getState());
    let tmpCM = getTempCM();
    // write all the ranges for all selected nodes
    selections.forEach(id => {
      const node = ast.getNodeById(id);
      tmpCM.addSelection(node.from, node.to);
    });
    // write all the existing selection ranges
    SHARED.cm.listSelections().map(s => tmpCM.addSelection(s.anchor, s.head));
    // return all the selections
    return tmpCM.listSelections();
  }
  setSelections(ranges, primary, options, replace=true) {
    const dispatch = this.props.dispatch;
    const {ast} = dispatch((_, getState) => getState());
    let tmpCM = getTempCM();
    tmpCM.setSelections(ranges, primary, options);
    const textRanges = [], nodes = [];
    try { validateRanges(ranges, ast); }
    catch(e) { throw BlockError(e, "API Error"); }
    // process the selection ranges into an array of ranges and nodes
    tmpCM.listSelections().forEach(({anchor, head}) => {
      const c1 = minpos(anchor, head);
      const c2 = maxpos(anchor, head);
      const node = ast.getNodeAt(c1, c2);
      if(node) { nodes.push(node.id); }
      else textRanges.push({anchor: anchor, head: head});
    });
    if(textRanges.length) {
      if(replace) SHARED.cm.setSelections(textRanges, primary, options);
      else SHARED.cm.addSelection(textRanges[0].anchor, textRanges[0].head);
    }
    dispatch({ type: 'SET_SELECTIONS', selections: nodes });
  }
  extendSelections(heads, opts, to=false) {
    let tmpCM = getTempCM();
    tmpCM.setSelections(this.listSelections());
    if(to) { tmpCM.extendSelections(heads, opts); }
    else { tmpCM.extendSelection(heads[0], to, opts); }
    // if one of the ranges is invalid, setSelections will raise an error
    this.setSelections(tmpCM.listSelections(), null, opts);
  }
  replaceSelections(replacements, select=false) {
    let tmpCM = getTempCM();
    tmpCM.setSelections(this.listSelections());
    tmpCM.replaceSelections(replacements, select);
    SHARED.cm.setValue(tmpCM.getValue());
    // if one of the ranges is invalid, setSelections will raise an error
    if(select == "around") { this.setSelections(tmpCM.listSelections()); }
    if(select == "start")  { this.props.setCursor(tmpCM.listSelections().pop().head); }
    else { this.props.setCursor(tmpCM.listSelections().pop().anchor); }
  }

  handleEditorWillUnmount = ed => {
    ed.off('beforeChange', this.handleBeforeChange);
    ed.off('changes', this.handleChanges);
  }

  handleTopLevelFocus = (ed, _) => {
    const {dispatch} = this.props;
    dispatch((_, getState) => {
      const {cur} = getState();
      if (!this.mouseUsed && (cur === null)) {
        // NOTE(Oak): use setTimeout so that the CM cursor will not blink
        setTimeout(() => this.props.activateByNid(null, {allowMove: true}), 0);
        this.mouseUsed = false;
      } else if(this.mouseUsed && (cur === null)) {
        // if it was a click, get the cursor from CM
        setTimeout(() => this.props.setCursor(ed, ed.getCursor()));
        this.mouseUsed = false;
      }
    });
  }

  handleTopLevelMouseDown = () => {
    this.mouseUsed = true;
    setTimeout(() => this.mouseUsed = false, 200);
  }

  handleTopLevelKeyPress = (ed, e) => {
    const text = e.key;
    // let CM handle kbd shortcuts or whitespace insertion
    if (e.ctrlKey || e.metaKey || text.match(/\s+/)) return;
    e.preventDefault();
    const start = SHARED.cm.getCursor(true);
    const end   = SHARED.cm.getCursor(false);
    this.props.setQuarantine(start, end, text);
  }

  // called from both CM *and* Node components
  // each is responsible for passing 'this' as the environment
  // store showDialog in the environment, and pass the keyMap
  handleKeyDown = (e, env) => {
    env.showDialog = this.props.showDialog;
    env.toolbarRef = this.props.toolbarRef;
    return keyDown(e, env, this.props.keyMap);
  }

  handleTopLevelPaste = (ed, e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const start = SHARED.cm.getCursor(true);
    const end = SHARED.cm.getCursor(false);
    this.props.setQuarantine(start, end, text);
  }

  // this change was introduced during the switch from onCursor to onCursorActivity
  // if there are selections, pass null. otherwise pass the cursor
  handleTopLevelCursorActivity = (ed, _) => {
    let cur = (ed.getSelection().length > 0)? null : ed.getCursor();
    this.props.setCursor(ed, cur);
  }

  componentWillUnmount() {
    SHARED.buffer.remove();
  }

  componentDidMount() {
    const { parser, options, search } = this.props;

    // TODO: pass these with a React Context or something sensible like that.
    SHARED.parser = parser;
    SHARED.options= options;
    SHARED.search = search;
    // create a hidden buffer, for use with copy/cut/paste
    const clipboardBuffer = document.createElement('textarea');
    clipboardBuffer.ariaHidden    = true;
    clipboardBuffer.tabIndex      = -1;
    clipboardBuffer.style.opacity =  0;
    clipboardBuffer.style.height  = '1px';
    SHARED.buffer = clipboardBuffer;
    document.body.appendChild(SHARED.buffer);
    this.props.api.afterDOMUpdate(this.refreshCM());
  }

  componentDidUpdate() { this.props.api.afterDOMUpdate(this.refreshCM()); }

  // Make sure the react renderer is finished before refreshing
  refreshCM() {
    this.props.dispatch((_, getState) => {
      if(!getState().quarantine) SHARED.cm.refresh(); // don't refresh mid-quarantine
    });
  }

  render() {
    const classes = [];
    if (this.props.language) {
      classes.push(`blocks-language-${this.props.language}`);
    }
    return (
      <>
        <DragAndDropEditor
          options={this.props.cmOptions}
          className={classNames(classes)}
          value={this.props.value}
          onBeforeChange={this.props.onBeforeChange}
          onKeyPress={this.handleTopLevelKeyPress}
          onMouseDown={this.handleTopLevelMouseDown}
          onFocus={this.handleTopLevelFocus}
          onPaste={this.handleTopLevelPaste}
          onKeyDown={(_, e) => this.handleKeyDown(e, this)}
          onCursorActivity={this.handleTopLevelCursorActivity}
          editorDidMount={this.handleEditorDidMount} />
        {this.renderPortals()}
      </>
    );
  }

  renderPortals = () => {
    const incrementalRendering = this.props.options.incrementalRendering;
    let portals;
    if (SHARED.cm && this.props.ast) {
      // Render all the top-level nodes
      portals = this.props.ast.rootNodes.map(r =>
        <ToplevelBlock key={r.id} node={r} incrementalRendering={incrementalRendering} />
      );
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
  clearFocus: () => {
    //console.log('BlockEditor:671 calling SET_FOCUS with focusId null');
    return dispatch({type: 'SET_FOCUS', focusId: null});
  },
  setQuarantine: (start, end, text) => dispatch({type: 'SET_QUARANTINE', start, end, text}),
  activateByNid: (nid, options) => dispatch(activateByNid(nid, options))
});

export default connect(mapStateToProps, mapDispatchToProps)(BlockEditor);
