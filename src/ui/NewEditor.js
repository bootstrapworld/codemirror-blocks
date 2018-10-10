import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import {UnControlled as CodeMirror} from 'react-codemirror2';
import classNames from 'classnames';
import CodeMirrorBlocks from '../blocks';
import PropTypes from 'prop-types';
import './Editor.less';
import {connect, Provider} from 'react-redux';
import {store} from '../store';
import global from '../global';
import patch from '../ast-patch';
import CMBContext from '../components/Context';
import NodeEditable from '../components/NodeEditable';
import {focusSelf} from '../actions';
// import {poscmp} from '../utils';

import Expression         from '../components/Expression';
import IfExpression       from '../components/IfExpression';
import LambdaExpression   from '../components/LambdaExpression';
import CondExpression     from '../components/CondExpression';
import CondClause         from '../components/CondClause';
import Unknown            from '../components/Unknown';
import Literal            from '../components/Literal';
import Blank              from '../components/Blank';
import Comment            from '../components/Comment';
import IdentifierList     from '../components/IdentifierList';
import StructDefinition   from '../components/StructDef';
import VariableDefinition from '../components/VariableDef';
import FunctionDefinition from '../components/FunctionDef';
import Sequence           from '../components/Sequence';

const nodeRenderers = {
  unknown: Unknown,
  expression: Expression,
  functionDefinition: FunctionDefinition,
  lambdaExpression: LambdaExpression,
  variableDefinition: VariableDefinition,
  identifierList : IdentifierList,
  ifExpression: IfExpression,
  condExpression: CondExpression,
  condClause: CondClause,
  structDefinition: StructDefinition,
  literal: Literal,
  comment: Comment,
  sequence: Sequence,
  blank: Blank,
};

const lockedTypes = [];
const helpers = {renderNodeForReact};

function renderNodeForReact(node, key) {
  const Renderer = nodeRenderers[node.type];
  if (Renderer && Renderer.prototype instanceof Component) {
    return (
      <Renderer
        node        = {node}
        helpers     = {helpers}
        key         = {key}
        lockedTypes = {lockedTypes} />
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

    global.cm.markText(from, to, {replacedWith: this.container});

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
      tabIndex          : "-1",
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
                    initialSelection='end'
                    extraClasses={['blocks-node', 'blocks-white-space']}
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

@CMBContext
class Editor extends Component {
  static propTypes = {
    options: PropTypes.object,
    cmOptions: PropTypes.object,
    language: PropTypes.string.isRequired,
    parser: PropTypes.object.isRequired,
    setAST: PropTypes.func.isRequired,

    // this is actually required, but it's buggy
    // see https://github.com/facebook/react/issues/3163
    ast: PropTypes.object,
  }

  constructor(props) {
    super(props);
    this.mouseUsed = false;
  }

  static defaultProps = {
    options: {},
    cmOptions: {},
  }

  handleDragOver = (ed, e) => {
    if (!e.target.classList.contains('CodeMirror-line')) {
      e.preventDefault();
    }
  }

  handleKeyDown = (ed, e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      // TODO(Oak)
    }
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

  handleEditorDidMount = ed => {
    const wrapper = ed.getWrapperElement();
    wrapper.setAttribute('role', 'tree');
    wrapper.setAttribute('aria-label', 'Block Editor');
    const scroller = ed.getScrollerElement();
    scroller.setAttribute('role', 'presentation');

    ed.on('changes', (cm, changes) => {
      if (changes.some(change => change.origin === 'undo')) {
        const newAST = global.parser.parse(cm.getValue());
        const {ast: oldAST} = store.getState();
        if (oldAST.hash !== newAST.hash) {
          store.dispatch({type: 'SET_AST', ast: patch(oldAST, newAST)});
        }
      }
    });

    global.cm = ed;
    const ast = this.props.parser.parse(ed.getValue());
    this.props.setAST(ast);
  }

  handleFocus = (ed, e) => {
    if (!this.mouseUsed) {
      // NOTE(Oak): use setTimeout so that the CM cursor will not blink
      setTimeout(() => this.props.focusSelf(), 10);
    }
  }

  handleMouseDown = ed => {
    this.mouseUsed = true;
    setTimeout(() => this.mouseUsed = false, 200);
  }

  componentDidMount() {
    global.parser = this.props.parser;
    global.options = this.props.options;
    global.buffer = document.createElement('textarea');

    // don't make it transparent so that we can debug easily for now
    // global.buffer.style.opacity = 0;
    // global.buffer.style.height = '1px';
    document.body.appendChild(global.buffer);
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
                      onDragOver={this.handleDragOver}
                      onKeyPress={this.handleKeyPress}
                      onKeyDown={this.handleKeyDown}
                      onMouseDown={this.handleMouseDown}
                      onFocus={this.handleFocus}
                      onPaste={this.handlePaste}
                      cursor={this.props.cur}
                      onCursor={this.props.setCursor}
                      editorDidMount={this.handleEditorDidMount} />
        </div>
        {this.renderPortals()}
        <div>
          {global.cm && global.cm.getValue()}
        </div>
      </div>
    );
  }

  renderPortals = () => {
    const portals = [];
    if (global.cm && this.props.ast) {
      // NOTE(Oak): we need to clear all markers up front to prevent
      // overlapping the marker issue
      for (const marker of global.cm.getAllMarks()) {
        marker.clear();
      }
      for (const r of this.props.ast.rootNodes) {
        portals.push(<ToplevelBlock key={r.id} node={r} />);
      }
      if (this.props.hasQuarantine) portals.push(<ToplevelBlockEditable key="-1" />);
    }
    return portals;
  }
}

const mapStateToProps = ({ast, cur, quarantine}) => ({
  ast, cur, hasQuarantine : !!quarantine
});
const mapDispatchToProps = dispatch => ({
  setAST: ast => dispatch({type: 'SET_AST', ast}),
  setCursor: (_, cur) => dispatch({type: 'SET_CURSOR', cur}),
  focusSelf: () => dispatch(focusSelf()),
  setQuarantine: (pos, text) => dispatch({type: 'SET_QUARANTINE', pos, text}),
});

const EditorWrapper = connect(mapStateToProps, mapDispatchToProps)(Editor);

export default props => (
  <Provider store={store}>
    <EditorWrapper {...props} />
  </Provider>
);
