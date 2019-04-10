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

  /** //////////////////////////////////////////////////////////
   * Specific navigation tests for programs that use BSDS constructs below
   */
  describe("load-spreadsheet", function() {
    beforeEach(function() {
      this.cmb.setValue('load-spreadsheet("14er5Mh443Lb5SIFxXZHdAnLCuQZaA8O6qtgGlibQuEg")');
      let ast = this.cmb.getAst();
      this.literal1 = ast.rootNodes[0];
    });
    
    it('should activate load-spreadsheet when down is pressed', async function () {
      click(this.literal1);
      await wait(DELAY);
      keyDown("ArrowDown");
      await wait(DELAY);
      expect(this.activeNode()).not.toBe(this.literal1);
      expect(this.activeNode()).toBe(this.literal1.func);
      expect(this.activeNode()).not.toBe(this.literal1.args);
    });

    it('should activate the url when down is pressed twice', async function () {
      click(this.literal1);
      await wait(DELAY);
      keyDown("ArrowDown");
      await wait(DELAY);
      keyDown("ArrowDown");
      await wait(DELAY);
      expect(this.activeNode()).not.toBe(this.literal1);
      expect(this.activeNode()).not.toBe(this.literal1.func);
      expect(this.activeNode()).toBe(this.literal1.args[0]);
    });
  });

  describe("when dealing with variable declarations", function() {
    beforeEach(function() {
      this.cmb.setValue('x = 3');
      let ast = this.cmb.getAst();
      this.literal1 = ast.rootNodes[0];
    });
    
    it('should activate the binding when down is pressed', async function () {
      click(this.literal1);
      await wait(DELAY);
      keyDown(" ");
      keyDown("ArrowDown");
      await wait(DELAY);
      expect(this.activeNode()).not.toBe(this.literal1);
      expect(this.activeNode()).toBe(this.literal1.ident);
      expect(this.activeNode()).not.toBe(this.literal1.rhs);
    });

    it('should activate the rhs when down is pressed twice', async function () {
      click(this.literal1);
      await wait(DELAY);
      keyDown("ArrowDown");
      await wait(DELAY);
      keyDown("ArrowDown");
      await wait(DELAY);
      expect(this.activeNode()).not.toBe(this.literal1);
      expect(this.activeNode()).not.toBe(this.literal1.ident);
      expect(this.activeNode()).toBe(this.literal1.rhs);
    });
  });
});
