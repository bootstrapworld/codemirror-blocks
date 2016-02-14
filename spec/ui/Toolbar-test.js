import React from 'react';
import TestUtils from 'react-addons-test-utils';

import {Primitive, PrimitiveGroup} from '../../src/parsers/primitives';
import Toolbar from '../../src/ui/Toolbar';

describe('The Toolbar component,', function() {
  beforeEach(function() {
    this.primitives = PrimitiveGroup.fromConfig(
      null,
      {
        name:'root',
        primitives:['foo','bar']
      }
    );
    this.toolbar = TestUtils.renderIntoDocument(<Toolbar primitives={this.primitives}/>);
    this.searchInput = TestUtils.findRenderedDOMComponentWithTag(this.toolbar, 'input');
  });

  it('should render without errors when no primitives are given', function() {
    TestUtils.renderIntoDocument(<Toolbar/>);
  });

  it('should render a search box', function() {
    expect(this.searchInput.value).toBe('');
    this.searchInput.value = 'test';
    TestUtils.Simulate.change(this.searchInput);
    expect(this.toolbar.state.search).toBe('test');
  });

  it('should clear the search box when the remove icon is clicked', function() {
    this.toolbar.setState({search:'foo'});
    let removeIcon = TestUtils.findRenderedDOMComponentWithClass(
      this.toolbar,
      'glyphicon-remove'
    );
    TestUtils.Simulate.click(removeIcon);
    expect(this.toolbar.state.search).toBe('');
  });

  it('should toggle the selection state of a primitive when clicked', function() {
    expect(this.toolbar.state.selectedPrimitive).toBe(null);
    let primitive = Primitive.fromConfig(null, {name:'foo'});
    this.toolbar.selectPrimitive(primitive);
    expect(this.toolbar.state.selectedPrimitive).toBe(primitive);
    this.toolbar.selectPrimitive(primitive);
    expect(this.toolbar.state.selectedPrimitive).toBe(null);
  });

  it('should not clear the search box when escape is pressed', function() {
    this.toolbar.setState({search:'foo'});
    TestUtils.Simulate.keyDown(this.searchInput, {key:'Escape'});
    expect(this.searchInput.value).toBe('foo');
  });
});
