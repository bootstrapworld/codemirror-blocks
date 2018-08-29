import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import {UnControlled as CodeMirror} from 'react-codemirror2';
import CodeMirrorBlocks from '../blocks';
import PropTypes from 'prop-types';
import './Editor.less';
import {poscmp} from '../utils';
import {connect, Provider} from 'react-redux';
import {OptionsContext} from './Context';
import store from '../store';
import global from '../global';
import {DragDropContext} from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';

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


class ToplevelBlock extends Component {
  constructor(props) {
    super(props);
    this.container = document.createElement('span');
    this.container.className = 'react-container';
  }

  static propTypes = {
    node: PropTypes.object.isRequired,
    cm: PropTypes.object.isRequired,
    quarantine: PropTypes.bool // this probably shouldn't be here
  }

  static defaultProps = {
    quarantine: false
  }

  render() {
    const {node, quarantine} = this.props;

    // TODO: is the if expression really needed? Can't we always delete all
    // and mark everything again? It seems cheap enough.

    // find a marker that (a) has an old ASTNode and (b) start in exactly the same place as the new ASTNode
    const markers = global.cm
          .findMarksAt(node.from)
          .filter(m => m.node && !poscmp(m.node.from, node.from));
    if (markers.length > 0) {
      // there will never be more than one
      const marker = markers[0];
      // if we're not quarantining, and it starts at the exact same place..
      if (!quarantine) marker.clear();
    }
    global.cm.markText(node.from, node.to, {replacedWith: this.container, node: node});

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

@DragDropContext(HTML5Backend)
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

  static defaultProps = {
    options: {},
    cmOptions: {},
  }

  handleEditorDidMount = ed => {
    global.cm = ed;
    const ast = this.props.parser.parse(ed.getValue());
    this.props.setAST(ast);
    this.blocks = new CodeMirrorBlocks(
      ed,
      this.props.language,
      {suppress: true, ...this.props.options}
    );
  }

  componentDidMount() {
    global.parser = this.props.parser;
    global.options = this.props.options;
    setTimeout(() => {
      this.blocks.setBlockMode(true);
      // hrm, the code mirror instance is only available after
      // this gets rendered the first time, but we need
      // the codemirror instance in order to render...
      // so render again!
      this.forceUpdate();
    }, 0);
  }

  render() {
    const {parser, options} = this.props;
    return (
      <OptionsContext.Provider value={{parser, options}}>
        <div className="Editor blocks">
          <div className="codemirror-pane">
            <CodeMirror options={this.props.cmOptions}
                        value={this.props.value}
                        editorDidMount={this.handleEditorDidMount} />
          </div>
          {this.renderPortals()}
          <div>
            {global.cm && global.cm.getValue()}
          </div>
        </div>
      </OptionsContext.Provider>
    );
  }

  renderPortals = () => {
    if (global.cm && this.props.ast) {
      for (const m of global.cm.getAllMarks()) {
        m.clear();
      }
      return this.props.ast.rootNodes.map(
        r => (<ToplevelBlock key={r.id} node={r} cm={global.cm} />)
      );
    }
    return null;
  }
}

const mapStateToProps = ({ast}) => ({ast});
const mapDispatchToProps = dispatch => ({
  setAST: ast => dispatch({type: 'SET_AST', ast}),
});

const EditorWrapper = connect(mapStateToProps, mapDispatchToProps)(Editor);

export default props => (
  <Provider store={store}>
    <EditorWrapper {...props} />
  </Provider>
);
