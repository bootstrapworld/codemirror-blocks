import React from 'react';
import ReactDOM from 'react-dom';
import {renderHTMLString} from '../render';

require('./PrimitiveBlock.less');

function onDragStart(node, text, event) {
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
    event.dataTransfer.setData('text/plain', node && node.toString() || text);
  }
  if (node) {
    event.dataTransfer.setData('text/json', JSON.stringify(node));
  }
}

export var RenderedBlockNode = React.createClass({
  displayName: 'RenderedBlockNode',
  componentDidMount() {
    if (this.refs.root) {
      let el = ReactDOM.findDOMNode(this.refs.root);
      el.firstChild.draggable = true;
      el.firstChild.addEventListener(
        'dragstart',
        onDragStart.bind(null, this.props.node, this.props.text)
      );
    }
  },

  render() {
    if (this.props.node) {
      let html = {__html:renderHTMLString(this.props.node)};
      return <span className="RenderedBlockNode" dangerouslySetInnerHTML={html} ref="root" />;
    } else {
      return (
        <span className="RenderedBlockNode" ref="root">
          <span>{this.props.text}</span>
        </span>
      );
    }
  }
});

export default React.createClass({
  displayName: 'PrimitiveBlock',

  render() {
    const {primitive} = this.props;
    if (!primitive) {
      return <div/>;
    }

    this.astNode = primitive.getASTNode();
    return <RenderedBlockNode node={this.astNode} text={primitive.name} />;
  }
});
