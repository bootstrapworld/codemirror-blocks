import React from 'react';
import TestUtils from 'react-dom/test-utils';

import {dragstart, drop} from '../events';
import TrashCan from 'codemirror-blocks/ui/TrashCan';

describe('The TrashCan component,', function() {
  beforeEach(function() {
    this.onDrop = jasmine.createSpy();
    this.trashCan = TestUtils.renderIntoDocument(<TrashCan onDrop={this.onDrop} />);
    this.rootEl = TestUtils.findRenderedDOMComponentWithTag(this.trashCan, 'div');
  });

  it("should update it's state on drag enter/leave/over", function() {
    TestUtils.Simulate.dragEnter(this.rootEl);
    expect(this.trashCan.state.isOverTrashCan).toBe(true);

    TestUtils.Simulate.dragLeave(this.rootEl);
    expect(this.trashCan.state.isOverTrashCan).toBe(false);

    TestUtils.Simulate.dragOver(this.rootEl);
  });

  it("should call the onDrop method in it's props when a node is dropped onto it", function() {
    let dragEvent = dragstart({"text/id": "some-node-id"});
    TestUtils.Simulate.drop(this.rootEl, drop(dragEvent.dataTransfer));
    expect(this.onDrop).toHaveBeenCalledWith('some-node-id');
  });
});
