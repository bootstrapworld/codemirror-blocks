import wescheme from '../src/languages/wescheme';
import 'codemirror/addon/search/searchcursor.js';

/*eslint no-unused-vars: "off"*/
import {
  mac, cmd_ctrl, DELAY, wait, removeEventListeners, teardown, activationSetup,
  click, mouseDown, mouseenter, mouseover, mouseleave, doubleClick, blur, 
  paste, cut, copy, dragstart, dragover, drop, dragenter, dragenterSeq, 
  dragend, dragleave, keyDown, keyPress, insertText
} from '../spec/support/test-utils';

console.log('Doing drag-test.js');

// be sure to call with `apply` or `call`
let setup = function () { activationSetup.call(this, wescheme); };

describe('Drag and drop', function() {
  beforeEach(function() {
    setup.call(this);
    this.cmb.setBlockMode(true);
  });

  afterEach(function() {
    teardown();
  });

  describe('when drag existing node and drop on existing node,', function() {
    beforeEach(async function() {
      this.cmb.setValue('(+ 1 2 3)');
      await wait(DELAY);
      this.retrieve = function() {
        this.funcSymbol = this.cmb.getAst().rootNodes[0].func;
        this.firstArg = this.cmb.getAst().rootNodes[0].args[0];
        this.secondArg = this.cmb.getAst().rootNodes[0].args[1];
        this.thirdArg = this.cmb.getAst().rootNodes[0].args[2];
        this.dropTargetEls = this.cmb.getAst().rootNodes[0].element.querySelectorAll(
          '.blocks-drop-target'
        );
      };
      this.retrieve();
    });

    it('should override nodes 1', function() {
      expect(this.secondArg.element.innerText).toBe('2');
      let dragEvent = dragstart();
      this.firstArg.element.dispatchEvent(dragEvent);
      this.secondArg.element.dispatchEvent(drop(dragEvent.dataTransfer));
      this.retrieve();
      expect(this.secondArg.element.innerText).toBe('3');
    });

    it('should set the right css class on dragenter 2', function() {
      let dragEvent = dragstart();
      this.firstArg.element.dispatchEvent(dragEvent);
      let elt = this.dropTargetEls[3];
      expect(elt.classList).toContain('blocks-drop-target');
      dragenterSeq(elt);
      expect(elt.classList).toContain('blocks-over-target');
    });

   
    it('should set the right css class on dragenter 2’', function() {
      let dragEvent = dragstart();
      this.firstArg.element.dispatchEvent(dragEvent);
      let elt = this.secondArg;
      dragenterSeq(elt);
    });

    it('should set the right css class on dragleave 3', function() {
      let dragEvent = dragstart();
      this.firstArg.element.dispatchEvent(dragEvent);
      let elt = this.dropTargetEls[3];
      dragenter(elt);
      dragleave(elt);
      expect(elt.classList).not.toContain('blocks-over-target');
    });

    it('should do nothing when dragging over a non-drop target 4', function() {
      let dragEvent = dragstart();
      this.firstArg.element.dispatchEvent(dragEvent);
      let nonDT = this.cmb.getAst().rootNodes[0].element;
      dragenterSeq(nonDT);
      expect(this.secondArg.element.classList).not.toContain('blocks-over-target');
    });

    it('should do nothing when dropping onto a non-drop target 5', function() {
      let initialValue = this.cmb.getValue();
      let dragEvent = dragstart();
      this.firstArg.element.dispatchEvent(dragEvent);
      let nonDT = this.cmb.getAst().rootNodes[0].element;
      nonDT.dispatchEvent(drop(dragEvent.dataTransfer));
      expect(this.cmb.getValue()).toBe(initialValue);
    });

    it('should update the text on drop to a later point in the file 6', function() {
      expect(this.dropTargetEls[3].classList).toContain('blocks-drop-target');
      // drag the first arg to the drop target
      let dragEvent = dragstart();
      this.firstArg.element.dispatchEvent(dragEvent);
      this.dropTargetEls[3].dispatchEvent(drop(dragEvent.dataTransfer));
      expect(this.cmb.getValue().replace(/\s+/, ' ')).toBe('(+ 2 3 1)');
    });
    
    it('should update the text on drop to an earlier point in the file 7', function() {
      let dragEvent = dragstart();
      this.secondArg.element.dispatchEvent(dragEvent);
      this.dropTargetEls[0].dispatchEvent(drop(dragEvent.dataTransfer));
      expect(this.cmb.getValue().replace('  ', ' ')).toBe('(+ 2 1 3)');
    });

    /*
    it('should move an item to the top level when dragged outside a node 8', function() {
      console.log('################ 8');
      let dragEvent = dragstart();
      this.secondArg.element.dispatchEvent(dragEvent);
      let dropEvent = drop(dragEvent.dataTransfer);
      let nodeEl = this.cmb.getAst().rootNodes[0].element;
      let wrapperEl = this.cmb.getWrapperElement();
      // These two show up as undefined in monitor.getClientOffset ?
      dropEvent.pageX = wrapperEl.offsetLeft + wrapperEl.offsetWidth - 10;
      dropEvent.pageY = nodeEl.offsetTop + wrapperEl.offsetHeight - 10;
      nodeEl.parentElement.dispatchEvent(dropEvent);
      expect(this.cmb.getValue().replace('  ', ' ')).toBe('(+ 1 3) 2');
      console.log('%%%%%%%%%%%%%%%% 8');
    });
    */
    
    it('should replace a literal that you drag onto 9', function() {
      let dragEvent = dragstart();
      this.firstArg.element.dispatchEvent(dragEvent);
      this.secondArg.element.dispatchEvent(drop(dragEvent.dataTransfer));
      expect(this.cmb.getValue().replace(/\s+/, ' ')).toBe('(+ 1 3)');
    });
    
    // these two tests seem to fail because dragend is not called.
    // see https://github.com/react-dnd/react-dnd/issues/455 for more info

    /*
    it('should support dragging plain text to replace a literal 10', function() {
      console.log('################ 10');
      let elt1 = this.firstArg.element;
      let dragEvent = dragstart();
      elt1.dispatchEvent(dragEvent);
      dragEvent.dataTransfer = new DataTransfer();
      dragEvent.dataTransfer.setData('text/plain', '5000');
      elt1.dispatchEvent(dragend());
      this.firstArg.element.dispatchEvent(drop(dragEvent.dataTransfer));
      //expect(this.cmb.getValue().replace(/\s+/, ' ')).toBe('(+ 5000 2 3)');
      console.log('%%%%%%%%%%%%%%%% 10');
    });
    */
    
    /*
    it('should support dragging plain text onto some whitespace 11', function() {
      console.log('################ 11');
      let dragEvent = dragstart();
      dragEvent.dataTransfer = new DataTransfer();
      dragEvent.dataTransfer.setData('text/plain', '5000');
      let dropEvent = drop(dragEvent.dataTransfer);
      let nodeEl = this.cmb.getAst().rootNodes[0].element;
      let wrapperEl = this.cmb.getWrapperElement();
      dropEvent.pageX = wrapperEl.offsetLeft + wrapperEl.offsetWidth - 10;
      dropEvent.pageY = nodeEl.offsetTop + wrapperEl.offsetHeight - 10;
      nodeEl.parentElement.dispatchEvent(dropEvent);
      expect(this.cmb.getValue().replace('  ', ' ')).toBe('(+ 1 2 3)\n5000');
      console.log('%%%%%%%%%%%%%%%% 11');
    });
    */
    it('save collapsed state when dragging root to be the last child of the next root', async function () {
      this.cmb.setValue('(collapse me)\n(+ 1 2)');
      await wait(DELAY);
      this.retrieve = function() {
        this.firstRoot = this.cmb.getAst().rootNodes[0];
        this.lastDropTarget = document.querySelectorAll('.blocks-drop-target')[4];
      };
      this.retrieve();

      mouseDown(this.firstRoot); // click the root
      keyDown("ArrowLeft", {}, this.firstRoot); // collapse it
      expect(this.firstRoot.element.getAttribute('aria-expanded')).toBe('false');
      expect(this.firstRoot.nid).toBe(0);
      let dragEvent = dragstart();
      this.firstRoot.element.dispatchEvent(dragEvent); // drag to the last droptarget
      this.lastDropTarget.dispatchEvent(drop(dragEvent.dataTransfer));
      await wait(DELAY);
      this.retrieve();
      this.newFirstRoot = this.cmb.getAst().rootNodes[0];
      this.newLastChild = this.newFirstRoot.args[2];
      expect(this.cmb.getValue()).toBe('\n(+ 1 2 (collapse me))');
      expect(this.newFirstRoot.element.getAttribute('aria-expanded')).toBe('true');
      expect(this.newLastChild.element.getAttribute('aria-expanded')).toBe('false');
    });
  });


  describe("corner cases", function () {
    beforeEach(async function () {
      setup.call(this);
      this.cmb.setValue(';comment\n(a)\n(c)\n(define-struct e ())\ng');
      await wait(DELAY);
      this.retrieve = function() {
        this.source = this.cmb.getAst().rootNodes[0];
        this.target1 = document.querySelectorAll('.blocks-drop-target')[1];
        this.target2 = document.querySelectorAll('.blocks-drop-target')[2];
      };
      this.retrieve();
    });

    afterEach(function () { teardown(); });

    it('regression test for unstable block IDs', async function () {
      let dragEvent = dragstart();
      this.source.element.dispatchEvent(dragEvent); // drag to the last droptarget
      this.target1.dispatchEvent(drop(dragEvent.dataTransfer));
      await wait(DELAY);
    });

    it('regression test for empty identifierLists returning a null location', async function () {
      let dragEvent = dragstart();
      this.source.element.dispatchEvent(dragEvent); // drag to the last droptarget
      this.target2.dispatchEvent(drop(dragEvent.dataTransfer));
      await wait(DELAY);
    });
  });
});
