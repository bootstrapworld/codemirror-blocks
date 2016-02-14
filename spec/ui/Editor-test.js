import React from 'react';
import TestUtils from 'react-addons-test-utils';

import Editor from '../../src/ui/Editor';
import WeschemeParser from '../../src/parsers/wescheme';

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
});
