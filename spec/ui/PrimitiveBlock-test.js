import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-addons-test-utils';

import {Literal} from '../../src/ast';
import {dragstart} from '../events';
import {Primitive} from '../../src/parsers/primitives';
import PrimitiveBlock from '../../src/ui/PrimitiveBlock';
import {RenderedBlockNode} from '../../src/ui/PrimitiveBlock';

describe('The PrimitiveBlock component,', function() {
  beforeEach(function() {
    this.primitiveBlock = TestUtils.renderIntoDocument(<PrimitiveBlock />);
  });

  it('should render a draggable node for a primitive', function() {
    let primitive = new Primitive({}, 'some-primitive');
    let primitiveBlock = TestUtils.renderIntoDocument(<PrimitiveBlock primitive={primitive}/>);
    let renderedBlockNode = TestUtils.findRenderedComponentWithType(
      primitiveBlock, RenderedBlockNode);
    let el = ReactDOM.findDOMNode(renderedBlockNode.refs.root);

    let dragEvent = dragstart();
    el.firstChild.dispatchEvent(dragEvent);
    expect(dragEvent.dataTransfer.getData('text/plain')).toBe('some-primitive');
  });

  it('should render a draggable node based on the ast node provided by the primitive', function() {
    let primitive = new Primitive({}, 'some-primitive');
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
