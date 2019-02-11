import CodeMirrorBlocks from '../src/CodeMirrorBlocks';
import wescheme from '../src/languages/wescheme';
import {
  click,
  blur,
  keyDown,
  insertText
} from './support/simulate';
import {wait} from './support/test-utils';


// ms delay to let the DOM catch up before testing
const DELAY = 200;

describe('The CodeMirrorBlocks Class', function() {
  beforeEach(function() {
    const fixture = `
      <div id="root">
        <div id="cmb-editor" class="editor-container"/>
      </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', fixture);
    const container = document.getElementById('cmb-editor');
    this.cmb = new CodeMirrorBlocks(container, wescheme, "");
    // TODO: rename this to the more descriptive `setBlockMode`
    this.cmb.handleToggle(true);

    this.trackSetQuarantine = spyOn(this.cmb, 'setQuarantine').and.callThrough();
  });

  afterEach(function() {
    document.body.removeChild(document.getElementById('root'));
  });

  describe('focusing,', function() {
    beforeEach(function() {
      this.cmb.setValue('(+ 1 2 3)');
      this.expression = this.cmb.getAst().rootNodes[0];
      this.func = this.expression.func;
      this.literal1 = this.expression.args[0];
      this.literal2 = this.expression.args[1];
      this.literal3 = this.expression.args[2];
    });

    it('deleting the last node should shift focus to the next-to-last', async function() {
      click(this.literal3);
      await wait(DELAY);
      expect(document.activeElement).toBe(this.literal3.element);
      keyDown(this.literal3, " ");
      keyDown(this.literal3, "Delete");
      await wait(DELAY);
      expect(this.cmb.getValue()).toBe('(+ 1 2 )');
      expect(this.cmb.getFocusedNode().id).toBe(this.literal2.id);
    });

    it('deleting the first node should shift focus to the parent', async function() {
      click(this.literal1);
      await wait(DELAY);
      expect(document.activeElement).toBe(this.literal1.element);
      keyDown(this.literal1, " ");
      keyDown(this.literal1, "Delete");
      await wait(DELAY);
      expect(this.cmb.getValue()).toBe('(+  2 3)');
      expect(this.cmb.getFocusedNode().id).toBe(this.func.id);
    });

    it('deleting the nth node should shift focus to n-1', async function() {
      click(this.literal2);
      await wait(DELAY);
      expect(document.activeElement).toBe(this.literal2.element);
      keyDown(this.literal2, " ");
      keyDown(this.literal2, "Delete");
      await wait(DELAY);
      expect(this.cmb.getValue()).toBe('(+ 1  3)');
      expect(this.cmb.getFocusedNode().id).toBe(this.literal1.id);
    });

    it('deleting multiple nodes should shift focus to the one before', async function() {
      click(this.literal2);
      keyDown(this.literal2, " ");
      keyDown(this.literal2, "ArrowDown");
      keyDown(this.literal3, " ");
      await wait(DELAY);
      expect(this.cmb.getSelectedNodes().length).toBe(2);
      keyDown(this.literal3, "Delete");
      await wait(DELAY);
      expect(this.cmb.getValue()).toBe('(+ 1  )');
      expect(this.cmb.getFocusedNode().id).toBe(this.literal1.id);
    });
    
    it('inserting a node should put focus on the new node', async function() {
      click(this.literal1);
      await wait(DELAY);
      keyDown(this.literal1, ']', {ctrlKey: true});
      await wait(DELAY);
      insertText('99'); // in place of 2x keydown
      keyDown(document.activeElement, "Enter");
      await wait(DELAY);
      // extra WS is removed when we switch back to text, but in blockmode
      // there's an extra space inserted after 99
      expect(this.cmb.getValue()).toBe('(+ 1 99  2 3)');
      // TODO(Emmanuel): does getFocusedNode().value always return strings?
      expect(this.cmb.getFocusedNode().value).toBe('99');
    });

    it('inserting mulitple nodes should put focus on the last of the new nodes', async function() {
      click(this.literal1);
      await wait(DELAY);
      keyDown(this.literal1, ']', {ctrlKey: true});
      await wait(DELAY);
      insertText('99 88 77');
      keyDown(document.activeElement, "Enter");
      await wait(DELAY);
      expect(this.cmb.getValue()).toBe('(+ 1 99 88 77  2 3)');
      // TODO(Emmanuel): does getFocusedNode().value always return strings?
      expect(this.cmb.getFocusedNode().value).toBe('77');
    });
  });
});
