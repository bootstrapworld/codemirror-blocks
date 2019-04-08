import CodeMirrorBlocks from '../../../src/CodeMirrorBlocks';
import pyret from '../../../src/languages/pyret';
import 'codemirror/addon/search/searchcursor.js';
import {store} from '../../../src/store';
import {wait, cleanupAfterTest} from '../../support/test-utils';
import {
  click,
  keyDown,
  keyPress,
  insertText,
} from '../../support/simulate';

const DELAY = 250;

describe('The CodeMirrorBlocks Class', function() {
  beforeEach(function() {
    const fixture = `
      <div id="root">
        <div id="cmb-editor" class="editor-container"/>
      </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', fixture);
    const container = document.getElementById('cmb-editor');
    this.cmb = new CodeMirrorBlocks(container, {collapseAll: false, value: ""}, pyret);
    this.cmb.setBlockMode(true);
    
    this.activeNode = () => this.cmb.getFocusedNode();
    this.activeAriaId = () =>
      this.cmb.getScrollerElement().getAttribute('aria-activedescendent');
    this.selectedNodes = () => this.cmb.getSelectedNodes();
  });

  afterEach(function() {
    cleanupAfterTest('root', store);
  });

  describe("when dealing with variable declarations", function() {
    beforeEach(function() {
      this.cmb.setValue('x = 3');
      let ast = this.cmb.getAst();
      this.literal1 = ast.rootNodes[0];
    });
    
    it('should activate the first sub-component when down is pressed', async function () {
      keyDown(" ", {}, this.literal1);
      keyDown("ArrowDown");
      await wait(DELAY);
      expect(this.activeNode()).not.toBe(this.literal1);
      expect(this.activeNode()).toBe(this.literal1.ident);
      expect(this.activeNode()).not.toBe(this.literal1.rhs);
    });

    it('should activate the second sub-component node when down is pressed twice', async function() {
      keyDown(" ", {}, this.literal1);
      keyDown("ArrowDown");
      keyDown("ArrowDown");
      await wait(DELAY);
      expect(this.activeNode()).not.toBe(this.literal1);
      expect(this.activeNode()).not.toBe(this.literal1.ident);
      expect(this.activeNode()).toBe(this.literal1.rhs);
    });
  });
});
