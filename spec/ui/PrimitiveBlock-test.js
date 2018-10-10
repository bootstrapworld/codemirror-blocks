import React from 'react';
import TestUtils from 'react-dom/test-utils';
import {Literal} from 'codemirror-blocks/nodes';
import Renderer from 'codemirror-blocks/Renderer';
import {dragstart} from '../events';
import {Primitive} from 'codemirror-blocks/parsers/primitives';
import {RendererContext} from 'codemirror-blocks/ui/Context';
import _PrimitiveBlock, {BaseRenderedBlockNode} from 'codemirror-blocks/ui/PrimitiveBlock';

const renderer = new Renderer();

class PrimitiveBlock extends React.Component {
  render() {
    return (
      <RendererContext.Provider value={renderer}>
        <_PrimitiveBlock {...this.props} />
      </RendererContext.Provider>
    );
  }
}

describe('The PrimitiveBlock component,', function() {
  it('should render a draggable node for a primitive', function() {
    const primitive = new Primitive(null, 'some-primitive');
    const primitiveBlock = TestUtils.renderIntoDocument(<PrimitiveBlock primitive={primitive}/>);
    const renderedBlockNode = TestUtils.findRenderedComponentWithType(
      primitiveBlock, BaseRenderedBlockNode
    );
    const el = renderedBlockNode.root;

    const dragEvent = dragstart();
    el.firstChild.dispatchEvent(dragEvent);
    expect(dragEvent.dataTransfer.getData('text/plain')).toBe('some-primitive');
  });

  it('should render a draggable node based on the ast node provided by the primitive', function() {
    const primitive = new Primitive(null, 'some-primitive');
    primitive.getASTNode = () => new Literal(
      {line: 0, ch: 0},
      {line: 0, ch: 0},
      'some-primitive',
      'symbol'
    );
    const primitiveBlock = TestUtils.renderIntoDocument(<PrimitiveBlock primitive={primitive}/>);
    const renderedBlockNode = TestUtils.findRenderedComponentWithType(
      primitiveBlock, BaseRenderedBlockNode);
    const el = renderedBlockNode.root;
    const dragEvent = dragstart();
    el.firstChild.dispatchEvent(dragEvent);
    expect(dragEvent.dataTransfer.getData('text/plain')).toBe('some-primitive');
  });

  it('should render an empty div if no primitive is provided', function() {
    TestUtils.renderIntoDocument(<PrimitiveBlock primitive={null}/>);
  });
});
