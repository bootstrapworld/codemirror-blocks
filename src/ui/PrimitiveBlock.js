import React, {Component} from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import {ASTNode} from '../ast';
import Renderer from '../Renderer';
import {Primitive} from '../parsers/primitives';

require('./PrimitiveBlock.less');

function onDragStart(node, text, renderer, event) {
  let el = event.target;
  while (el.parentNode && !el.parentNode.classList.contains('RenderedBlockNode')) {
    el = el.parentNode;
  }
  if (!el) {
    return;
  }
  event.stopPropagation();
  el.classList.add('blocks-dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setDragImage(el, -5, -5);
  if (node || text) {
    event.dataTransfer.setData('text/plain', node && renderer.printASTNode(node) || text);
  }
  if (node) {
    // Don't translate node.el (prevents a circular reference)
    event.dataTransfer.setData('text/json', 
      JSON.stringify(node, k => { if (k === "el") return undefined; }));
  }
}

export class RenderedBlockNode extends Component {
  static contextTypes = {
    renderer: PropTypes.instanceOf(Renderer).isRequired,
  }

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
    if (this.refs.root) {
      let el = ReactDOM.findDOMNode(this.refs.root);
      el.firstChild.draggable = true;
      el.firstChild.addEventListener(
        'dragstart',
        onDragStart.bind(null, this.props.node, this.props.text, this.context.renderer)
      );
    }
  }

  render() {
    if (this.props.node) {
      return (<span className="RenderedBlockNode" ref="root">
        {this.context.renderer.renderNodeForReact(this.props.node)}
      </span>);
    } else {
      return (
        <span className="RenderedBlockNode" ref="root">
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
