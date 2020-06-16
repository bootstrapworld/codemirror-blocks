import wescheme from '../src/languages/wescheme';
import 'codemirror/addon/search/searchcursor.js';
/* eslint-disable */ //temporary
import {wait, teardown, activationSetup} from './support/test-utils';

import {
  dragstart,
  drop,
  dragenter,
  dragleave,
  dragenterSeq,
  dragleaveSeq,
} from './support/simulate';

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
    beforeEach(function() {
      this.cmb.setValue('(+ 1 2 3)');
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
      // dragstart,drop
      console.log('################ 1');
      //console.log('DS26GTE doing dragstart/drop');

      expect(this.secondArg.element.innerText).toBe('2');
      let dragEvent = dragstart();
      this.firstArg.element.dispatchEvent(dragEvent);
      //console.log('se=', this.secondArg.element.classList);
      this.secondArg.element.dispatchEvent(drop(dragEvent.dataTransfer));
      this.retrieve();
      //console.log('se’=', this.secondArg.element.classList);
      expect(this.secondArg.element.innerText).toBe('3');

      console.log('DS26GTE done dragstart/drop\n');
      console.log('%%%%%%%%%%%%%%%% 1');
    });

    it('should set the right css class on dragenter 2', function() {

      //original
      //which was commented and wouldn't have worked without a defn of dragenter anyway:
        //this.dropTargetEls[3].dispatchEvent(dragenter());
      //expect(this.dropTargetEls[3].classList).toContain('blocks-over-target');

      console.log('################ 2');
      //console.log('DS26GTE doing dragstart/dragenter');

      //ds26gte try, after suitable defns in simulate.js

      let dragEvent = dragstart();
      this.firstArg.element.dispatchEvent(dragEvent);

      let elt = this.dropTargetEls[3];
      expect(elt.classList).toContain('blocks-drop-target');

      dragenterSeq(elt);
      expect(elt.classList).toContain('blocks-over-target');

      console.log('DS26GTE done dragstart/dragenter');
      console.log('%%%%%%%%%%%%%%%% 2');

    });

    it('should set the right css class on dragenter 2’', function() {

      //original
      //which was commented and wouldn't have worked without a defn of dragenter anyway:
        //this.dropTargetEls[3].dispatchEvent(dragenter());
      //expect(this.dropTargetEls[3].classList).toContain('blocks-over-target');

      console.log('################ 2’');
      //console.log('DS26GTE doing dragstart/dragenter');

      //ds26gte try, after suitable defns in simulate.js

      let dragEvent = dragstart();
      this.firstArg.element.dispatchEvent(dragEvent);

      let elt = this.secondArg;
      //console.log('se=', this.secondArg.element.classList);
      //expect(elt.classList).toContain('blocks-drop-target');

      dragenterSeq(elt);
      //console.log('se=', this.secondArg.element.classList);
      //expect(elt.classList).toContain('blocks-over-target');

      //console.log('DS26GTE done dragstart/dragenter');
      console.log('%%%%%%%%%%%%%%%% 2’');

    });

    it('should set the right css class on dragleave 3', function() {
      // original
      //this.dropTargetEls[3].dispatchEvent(dragenter());
      //this.dropTargetEls[3].dispatchEvent(dragleave());
      //expect(this.dropTargetEls[3].classList).not.toContain('blocks-over-target');

      console.log('################ 3');
      //console.log('DS26GTE doing dragenter/dragleave');

      let dragEvent = dragstart();
      this.firstArg.element.dispatchEvent(dragEvent);

      let elt = this.dropTargetEls[3];

      dragenter(elt);
      dragleave(elt);
      expect(elt.classList).not.toContain('blocks-over-target');

      //console.log('DS26GTE done dragenter/dragleave');
      console.log('%%%%%%%%%%%%%%%% 3');
    });

    it('should do nothing when dragging over a non-drop target 4', function() {
      //this.blocks.getAst().rootNodes[0].element.dispatchEvent(dragenter());
      //expect(this.blocks.getAst().rootNodes[0].element.classList).not.toContain('blocks-over-target');

      console.log('################ 4');
      let dragEvent = dragstart();
      this.firstArg.element.dispatchEvent(dragEvent);

      //console.log('se=', this.secondArg.element.classList);

      let nonDT = this.cmb.getAst().rootNodes[0].element;
      //console.log('before nonDT.cl=');
      //console.log(nonDT.classList);Book
      //console.log('before nonDT.it=');
      //console.log(nonDT.innerText);
      dragenterSeq(nonDT);
      //console.log('after nonDT.cl=');
      //console.log(nonDT.classList);
      //console.log('after nonDT.it=');
      //console.log(nonDT.innerText);
      //console.log('se’=', this.secondArg.element.classList);
      expect(this.secondArg.element.classList).not.toContain('blocks-over-target');

      console.log('%%%%%%%%%%%%%%%% 4');

    });

    it('should do nothing when dropping onto a non-drop target 5', function() {
      //let dragEvent = dragstart();
      //this.firstArg.element.dispatchEvent(dragEvent);
      //var initialValue = this.cm.getValue();
      //this.blocks.getAst().rootNodes[0].element.dispatchEvent(drop(dragEvent.dataTransfer));
      //expect(this.cm.getValue()).toBe(initialValue);

      console.log('################ 5');

      let initialValue = this.cmb.getValue();
      let dragEvent = dragstart();
      this.firstArg.element.dispatchEvent(dragEvent);

      let nonDT = this.cmb.getAst().rootNodes[0].element;

      nonDT.dispatchEvent(drop(dragEvent.dataTransfer));
      expect(this.cmb.getValue()).toBe(initialValue);

      console.log('%%%%%%%%%%%%%%%% 5');

    });

    it('should update the text on drop to a later point in the file 6', function() {
      console.log('################ 6');

      //expect(this.dropTargetEls[4].classList).toContain('blocks-drop-target');
      //// drag the first arg to the drop target
      //let dragEvent = dragstart();
      //this.firstArg.element.dispatchEvent(dragEvent);
      //this.dropTargetEls[4].dispatchEvent(drop(dragEvent.dataTransfer));
      //expect(this.cm.getValue().replace(/\s+/, ' ')).toBe('(+ 2 1 3)');

      //console.log('dt4=');
      //console.log(this.dropTargetEls[3]);
      expect(this.dropTargetEls[3].classList).toContain('blocks-drop-target');
      // drag the first arg to the drop target
      let dragEvent = dragstart();
      this.firstArg.element.dispatchEvent(dragEvent);
      this.dropTargetEls[3].dispatchEvent(drop(dragEvent.dataTransfer));
      expect(this.cmb.getValue().replace(/\s+/, ' ')).toBe('(+ 2 3 1)');

      console.log('%%%%%%%%%%%%%%%% 6');
    });

    it('should update the text on drop to an earlier point in the file 7', function() {
      console.log('################ 7');

      let dragEvent = dragstart();
      this.secondArg.element.dispatchEvent(dragEvent);
      this.dropTargetEls[0].dispatchEvent(drop(dragEvent.dataTransfer));
      expect(this.cmb.getValue().replace('  ', ' ')).toBe('(+ 2 1 3)');

      console.log('%%%%%%%%%%%%%%%% 7');
    });

    /*
    it('should move an item to the top level when dragged outside a node 8', function() {
      console.log('################ 8');
      let dragEvent = dragstart();
      this.secondArg.element.dispatchEvent(dragEvent);
      let dropEvent = drop(dragEvent.dataTransfer);
      let nodeEl = this.blocks.getAst().rootNodes[0].element;
      let wrapperEl = this.cm.getWrapperElement();
      dropEvent.pageX = wrapperEl.offsetLeft + wrapperEl.offsetWidth - 10;
      dropEvent.pageY = nodeEl.offsetTop + wrapperEl.offsetHeight - 10;
      nodeEl.parentElement.dispatchEvent(dropEvent);
      expect(this.cm.getValue().replace('  ', ' ')).toBe('(+ 1 3) 2');
      console.log('%%%%%%%%%%%%%%%% 8');
    });
    */

    it('should replace a literal that you drag onto 9', function() {
      console.log('################ 9');
      let dragEvent = dragstart();
      this.firstArg.element.dispatchEvent(dragEvent);
      this.secondArg.element.dispatchEvent(drop(dragEvent.dataTransfer));
      expect(this.cmb.getValue().replace(/\s+/, ' ')).toBe('(+ 1 3)');
      console.log('%%%%%%%%%%%%%%%% 9');
    });

    /*
    it('should support dragging plain text to replace a literal 10', function() {
      console.log('################ 10');
      let dragEvent = dragstart();
      dragEvent.dataTransfer.setData('text/plain', '5000');
      this.firstArg.element.dispatchEvent(drop(dragEvent.dataTransfer));
      expect(this.cmb.getValue().replace(/\s+/, ' ')).toBe('(+ 5000 2 3)');
      console.log('%%%%%%%%%%%%%%%% 10');
    });

    it('should support dragging plain text onto some whitespace 11', function() {
      console.log('################ 11');
      let dragEvent = dragstart();
      dragEvent.dataTransfer.setData('text/plain', '5000');
      let dropEvent = drop(dragEvent.dataTransfer);
      let nodeEl = this.blocks.getAst().rootNodes[0].element;
      let wrapperEl = this.cm.getWrapperElement();
      dropEvent.pageX = wrapperEl.offsetLeft + wrapperEl.offsetWidth - 10;
      dropEvent.pageY = nodeEl.offsetTop + wrapperEl.offsetHeight - 10;
      nodeEl.parentElement.dispatchEvent(dropEvent);
      expect(this.cmb.getValue().replace('  ', ' ')).toBe('(+ 1 2 3)\n5000');
      console.log('%%%%%%%%%%%%%%%% 11');
    });
    */
  });
});
