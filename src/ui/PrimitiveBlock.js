import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {ASTNode} from '../ast';
import {Primitive} from '../parsers/primitives';
import {RendererContext} from './Context';
import './PrimitiveBlock.less';

export class RenderedBlockNode extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTNode),
    text: PropTypes.string,
  }

  static defaultProps = {
    node: null,
    text: '',
    renderer: null,
  }

  componentDidMount() {
    if (this.root) {
      let el = this.root;
      el.firstChild.draggable = true;
      el.firstChild.addEventListener(
        'dragstart',
        this.onDragStart.bind(this)
      );
    }
  }

  onDragStart(event) {
    let node = this.props.node;
    let text = this.props.text;

    // Find the block (it might just be a text Primitive, so there might not be 
    // an assocated AST node):
    let el = node ? node.el : event.target;
    if (!node) {
      while (el.parentNode && !el.parentNode.classList.contains('RenderedBlockNode')) {
        el = el.parentNode;
      }
      if (!el) {
        return;
      }
    }

    event.stopPropagation();
    el.classList.add('blocks-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setDragImage(el, -5, -5);

    // Add dataTransfer information:
    if (node) {
      event.dataTransfer.setData('text/plain', this.context.renderer.printASTNode(node));
      event.dataTransfer.setData('text/id', node.id);
    } else if (text) {
      event.dataTransfer.setData('text/plain', text);
    }
  }

  render() {
    if (this.props.node) {
      return (
        <span className="RenderedBlockNode" ref={root => this.root = root}>
          <RendererContext.Consumer>
            {renderer => renderer.renderNodeForReact(this.props.node)}
          </RendererContext.Consumer>
        </span>
      );
    } else {
      return (
        <span className="RenderedBlockNode" ref={root => this.root = root}>
          <span>{this.props.text}</span>
        </span>
      );
    }
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
