import React from 'react';
import TestUtils from 'react-addons-test-utils';

import Editor from '../../src/ui/Editor';
import TrashCan from '../../src/ui/TrashCan';
import WeschemeParser from '../../src/parsers/wescheme';
import {EVENT_DRAG_START, EVENT_DRAG_END} from '../../src/blocks';

describe('The Editor component,', function() {
  beforeEach(function() {
    this.parser = new WeschemeParser();
    this.editor = TestUtils.renderIntoDocument(<Editor parser={this.parser} />);
  });

  it("should create a CodeMirrorBlocks instance for you", function() {
    let blocks = this.editor.getCodeMirrorBlocks();
    expect(blocks.parser).toBe(this.parser);
  });

  it("should toggle block state when the toggle button is clicked", function() {
    let blocks = this.editor.getCodeMirrorBlocks();
    spyOn(blocks, 'toggleBlockMode');
    let toggle = TestUtils.findRenderedDOMComponentWithClass(this.editor, 'blocks-toggle-btn');
    TestUtils.Simulate.click(toggle);
    expect(blocks.toggleBlockMode).toHaveBeenCalled();
  });

  it("should show the trash can when a drag start event is emitted", function() {
    this.editor.getCodeMirrorBlocks().emit(EVENT_DRAG_START);
    expect(this.editor.state.showTrashCan).toBe(true);
  });

  it("should hide the trash can when a drag end event is emitted", function() {
    this.editor.getCodeMirrorBlocks().emit(EVENT_DRAG_END);
    expect(this.editor.state.showTrashCan).toBe(false);
  });

  it("should delete the node that gets dragged on the trash can and hide the trash can", function() {
    spyOn(this.editor.getCodeMirrorBlocks(), 'deleteNodeWithId');
    let trashCan = TestUtils.findRenderedComponentWithType(this.editor, TrashCan);
    trashCan.props.onDrop('some-node-id');
    expect(this.editor.state.showTrashCan).toBe(false);
    expect(this.editor.getCodeMirrorBlocks().deleteNodeWithId)
      .toHaveBeenCalledWith('some-node-id');
  });
});
