/*eslint no-unused-vars: 0*/

import CodeMirrorBlocks from 'codemirror-blocks/blocks';
import CodeMirror from 'codemirror';
import ExampleParser from 'codemirror-blocks/languages/example/ExampleParser';
import {
  click,
  blur,
  keydown,
} from './events';
import {
  DOWN,
  DELETE,
  SPACE,
  RIGHTBRACKET,
} from 'codemirror-blocks/keycode';

// ms delay to let the DOM catch up before testing
const DELAY = 750;

describe('The CodeMirrorBlocks Class', function() {
  beforeEach(function() {
    const fixture = `
      <div id="root">
        <textarea id="code"></textarea>
        <div id="toolbar"></div>
      </div>`;
    document.body.insertAdjacentHTML('afterbegin', fixture);
    this.cm = CodeMirror.fromTextArea(document.getElementById("code"));
    this.parser = new ExampleParser();
    this.willInsertNode = (cm, sourceNodeText, sourceNode, destination) => {
      let line = cm.getLine(destination.line);
      let prev = line[destination.ch - 1] || '\n';
      let next = line[destination.ch] || '\n';
      sourceNodeText = sourceNodeText.trim();
      if (!/\s|[([{]/.test(prev)) {
        sourceNodeText = ' ' + sourceNodeText;
      }
      if (!/\s|[)]}]/.test(next)) {
        sourceNodeText += ' ';
      }
      return sourceNodeText;
    };

    this.didInsertNode = function() {};
    this.blocks = new CodeMirrorBlocks(
      this.cm,
      this.parser,
      {
        willInsertNode: this.willInsertNode,
        didInsertNode: this.didInsertNode,
        toolbar: document.getElementById('toolbar')
      }
    );
    spyOn(this.blocks, 'insertionQuarantine').and.callThrough();
    spyOn(this.blocks, 'handleChange').and.callThrough();
    spyOn(this.cm,     'replaceRange').and.callThrough();
  });

  afterEach(function() {
    document.body.removeChild(document.getElementById("root"));
  });
  
  describe('focusing,', function() {
    beforeEach(function() {
      this.cm.setValue('(+ 1 2 3)');
      this.blocks.setBlockMode(true);
      this.expression = this.blocks.ast.rootNodes[0];
      this.func = this.expression.func;
      this.literal1 = this.expression.args[0];
      this.literal2 = this.expression.args[1];
      this.literal3 = this.expression.args[2];
    });
  
    it('deleting the last node should shift focus to the next-to-last', function(done) {
      this.literal3.el.dispatchEvent(click());
      expect(document.activeElement).toBe(this.literal3.el);
      this.literal3.el.dispatchEvent(keydown(SPACE));
      this.cm.getWrapperElement().dispatchEvent(keydown(DELETE));
      setTimeout(() => {
        expect(this.cm.getValue()).toBe('(+ 1 2 )');
        expect(this.blocks.focusPath).toBe("0,2");
        done();  
      }, DELAY);
    });

    it('deleting the nth node should shift focus to n+1', function(done) {
      this.literal2.el.dispatchEvent(click());
      expect(document.activeElement).toBe(this.literal2.el);
      this.literal2.el.dispatchEvent(keydown(SPACE));
      this.cm.getWrapperElement().dispatchEvent(keydown(DELETE));
      setTimeout(() => {
        expect(this.cm.getValue()).toBe('(+ 1  3)');
        expect(this.blocks.focusPath).toBe("0,2");
        done();  
      }, DELAY);
    });

    it('deleting the multiple nodes should shift focus to the one after', function(done) {
      this.literal1.el.dispatchEvent(click());            // activate the node,
      this.literal1.el.dispatchEvent(keydown(SPACE)); // then select it
      this.literal1.el.dispatchEvent(keydown(DOWN, {altKey: true}));
      this.literal2.el.dispatchEvent(keydown(SPACE, {altKey: true}));
      setTimeout(() => {
        expect(this.blocks.selectedNodes.size).toBe(2);
        this.cm.getWrapperElement().dispatchEvent(keydown(DELETE));
        setTimeout(() => {
          expect(this.cm.getValue()).toBe('(+   3)');
          expect(this.blocks.focusPath).toBe("0,1");
          done();
        }, DELAY);
      }, DELAY);
    });

    // TODO: sometimes this test fails because of some reason
    it('inserting a node should put focus on the new node', function(done) {
      this.literal1.el.dispatchEvent(click());
      this.literal1.el.dispatchEvent(keydown(RIGHTBRACKET, {ctrlKey: true}));
      setTimeout(() => {
        let quarantine = document.querySelectorAll('.blocks-editing')[0];
        let selection = window.getSelection();
        expect(selection.rangeCount).toEqual(1);
        let range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode('99'));
        quarantine.dispatchEvent(blur());
        expect(this.cm.getValue()).toBe('(+ 1 99 2 3)');
        expect(this.blocks.focusPath).toBe("0,2");
        done();
      }, DELAY);
    });

    // TODO: sometimes this test fails because of some reason
    it('inserting mulitple nodes should put focus on the last of the new nodes', function(done) {
      this.literal1.el.dispatchEvent(click());
      this.literal1.el.dispatchEvent(keydown(RIGHTBRACKET, {ctrlKey: true}));
      setTimeout(() => {
        let quarantine = document.querySelectorAll('.blocks-editing')[0];
        let selection = window.getSelection();
        expect(selection.rangeCount).toEqual(1);
        let range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode('99 88 77'));
        quarantine.dispatchEvent(blur());
        expect(this.cm.getValue()).toBe('(+ 1 99 88 77 2 3)');
        expect(this.blocks.focusPath).toBe("0,4");
        done();
      }, DELAY);
    });
        
  });
});
