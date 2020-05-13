import wescheme from '../src/languages/wescheme';
import 'codemirror/addon/search/searchcursor.js';
/* eslint-disable */ //temporary
import {wait, teardown, activationSetup} from './support/test-utils';

import {
  dragstart,
  drop,
  dragenter,
  dragleave
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
        this.dropTargetEls = this.cmb.getAst().rootNodes[0].element.querySelectorAll(
          '.blocks-drop-target'
        );
      };
      this.retrieve();
    });

    it('should override nodes', function() {
      expect(this.secondArg.element.innerText).toBe('2');
      dragstart(this.firstArg);
      drop(this.secondArg);
      this.retrieve();
      expect(this.secondArg.element.innerText).toBe('3');
    });

    it('should set the right css class on dragenter', function() {
     
      //original 
      //which was commented and wouldn't have worked without a defn of dragenter anyway:
      //
      //this.dropTargetEls[3].dispatchEvent(dragenter());
      //expect(this.dropTargetEls[3].classList).toContain('blocks-over-target');


      //ds26gte try, after suitable defns in simulate.js

      let elt = this.dropTargetEls[3];
      expect(elt.classList).toContain('blocks-drop-target');
      console.log('dragenter started'); // can't spot it in log
      dragenter(elt); // causes hang
      console.log('dragenter done');
      // FIXME: The following causes error!
      //expect(elt.classList).toContain('blocks-over-target');

    });

      /*
    it('should set the right css class on dragleave', function() {
      this.dropTargetEls[3].dispatchEvent(dragenter());
      this.dropTargetEls[3].dispatchEvent(dragleave());
      expect(this.dropTargetEls[3].classList).not.toContain('blocks-over-target');
    });
    */

      /*
    it('should do nothing when dragging over a non-drop target', function() {
      this.blocks.getAst().rootNodes[0].element.dispatchEvent(dragenter());
      expect(this.blocks.getAst().rootNodes[0].element.classList).not.toContain('blocks-over-target');
    });

    it('should do nothing when dropping onto a non-drop target', function() {
      let dragEvent = dragstart();
      this.firstArg.element.dispatchEvent(dragEvent);
      var initialValue = this.cm.getValue();
      this.blocks.getAst().rootNodes[0].element.dispatchEvent(drop(dragEvent.dataTransfer));
      expect(this.cm.getValue()).toBe(initialValue);
    });

    it('should update the text on drop to a later point in the file', function() {
      expect(this.dropTargetEls[4].classList).toContain('blocks-drop-target');
      // drag the first arg to the drop target
      let dragEvent = dragstart();
      this.firstArg.element.dispatchEvent(dragEvent);
      this.dropTargetEls[4].dispatchEvent(drop(dragEvent.dataTransfer));
      expect(this.cm.getValue().replace(/\s+/, ' ')).toBe('(+ 2 1 3)');
    });

    it('should update the text on drop to an earlier point in the file', function() {
      let dragEvent = dragstart();
      this.secondArg.element.dispatchEvent(dragEvent);
      this.dropTargetEls[1].dispatchEvent(drop(dragEvent.dataTransfer));
      expect(this.cm.getValue().replace('  ', ' ')).toBe('(+ 2 1 3)');
    });

    it('should move an item to the top level when dragged outside a node', function() {
      let dragEvent = dragstart();
      this.secondArg.element.dispatchEvent(dragEvent);
      let dropEvent = drop(dragEvent.dataTransfer);
      let nodeEl = this.blocks.getAst().rootNodes[0].element;
      let wrapperEl = this.cm.getWrapperElement();
      dropEvent.pageX = wrapperEl.offsetLeft + wrapperEl.offsetWidth - 10;
      dropEvent.pageY = nodeEl.offsetTop + wrapperEl.offsetHeight - 10;
      nodeEl.parentElement.dispatchEvent(dropEvent);
      expect(this.cm.getValue().replace('  ', ' ')).toBe('(+ 1 3) 2');
    });

    it('should replace a literal that you drag onto', function() {
      let dragEvent = dragstart();
      this.firstArg.element.dispatchEvent(dragEvent);
      this.secondArg.element.dispatchEvent(drop(dragEvent.dataTransfer));
      expect(this.cm.getValue().replace(/\s+/, ' ')).toBe('(+ 1 3)');
    });

    it('should support dragging plain text to replace a literal', function() {
      let dragEvent = dragstart();
      dragEvent.dataTransfer.setData('text/plain', '5000');
      this.firstArg.element.dispatchEvent(drop(dragEvent.dataTransfer));
      expect(this.cm.getValue().replace(/\s+/, ' ')).toBe('(+ 5000 2 3)');
    });

    it('should support dragging plain text onto some whitespace', function() {
      let dragEvent = dragstart();
      dragEvent.dataTransfer.setData('text/plain', '5000');
      let dropEvent = drop(dragEvent.dataTransfer);
      let nodeEl = this.blocks.getAst().rootNodes[0].element;
      let wrapperEl = this.cm.getWrapperElement();
      dropEvent.pageX = wrapperEl.offsetLeft + wrapperEl.offsetWidth - 10;
      dropEvent.pageY = nodeEl.offsetTop + wrapperEl.offsetHeight - 10;
      nodeEl.parentElement.dispatchEvent(dropEvent);
      expect(this.cm.getValue().replace('  ', ' ')).toBe('(+ 1 2 3)\n5000');
    });
    */
  });
});
