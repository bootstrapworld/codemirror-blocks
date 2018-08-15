import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import {UnControlled as CodeMirror} from 'react-codemirror2';
import CodeMirrorBlocks from '../blocks';
import PropTypes from 'prop-types';
import './Editor.less';
import {poscmp, assert} from '../utils';

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

function renderNodeForReact(node, key) {
  const Renderer = nodeRenderers[node.type];
  if (Renderer && Renderer.prototype instanceof Component) {
    return (
      <Renderer
        node        = {node}
        helpers     = {{renderNodeForReact}}
        key         = {key}
        lockedTypes = {[]} />
    );
  } else {
    throw new Error("Don't know how to render node of type: "+node.type);
  }
}

function* getIteratorFromAST(ast) {
  for (const root of ast.rootNodes) {
    for (const node of root) {
      yield node;
    }
  }
}

function getContent(node, cm) {
  return cm.getRange(node.from, node.to);
}

/**
 * The function consumes an oldAST, newAST and changes from CodeMirror
 * and transfer existing ids in oldAST to newAST.
 *
 * The algorithm is inspired by the merge phase of mergesort.
 * We first create streams of oldAST and newAST's preorder traversal,
 * and a stream of changes in increasing order of srcloc.
 * This gives us three streams with three pointers pointing to the
 * current position on each stream.
 *
 * For each iteration, we will advance at least one of the pointers
 * forward.
 */
function reconcile(oldAST, newAST, changes, cm) {
  /*
   * By the well-formedness of changes, they won't overlap,
   * so sorting by starting or ending point will be the same.
   *
   * Don't forget that appending a new node at the end of the file
   * won't fall into these two cases since there are no nodes following
   * the added node. So we need to walk all changes and cleanup
   * the left element (which should have at most 1).
   *
   * NOTE: initially changes are not ordered by pos, but by
   * event sequence to result in a new text
   */

  const orderedChanges = changes.slice(0);
  orderedChanges.sort((a, b) => poscmp(a.from, b.from));
  const oldIter = getIteratorFromAST(oldAST);
  const newIter = getIteratorFromAST(newAST);
  const changeIter = changes[Symbol.iterator]();

  let oldPtr = oldIter.next();
  let newPtr = newIter.next();
  let changePtr = changeIter.next();
  let buffer = '';

  while (!oldPtr.done && !newPtr.done) {
    if (buffer !== '') {
      /*
       * CASE 0: The buffer is not empty, so there was an addition
       * to the new AST that we need to skip over
       */
      const newNodeString = getContent(newPtr.value, cm);
      const index = buffer.indexOf(newNodeString);
      if (index !== -1) {
        // if there's really an addition

        // advance the buffer
        buffer = buffer.substring(index + newNodeString.length);
        // advance the newPtr to skip over the addition
        newPtr = advancePtr(newPtr);
        continue;
      }
      // here, we find that there's no addition after all
      // (or there was an addition, but it was out of scope already)
      // so now we will scan for more
    }

    if (!changePtr.done) {
      const {from: changeFrom, to: changeTo, text} = changePtr.value;
      const {from: oldFrom, to: oldTo} = oldPtr.value;

      if (poscmp(changeFrom, oldFrom) == 0 &&
          poscmp(changeTo, oldTo) == 0) {
        /*
         * CASE 1: the node is completely replaced by something else
         *
         * For example:
         *
         * >x< y ==> y         | newNodeString = "y",   buff = ""
         * >x< y ==> abc y     | newNodeString = "abc", buff = "abc"
         * >x< y ==> abc def y | newNodeString = "abc", buff = "abc def"
         *
         * Edge case:
         * >x< y ==> abc) (d y | newNodeString = "abc", buff = "abc) (d"
         *
         * If text starts with newNodeString, then newPtr.value is an
         * added node!
         */

        // skip over the entire node for oldPtr
        oldPtr = advancePtr(oldPtr);
        changePtr = changeIter.next();

        // we now possibly have text. Let CASE 0 deal with it
        // in the next iteration
        buffer = text;
        continue;
      }

      if (poscmp(changeFrom, oldFrom) <= 0) {
        /*
         * CASE 2: there was an addition right before oldPtr
         */
        assert(poscmp(changeFrom, changeTo) === 0);

        // NOTE: we don't skip over oldPtr, since we have an addition
        // before oldPtr

        changePtr = changeIter.next();

        // we now possibly have text. Let CASE 0 deal with it
        // in the next iteration
        buffer = text;
        continue;
      }
    }

    /*
     * CASE 3: matched
     */

    console.log('assign', oldPtr.value);
    newPtr.value.id = oldPtr.value.id;
    // TODO: what else do we need to change? nodeIdMap?
    newPtr = newIter.next();
    oldPtr = oldIter.next();
  }
  return newAST;
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
    const {cm, node, quarantine} = this.props;
    // find a marker that (a) has an old ASTNode and (b) start in exactly the same place as the new ASTNode
    const markers = cm
          .findMarksAt(node.from)
          .filter(m => m.node && !poscmp(m.node.from, node.from));
    if (markers.length > 0) {
      // there will never be more than one
      const marker = markers[0];
      // if we're not quarantining, and it starts at the exact same place..
      if (!quarantine) marker.clear();
    }
    cm.markText(
      node.from,
      node.to,
      {replacedWith: this.container, node: node}
    );

    // REVISIT: make comments disappear by adding an empty span
    if (node.options.comment) {
      cm.markText(
        node.options.comment.from,
        node.options.comment.to,
        {replacedWith: document.createElement('span')}
      );
    }

    const renderedNode = renderNodeForReact(node);
    return ReactDOM.createPortal(
      renderedNode,
      this.container
    );

  }
}

export default class Editor extends Component {
  constructor(props) {
    super(props);

    this.state = {
      ast: null
    };

    this.cm = null;
  }
  static propTypes = {
    options: PropTypes.object,
    cmOptions: PropTypes.object,
    language: PropTypes.string.isRequired,
    parser: PropTypes.object.isRequired,
  }

  static defaultProps = {
    options: {},
    cmOptions: {},
  }

  handleChanges = (editor, changes) => {
    const newAST = this.props.parser.parse(editor.getValue());
    const reconciled = reconcile(this.state.ast, newAST, changes, editor);
    this.setState({ast: reconciled});
  }

  componentDidMount() {
    this.cm.on('changes', this.handleChanges);
    const ast = this.props.parser.parse(this.cm.getValue());
    this.setState({ast});
    this.blocks = new CodeMirrorBlocks(
      this.cm,
      this.props.language,
      {suppress: true, ...this.props.options}
    );
    setTimeout(() => {
      this.blocks.setBlockMode(true);
      // hrm, the code mirror instance is only available after
      // this gets rendered the first time, but we need
      // the codemirror instance in order to render...
      // so render again!
      this.forceUpdate();
    }, 0);
  }

  componentWillUnmount() {
    this.cm.off('changes', this.handleChanges);
  }

  render() {
    return (
      <div className="Editor blocks">
        <div className="codemirror-pane">
          <CodeMirror options={this.props.cmOptions}
                      value={this.props.value}
                      editorDidMount={ed => this.cm = ed} />
        </div>
        {
          this.cm && this.state.ast && (
            this.renderPortals()
          )
        }
      </div>
    );
  }

  renderPortals = () => {
    for (const m of this.cm.getAllMarks()) {
      m.clear();
    }
    return this.state.ast.rootNodes.map(
      r => (<ToplevelBlock node={r} cm={this.cm} />)
    );
  }
}
