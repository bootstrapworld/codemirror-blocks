import CodeMirrorBlocks from '../src/CodeMirrorBlocks';
import wescheme from '../src/languages/wescheme';
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
} from './events';

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

import {wait} from './test-utils';

const TOGGLE_SELECTION_KEYPRESS =
      keydown(SPACE, ISMAC ? {altKey: true} : {ctrlKey: true});
const PRESERVE_NEXT_KEYPRESS =
      keydown(DOWN, ISMAC ? {altKey: true} : {ctrlKey: true});
const PRESERVE_PREV_KEYPRESS =
      keydown(UP, ISMAC ? {altKey: true} : {ctrlKey: true});

// ms delay to let the DOM catch up before testing
const DELAY = 1500;
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
    this.blocks = new CodeMirrorBlocks(container, wescheme, "");
    this.blocks.handleToggle(true);
  });

  afterEach(function() {
    document.body.removeChild(document.getElementById('root'));
  });


  describe('constructor,', function() {

    it("should create an empty editor", async function() {
      this.state = this.blocks.getState();
      expect(this.blocks.blockMode).toBe(true);
      expect(this.state.ast.rootNodes.length).toBe(0);
      expect(this.state.collapsedList.length).toBe(0);
      expect(this.state.cur).toBe(null);
      expect(this.state.errorId).toBe("");
      expect(this.state.focusId).toBe(-1);
      expect(this.state.quarantine).toBe(null);
      expect(this.state.selections.length).toBe(0);
    });

    it("should set block mode to false", function() {
      this.blocks.handleToggle(false);
      expect(this.blocks.blockMode).toBe(false);
    });
  });


  describe('events,',  function() {
    beforeEach(async function() {
      this.blocks.setValue('11');
      await wait(DELAY);
      this.state = this.blocks.getState();
      this.literal = this.state.ast.rootNodes[0];
    });

    describe("when dealing with node activation,", function() {

      beforeEach(async function() {
        this.blocks.setValue('11 54');
        await wait(DELAY);
        this.state = this.blocks.getState();
        this.literal = this.state.ast.rootNodes[0];
        this.literal2 = this.state.ast.rootNodes[1];
      });

      it('should only allow one node to be active at a time', function() {
        this.literal.element.dispatchEvent(click());
        this.literal2.element.dispatchEvent(click());
        expect(this.state.focusId).not.toBe(0);
        expect(this.state.focusId).toBe(1);
      });
    });

  });
});