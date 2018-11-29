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

  // onDragStart = event => {
  //   let node = this.props.node;
  //   let text = this.props.text;

  //   // Find the block (it might just be a text Primitive, so there might not be
  //   // an assocated AST node):
  //   let el = node ? node.el : event.target;
  //   if (!node) {
  //     while (el.parentNode && !el.parentNode.classList.contains('RenderedBlockNode')) {
  //       el = el.parentNode;
  //     }
  //     if (!el) {
  //       return;
  //     }
  //   }

  //   event.stopPropagation();
  //   el.classList.add('blocks-dragging');
  //   event.dataTransfer.effectAllowed = 'move';
  //   event.dataTransfer.setDragImage(el, -5, -5);

  //   // Add dataTransfer information:
  //   if (node) {
  //     event.dataTransfer.setData('text/plain', this.props.renderer.printASTNode(node));
  //     event.dataTransfer.setData('text/id', node.id);
  //   } else if (text) {
  //     event.dataTransfer.setData('text/plain', text);
  //   }
  // }

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
    return (
      <RenderedBlockNode
        node={this.astNode}
        text={this.props.primitive.name}
      />
    );
  }
}
