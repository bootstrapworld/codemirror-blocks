import CodeMirrorBlocks from '../src/CodeMirrorBlocks';
import wescheme from '../src/languages/wescheme';
import {store} from '../src/store';
import {
  click,
  keyDown,
  insertText
} from './support/simulate';
import {wait, cleanupAfterTest} from './support/test-utils';


// ms delay to let the DOM catch up before testing
const DELAY = 750;

describe('The CodeMirrorBlocks Class', function() {
  beforeEach(function() {
    const fixture = `
      <div id="root">
        <div id="cmb-editor" class="editor-container"/>
      </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', fixture);
    const container = document.getElementById('cmb-editor');
    this.cmb = new CodeMirrorBlocks(container, {value: ""}, wescheme);
    this.blocks = this.cmb;
    this.cm = this.cmb;
    this.blocks.setBlockMode(true);
  });

  afterEach(function() {
    cleanupAfterTest('root', store);
  });

  describe('focusing,', function() {
    beforeEach(async function() {
      this.cm.setValue('(+ 1 2 3)');
      await wait(DELAY);
      this.expression = this.blocks.getAst().rootNodes[0];
      this.func = this.expression.func;
      this.literal1 = this.expression.args[0];
      this.literal2 = this.expression.args[1];
      this.literal3 = this.expression.args[2];
    });

    it('deleting the last node should shift focus to the next-to-last', async function() {
      click(this.literal3);
      await wait(DELAY);
      expect(document.activeElement).toBe(this.literal3.element);
      keyDown(" ");
      keyDown("Delete");
      await wait(DELAY);
      expect(this.cm.getValue()).toBe('(+ 1 2 )');
      expect(this.blocks.getFocusedNode().id).toBe(this.literal2.id);
    });

    it('deleting the first node should shift focus to the parent', async function() {
      click(this.literal1);
      await wait(DELAY);
      expect(document.activeElement).toBe(this.literal1.element);
      keyDown(" ");
      keyDown("Delete");
      await wait(DELAY);
      expect(this.cm.getValue()).toBe('(+ 2 3)');
      expect(this.blocks.getFocusedNode().id).toBe(this.func.id);
    });

    it('deleting the nth node should shift focus to n-1', async function() {
      click(this.literal2);
      await wait(DELAY);
      expect(document.activeElement).toBe(this.literal2.element);
      keyDown(" ");
      keyDown("Delete");
      await wait(DELAY);
      expect(this.cm.getValue()).toBe('(+ 1 3)');
      expect(this.blocks.getFocusedNode().id).toBe(this.literal1.id);
    });

    it('deleting multiple nodes should shift focus to the one before', async function() {
      click(this.literal2);
      await wait(DELAY);
      keyDown(" ");
      keyDown("ArrowDown");
      keyDown(" ", {}, this.literal3);
      await wait(DELAY);
      expect(this.blocks.getSelectedNodes().length).toBe(2);
      keyDown("Delete");
      await wait(DELAY);
      expect(this.cm.getValue()).toBe('(+ 1 )');
      expect(this.blocks.getFocusedNode().id).toBe(this.literal1.id);
    });
    
    it('inserting a node should put focus on the new node', async function() {
      click(this.literal1);
      await wait(DELAY);
      keyDown(']', {ctrlKey: true});
      await wait(DELAY);
      insertText('99'); // in place of 2x keydown
      keyDown("Enter");
      await wait(DELAY);
      // extra WS is removed when we switch back to text, but in blockmode
      // there's an extra space inserted after 99
      expect(this.cm.getValue()).toBe('(+ 1 99 2 3)');
      // TODO(Emmanuel): does getFocusedNode().value always return strings?
      expect(this.blocks.getFocusedNode().value).toBe('99');
    });

    it('inserting mulitple nodes should put focus on the last of the new nodes', async function() {
      click(this.literal1);
      await wait(DELAY);
      keyDown(']', {ctrlKey: true});
      await wait(DELAY);
      insertText('99 88 77');
      keyDown("Enter");
      await wait(DELAY);
      expect(this.cm.getValue()).toBe('(+ 1 99 88 77 2 3)');
      // TODO(Emmanuel): does getFocusedNode().value always return strings?
      expect(this.blocks.getFocusedNode().value).toBe('77');
    });
  });
});
