import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-addons-test-utils';
import stubContext from 'react-stub-context';

import {Literal} from 'codemirror-blocks/ast';
import Renderer from 'codemirror-blocks/Renderer';
import {dragstart} from '../events';
import {Primitive} from 'codemirror-blocks/parsers/primitives';
import _PrimitiveBlock from 'codemirror-blocks/ui/PrimitiveBlock';
import {RenderedBlockNode} from 'codemirror-blocks/ui/PrimitiveBlock';

describe('The PrimitiveBlock component,', function() {
  var PrimitiveBlock;
  beforeEach(function() {
    PrimitiveBlock = stubContext(_PrimitiveBlock, {renderer: new Renderer()});
  });

  it('should render a draggable node for a primitive', function() {
    let primitive = new Primitive(null, 'some-primitive');
    let primitiveBlock = TestUtils.renderIntoDocument(<PrimitiveBlock primitive={primitive}/>);
    let renderedBlockNode = TestUtils.findRenderedComponentWithType(
      primitiveBlock, RenderedBlockNode);
    let el = ReactDOM.findDOMNode(renderedBlockNode.refs.root);

    let dragEvent = dragstart();
    el.firstChild.dispatchEvent(dragEvent);
    expect(dragEvent.dataTransfer.getData('text/plain')).toBe('some-primitive');
  });

  it('should render a draggable node based on the ast node provided by the primitive', function() {
    let primitive = new Primitive(null, 'some-primitive');
    primitive.getASTNode = () => new Literal(
      {line: 0, ch: 0},
      {line: 0, ch: 0},
      'some-primitive',
      'symbol'
    );
    let primitiveBlock = TestUtils.renderIntoDocument(<PrimitiveBlock primitive={primitive}/>);
    let renderedBlockNode = TestUtils.findRenderedComponentWithType(
      primitiveBlock, RenderedBlockNode);
    let el = ReactDOM.findDOMNode(renderedBlockNode.refs.root);
    let dragEvent = dragstart();
    el.firstChild.dispatchEvent(dragEvent);
    expect(dragEvent.dataTransfer.getData('text/plain')).toBe('some-primitive');
  });

  it('should render an empty div if no primitive is provided', function() {
    TestUtils.renderIntoDocument(<PrimitiveBlock primitive={null}/>);
  });
});
