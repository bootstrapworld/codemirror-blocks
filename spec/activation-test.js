import CodeMirrorBlocks from '../src/CodeMirrorBlocks';
import wescheme from '../src/languages/wescheme';
import 'codemirror/addon/search/searchcursor.js';
import {store} from '../src/store';
import {wait, cleanupAfterTest} from './support/test-utils';
import {
  click,
  keyDown,
  keyPress,
  insertText,
} from './support/simulate';

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
    this.cmb = new CodeMirrorBlocks(container, {collapseAll: false, value: ""}, wescheme);
    this.cmb.setBlockMode(true);
    
    this.activeNode = () => this.cmb.getFocusedNode();
    this.activeAriaId = () =>
      this.cmb.getScrollerElement().getAttribute('aria-activedescendent');
    this.selectedNodes = () => this.cmb.getSelectedNodes();
  });

  afterEach(function() {
    cleanupAfterTest('root', store);
  });

  describe("when dealing with node activation,", function() {
    
    beforeEach(function() {
      this.cmb.setValue('11\n54');
      let ast = this.cmb.getAst();
      this.literal1 = ast.rootNodes[0];
      this.literal2 = ast.rootNodes[1];
    });
    
    it('should only allow one node to be active at a time', async function() {
      click(this.literal1);
      click(this.literal2);
      await wait(DELAY);
      expect(this.activeNode()).not.toBe(this.literal1);
      expect(this.activeNode()).toBe(this.literal2);
    });

    it('should put focus on the active node', async function() {
      click(this.literal1);
      await wait(DELAY);
      expect(document.activeElement).toBe(this.literal1.element);
      expect(this.activeAriaId()).toBe(this.literal1.element.id);
    });

    it('should not delete active nodes when the delete key is pressed', async function() {
      expect(this.cmb.getValue()).toBe('11\n54');
      click(this.literal1);
      await wait(DELAY);
      expect(this.activeNode()).toBe(this.literal1);
      
      keyDown("Delete");
      await wait(DELAY);
      expect(this.cmb.getValue()).toBe('11\n54');
    });

    it('should activate the first node when down is pressed', async function() {
      await wait(DELAY);
      keyDown("ArrowDown");
      await wait(DELAY);
      expect(this.activeNode()).toBe(this.literal1);
      expect(this.cmb.getScrollerElement().getAttribute('aria-activedescendent'))
        .toBe('block-node-'+this.literal1.id);
    });

    it('should activate the next node when down is pressed', async function() {
      keyDown("ArrowDown");
      keyDown("ArrowDown");
      await wait(DELAY);
      expect(this.activeNode()).not.toBe(this.literal1);
      expect(this.activeNode()).toBe(this.literal2);
      expect(this.activeAriaId()).toBe(this.literal2.element.id);
    });

    it('should activate the node after the cursor when down is pressed', async function() {
      this.cmb.setCursor({line: 0, ch: 2});
      keyDown("ArrowDown");
      await wait(DELAY);
      expect(this.activeNode()).not.toBe(this.literal1);
      expect(this.activeNode()).toBe(this.literal2);
      expect(this.activeAriaId()).toBe(this.literal2.element.id);
    });

    it('should activate the node before the cursor when up is pressed', async function() {
      this.cmb.setCursor({line: 0, ch: 2});
      keyDown("ArrowUp");
      await wait(DELAY);
      expect(this.activeNode()).not.toBe(this.literal2);
      expect(this.activeNode()).toBe(this.literal1);
      expect(this.activeAriaId()).toBe(this.literal1.element.id);
    });

    it('should toggle the editability of activated node when Enter is pressed', async function() {
      click(this.literal1);
      await wait (DELAY);
      expect(this.activeNode()).toBe(this.literal1);
      expect(this.literal1.isEditable()).toBe(false);
      
      keyDown("Enter");
      await wait(DELAY);
      expect(this.literal1.isEditable()).toBe(true);
    });

    it('should cancel the editability of activated node when Esc is pressed', async function() {
      click(this.literal1);
      await wait(DELAY);
      expect(this.activeNode()).toBe(this.literal1);
      
      keyDown("Enter");
      await wait(DELAY);
      expect(this.literal1.isEditable()).toBe(true);
      insertText("sugarPlums");
      
      keyDown("Escape");
      await wait(DELAY);
      expect(this.literal1.isEditable()).toBe(false);
      expect(this.cmb.getValue()).toBe('11\n54');
    });

    it('should cancel the editability of activated node when Shift-Esc is pressed', async function() {
      click(this.literal1);
      await wait(DELAY);
      expect(this.activeNode()).toBe(this.literal1);
      
      keyDown("Enter");
      await wait(DELAY);
      expect(this.literal1.isEditable()).toBe(true);
      insertText("sugarPlums");
      
      keyDown("Escape", {shiftKey: true});
      await wait(DELAY);
      expect(this.literal1.isEditable()).toBe(false);
      expect(this.cmb.getValue()).toBe('11\n54');
    });
  });

  describe('cut/copy/paste', function() {
    beforeEach(function() {
      this.cmb.setValue('11\n54');
      let ast = this.cmb.getAst();
      this.literal1 = ast.rootNodes[0];
      this.literal2 = ast.rootNodes[1];
    });

    it('should remove selected nodes on cut', async function() {
      click(this.literal1);
      keyDown(" ", {}, this.literal1);
      await wait(DELAY);
      
      keyDown("X", {ctrlKey: true}, this.literal1);
      await wait(DELAY);
      expect(this.cmb.getValue()).toBe('\n54');
      expect(this.activeNode().id).toBe(this.literal2.id);
      expect(this.activeNode().hash).toBe(this.literal2.hash);
    });

    it('should remove multiple selected nodes on cut', async function() {
      click(this.literal1);
      keyDown(" ", {}, this.literal1);
      await wait(DELAY);
      keyDown("ArrowDown");
      keyDown(" ", {}, this.literal2);
      await wait(DELAY);
      expect(this.selectedNodes().length).toBe(2);
      
      keyDown("X", {ctrlKey: true}, this.literal2);
      await wait(DELAY);
      expect(this.selectedNodes().length).toBe(0);
      expect(this.cmb.getValue()).toBe('\n');
      expect(this.activeNode()).toBe(undefined);
    });
  });

  describe('tree navigation', function() {
    beforeEach(function() {
      this.cmb.setValue('(+ 1 2 3) 99 (* 7 (* 1 2))');
      let ast = this.cmb.getAst();
      this.firstRoot  = ast.rootNodes[0];
      this.secondRoot = ast.rootNodes[1];
      this.thirdRoot  = ast.rootNodes[2];
      this.funcSymbol = ast.rootNodes[0].func;
      this.firstArg   = ast.rootNodes[0].args[0];
      this.secondArg  = ast.rootNodes[0].args[1];
      this.thirdArg   = ast.rootNodes[0].args[2];
      this.nestedExpr = ast.rootNodes[2].args[1];
      this.lastNode   = this.thirdRoot.args[1].args[1];
    });

    it('up-arrow should navigate to the previous visible node, but not beyond the tree', async function() {
      click(this.firstRoot);
      keyDown("ArrowLeft", {}, this.firstRoot);
      click(this.secondRoot);
      await wait(DELAY);
      expect(this.activeNode()).toBe(this.secondRoot);
      expect(this.activeAriaId()).toBe(this.secondRoot.element.id);
      
      keyDown("ArrowUp");
      await wait(DELAY);
      expect(this.activeNode()).toBe(this.firstRoot);
      expect(this.activeAriaId()).toBe(this.firstRoot.element.id);
      
      keyDown("ArrowUp");
      await wait(DELAY);
      expect(this.activeNode()).toBe(this.firstRoot);
      expect(this.activeAriaId()).toBe(this.firstRoot.element.id);
    });

    it('down-arrow should navigate to the next sibling, but not beyond the tree', async function() {
      click(this.firstRoot);
      keyDown("ArrowLeft", {}, this.firstRoot);
      click(this.thirdRoot.args[1].args[0]);
      await wait(DELAY);
      expect(this.activeNode()).toBe(this.thirdRoot.args[1].args[0]);
      
      keyDown("ArrowDown");
      await wait(DELAY);
      expect(this.activeNode()).toBe(this.thirdRoot.args[1].args[1]);
      expect(this.activeAriaId()).toBe(this.thirdRoot.args[1].args[1].element.id);
      
      keyDown("ArrowDown");
      await wait(DELAY);
      expect(this.activeNode()).toBe(this.thirdRoot.args[1].args[1]);
      expect(this.activeAriaId()).toBe(this.thirdRoot.args[1].args[1].element.id);
    });

    it('left-arrow should collapse a block, if it can be', async function() {
      click(this.firstRoot);
      keyDown("ArrowLeft", {}, this.firstRoot);
      click(this.firstRoot);
      keyDown("ArrowLeft", {}, this.firstRoot);
      await wait(DELAY);
      expect(this.firstRoot.element.getAttribute("aria-expanded")).toBe("false");
      
      click(this.secondRoot);
      keyDown("ArrowLeft", {}, this.secondRoot);
      await wait(DELAY);
      expect(this.secondRoot.element.getAttribute("aria-expanded")).toBe(null);
    });

    it('shift-left-arrow should collapse all blocks', async function() {
      click(this.firstRoot);
      keyDown("ArrowLeft", {shiftKey: true}, this.firstRoot);
      await wait(DELAY);
      expect(this.firstRoot.element.getAttribute("aria-expanded")).toBe("false");
      expect(this.secondRoot.element.getAttribute("aria-expanded")).toBe(null);
      expect(this.thirdRoot.element.getAttribute("aria-expanded")).toBe("false");
      expect(this.thirdArg.element.getAttribute("aria-expanded")).toBe(null);
    });

    it('shift-right-arrow should expand all blocks', async function() {
      click(this.firstRoot);
      keyDown("ArrowLeft", {shiftKey: true}, this.firstRoot);
      await wait(DELAY);
      keyDown("ArrowRight", {shiftKey: true}, this.firstRoot);
      expect(this.firstRoot.element.getAttribute("aria-expanded")).toBe("true");
      expect(this.secondRoot.element.getAttribute("aria-expanded")).toBe(null);
      expect(this.thirdRoot.element.getAttribute("aria-expanded")).toBe("true");
      expect(this.nestedExpr.element.getAttribute("aria-expanded")).toBe("true");
    });

    it('shift-alt-left-arrow should collapse only the currently-active root', async function() {
      click(this.lastNode);
      keyDown("ArrowLeft", {shiftKey: true}, this.firstRoot); // collapse all
      await wait(DELAY);
      expect(this.firstRoot.element.getAttribute("aria-expanded")).toBe("false");
      expect(this.secondRoot.element.getAttribute("aria-expanded")).toBe(null);
      expect(this.thirdRoot.element.getAttribute("aria-expanded")).toBe("false");
      expect(this.thirdArg.element.getAttribute("aria-expanded")).toBe(null);
      keyDown("ArrowRight", {shiftKey: true, altKey: true}, this.lastNode);
      expect(this.firstRoot.element.getAttribute("aria-expanded")).toBe("false");
      expect(this.secondRoot.element.getAttribute("aria-expanded")).toBe(null);
      expect(this.thirdRoot.element.getAttribute("aria-expanded")).toBe("true");
      expect(this.nestedExpr.element.getAttribute("aria-expanded")).toBe("true");
    });

    it('shift-alt-right-arrow should expand only the currently-active root', async function() {
      click(this.lastNode);
      await wait(DELAY);
      keyDown("ArrowLeft", {shiftKey: true, altKey: true}, this.lastNode);
      expect(this.firstRoot.element.getAttribute("aria-expanded")).toBe("true");
      expect(this.secondRoot.element.getAttribute("aria-expanded")).toBe(null);
      expect(this.thirdRoot.element.getAttribute("aria-expanded")).toBe("false");
      expect(this.nestedExpr.element.getAttribute("aria-expanded")).toBe("false");
    });

    it('less-than should activate root without collapsing', async function() {
      click(this.thirdRoot.args[1].args[1]);
      keyDown("<", {shiftKey: true}, this.thirdRoot.args[1].args[1]);
      await wait(DELAY);
      expect(this.thirdRoot.element.getAttribute("aria-expanded")).toBe("true");
      expect(this.activeNode()).toBe(this.thirdRoot);
    });

    it('right-arrow should expand a block, or shift focus to 1st child', async function() {
      click(this.firstRoot);
      keyDown("ArrowLeft", {}, this.firstRoot);
      await wait(DELAY);
      expect(this.firstRoot.element.getAttribute("aria-expanded")).toBe("false");

      keyDown("ArrowRight");
      await wait(DELAY);
      expect(this.activeNode()).toBe(this.firstRoot);
      expect(this.firstRoot.element.getAttribute("aria-expanded")).toBe("true");

      keyDown("ArrowRight");
      await wait(DELAY);
      expect(this.activeNode()).toBe(this.funcSymbol);
      expect(this.firstRoot.element.getAttribute("aria-expanded")).toBe("true");
    });

    it('home should activate the first visible node', async function() {
      click(this.firstRoot);
      keyDown("ArrowLeft", {}, this.firstRoot);
      await wait(DELAY);
      click(this.secondRoot);
      keyDown("Home");
      await wait(DELAY);
      expect(this.activeNode()).toBe(this.firstRoot);
      expect(this.activeAriaId()).toBe(this.firstRoot.element.id);
    });

    // TODO: this test legitimately fails
    it('end should activate the last visible node', async function() {
      click(this.secondRoot);
      await wait(DELAY);
      keyDown("End");
      await wait(DELAY);
      expect(this.activeNode()).toBe(this.lastNode);
      expect(this.activeAriaId()).toBe(this.lastNode.element.id);
      click(this.thirdRoot.args[1]);
      keyDown("ArrowLeft", {}, this.thirdRoot.args[1]);
      await wait(DELAY);
      click(this.secondRoot);
      keyDown("End");
      await wait(DELAY);
      expect(this.activeNode()).toBe(this.thirdRoot.args[1]);
      expect(this.activeAriaId()).toBe(this.thirdRoot.args[1].element.id);
    });
  });

  describe("when dealing with node selection, ", function() {
    beforeEach(function() {
      this.cmb.setValue('11\n54\n(+ 1 2)');
      let ast = this.cmb.getAst();
      this.literal1 = ast.rootNodes[0];
      this.literal2 = ast.rootNodes[1];
      this.expr     = ast.rootNodes[2];
    });

    it('space key toggles selection on and off', async function() {
      click(this.literal1);
      keyDown(" ", {}, this.literal1);
      await wait(DELAY);
      expect(this.literal1.element.getAttribute("aria-selected")).toBe('true');
      expect(this.selectedNodes().length).toBe(1);

      keyDown(" ", {}, this.literal1);
      await wait(DELAY);
      expect(this.literal1.element.getAttribute("aria-selected")).toBe('false');
      expect(this.selectedNodes().length).toBe(0);
    });

    it('esc key clears selection', async function() {
      click(this.literal1);
      keyDown(" ", {}, this.literal1);
      await wait(DELAY);
      expect(this.literal1.element.getAttribute("aria-selected")).toBe('true');
      expect(this.selectedNodes().length).toBe(1);
      click(this.literal2);
      keyDown(" ", {}, this.literal2);
      await wait(DELAY);
      expect(this.literal2.element.getAttribute("aria-selected")).toBe('true');
      expect(this.selectedNodes().length).toBe(2);
      keyDown("Escape", {}, this.literal2);
      await wait(DELAY);
      expect(this.selectedNodes().length).toBe(0);
    });

    it('shift-esc key clears selection', async function() {
      click(this.literal1);
      keyDown(" ", {}, this.literal1);
      await wait(DELAY);
      expect(this.literal1.element.getAttribute("aria-selected")).toBe('true');
      expect(this.selectedNodes().length).toBe(1);
      click(this.literal2);
      keyDown(" ", {}, this.literal2);
      await wait(DELAY);
      expect(this.literal2.element.getAttribute("aria-selected")).toBe('true');
      expect(this.selectedNodes().length).toBe(2);
      keyDown("Escape", {shiftKey: true}, this.literal2);
      await wait(DELAY);
      expect(this.selectedNodes().length).toBe(0);
    });

    it('arrow preserves selection & changes active ', async function() {
      click(this.literal1);
      keyDown(" ", {}, this.literal1);
      await wait(DELAY);
      keyDown("ArrowDown");
      await wait(DELAY);
      expect(this.literal1.element.getAttribute("aria-selected")).toBe('true');
      expect(this.literal2.element.getAttribute("aria-selected")).toBe('false');
      expect(this.activeNode()).toBe(this.literal2);
      expect(this.selectedNodes().length).toBe(1);
    });

    it('allow multiple, non-contiguous selection ', async function() {
      click(this.literal1);
      keyDown(" ", {}, this.literal1);
      await wait(DELAY);
      keyDown("ArrowDown");
      await wait(DELAY);
      keyDown("ArrowDown"); // skip over literal2
      await wait(DELAY);
      keyDown(" ", {}, this.expr);
      await wait(DELAY);
      expect(this.literal1.element.getAttribute("aria-selected")).toBe('true');
      expect(this.literal2.element.getAttribute("aria-selected")).toBe('false');
      expect(this.expr.element.getAttribute("aria-selected")).toBe('true');
      expect(this.activeNode()).toBe(this.expr);
      expect(this.selectedNodes().length).toBe(2);
    });

    it('selecting a parent, then child should just select the parent ', async function() {
      click(this.expr);
      keyDown(" ", {}, this.expr);
      await wait(DELAY);
      keyDown("ArrowDown");
      await wait(DELAY);
      keyDown(" ", {}, this.expr.func);
      await wait(DELAY);
      expect(this.expr.element.getAttribute("aria-selected")).toBe('true');
      expect(this.expr.func.element.getAttribute("aria-selected")).toBe('false');
      expect(this.activeNode()).toBe(this.expr.func);
      expect(this.selectedNodes().length).toBe(1);
      expect(this.selectedNodes()[0]).toBe(this.expr);
    });

    it('selecting a child, then parent should just select the parent ', async function() {
      click(this.expr.func);
      keyDown(" ", {}, this.expr.func);
      await wait(DELAY);
      keyDown("ArrowUp");
      await wait(DELAY);
      keyDown(" ", {}, this.expr);
      await wait(DELAY);
      expect(this.expr.element.getAttribute("aria-selected")).toBe('true');
      expect(this.expr.func.element.getAttribute("aria-selected")).toBe('false');
      expect(this.activeNode()).toBe(this.expr);
      expect(this.selectedNodes().length).toBe(1);
      expect(this.selectedNodes()[0]).toBe(this.expr);
    });
  });
});
