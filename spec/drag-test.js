import CodeMirrorBlocks from '../src/CodeMirrorBlocks';
import wescheme from '../src/languages/wescheme';
import 'codemirror/addon/search/searchcursor.js';
/* eslint-disable */ //temporary
import {
  click,
  dblclick,
  blur,
  keydown,
  keypress,
  dragstart,
  dragenter,
  dragleave,
  drop,
  cut,
} from './support/events';

import {
  LEFT,
  UP,
  RIGHT,
  DOWN,
  LESS_THAN,
  DELETE,
  ENTER,
  SPACE,
  HOME,
  END,
  ESC,
  LEFTBRACKET,
  RIGHTBRACKET,
  ISMAC,
  DKEY,
} from 'codemirror-blocks/keycode';

import {wait} from './support/test-utils';

const TOGGLE_SELECTION_KEYPRESS =
      keydown(SPACE, ISMAC ? {altKey: true} : {ctrlKey: true});
const PRESERVE_NEXT_KEYPRESS =
      keydown(DOWN, ISMAC ? {altKey: true} : {ctrlKey: true});
const PRESERVE_PREV_KEYPRESS =
      keydown(UP, ISMAC ? {altKey: true} : {ctrlKey: true});

// ms delay to let the DOM catch up before testing
const DELAY = 750;
/* eslint-enable */ //temporary

describe('The CodeMirrorBlocks Class', function() {
  beforeEach(function() {
    const fixture = `
      <div id="root">
        <div id="cmb-editor" class="editor-container"/>
      </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', fixture);
    const container = document.getElementById('cmb-editor');
    this.cmb = new CodeMirrorBlocks(container, {}, wescheme, "");
    this.blocks = this.cmb.blocks;
    this.cm = this.cmb.cm;
    this.blocks.setBlockMode(true);
  });

  afterEach(function() {
    const root = document.getElementById('root');
    if (root)
      root.parentNode.removeChild(root);

    const portals = document.getElementsByClassName("ReactModalPortal");
    while (portals[0]) {
      const current = portals[0];
      current.parentNode.removeChild(current);
    }
    
    const textareas = document.getElementsByTagName("textarea");
    while (textareas[0]) {
      const current = textareas[0];
      current.parentNode.removeChild(current);
    }
  });
/*
  describe('when dealing with dragging,', function() {
    beforeEach(function() {
      this.cm.setValue('(+ 1 2 3)');
      this.funcSymbol = this.blocks.getAst().rootNodes[0].func;
      this.firstArg = this.blocks.getAst().rootNodes[0].args[0];
      this.secondArg = this.blocks.getAst().rootNodes[0].args[1];
      this.dropTargetEls = this.blocks.getAst().rootNodes[0].element.querySelectorAll(
        '.blocks-drop-target'
      );
    });

    it('should set the right drag data on dragstart', function() {
      this.firstArg.element.dispatchEvent(dragstart());
      expect(this.firstArg.element.classList).toContain('blocks-dragging');
    });

    it('should set the right css class on dragenter', function() {
      this.dropTargetEls[3].dispatchEvent(dragenter());
      expect(this.dropTargetEls[3].classList).toContain('blocks-over-target');
    });

    it('should set the right css class on dragleave', function() {
      this.dropTargetEls[3].dispatchEvent(dragenter());
      this.dropTargetEls[3].dispatchEvent(dragleave());
      expect(this.dropTargetEls[3].classList).not.toContain('blocks-over-target');
    });

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
  });
*/
});