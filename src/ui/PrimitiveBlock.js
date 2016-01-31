import React from 'react';
import ReactDOM from 'react-dom';
import {renderHTMLString} from '../render';

require('./PrimitiveBlock.less');

function onDragStart(node, event) {
  let el = event.target;
  while (el.parentNode && !el.parentNode.classList.contains('PrimitiveBlock')) {
    el = el.parentNode;
  }
  if (!el) {
    return;
  }
  event.stopPropagation();
  el.classList.add('blocks-dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setDragImage(el, -5, -5);
  event.dataTransfer.setData('text/plain', node.toString());
  event.dataTransfer.setData('text/json', JSON.stringify(node));
}

export default React.createClass({
  displayName: 'PrimitiveBlock',

  componentDidUpdate() {
    if (this.refs.root && this.astNode) {
      let el = ReactDOM.findDOMNode(this.refs.root);
      el.firstChild.draggable = true;
      el.firstChild.addEventListener('dragstart', onDragStart.bind(null, this.astNode));
    }
  },

  render() {
    const {primitive} = this.props;
    if (!primitive) {
      return <div/>;
    }

    this.astNode = primitive.getASTNode();
    if (this.astNode) {
      let html = {__html:renderHTMLString(this.astNode)};
      return (
        <div className="PrimitiveBlock"
             ref="root"
             dangerouslySetInnerHTML={html}>
        </div>
      );
    }

    return <div/>;
  }
});
