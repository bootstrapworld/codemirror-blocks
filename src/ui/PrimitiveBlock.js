import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {ASTNode} from '../ast';
import Renderer from '../Renderer';
import {Primitive} from '../parsers/primitives';
import {RendererContext} from './Context';
import './PrimitiveBlock.less';

export class BaseRenderedBlockNode extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTNode),
    text: PropTypes.string,
    renderer: PropTypes.instanceOf(Renderer).isRequired,
  }

  static defaultProps = {
    node: null,
    text: '',
  }

/*
  * TODO(Emmanuel): almost certainly dead code, since this was added to support
  * dragging functionality _before_ switching over to react-dnd

  // when the DOM for a rendered block has completed, we have some cleanup to do:
  // the normal renderer assumes that all blocks are treeitems, with tabIndex=-1
  componentDidMount() {
    if (this.root && this.root.firstChild && this.root.firstChild.setAttribute) {
      const el = this.root;
      // el.firstChild.draggable = true;
      // el.firstChild.addEventListener('dragstart', this.onDragStart);
      el.firstChild.setAttribute('role', 'listitem');
      el.firstChild.tabIndex="0";
    }
  }
*/

  render() {
    const node = this.props.node ? this.props.renderer.renderNodeForReact(this.props.node, null, true)
    : this.props.text;
    return (
      <span className="RenderedBlockNode" ref={root => this.root = root}>
        {node}
      </span>
    );
  }
}

export class RenderedBlockNode extends Component {
  render() {
    return (
      <RendererContext.Consumer>
        {renderer => <BaseRenderedBlockNode renderer={renderer} {...this.props} />}
      </RendererContext.Consumer>
    );
  }
}

export default class PrimitiveBlock extends Component {
  static propTypes = {
    primitive: PropTypes.instanceOf(Primitive),
  }

  static defaultProps = {
    primitive: null,
  }

  render() {
    if (!this.props.primitive) {
      return <div/>;
    }

    this.astNode = this.props.primitive.getASTNode();
    this.astNode.inToolbar = true;
    return (
      <RenderedBlockNode
        node={this.astNode}
        text={this.props.primitive.name}
      />
    );
  }
}
