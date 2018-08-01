import CodeMirrorBlocks, {BlockMarker} from 'codemirror-blocks/blocks';
import CodeMirror from 'codemirror';
import 'codemirror/addon/search/searchcursor.js';
import ExampleParser from 'codemirror-blocks/languages/example/ExampleParser';
import {addLanguage} from 'codemirror-blocks/languages';
import {ISMAC} from 'codemirror-blocks/keymap';

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

// keycodes
const LEFT_KEY  = 37;
const UP_KEY    = 38;
const RIGHT_KEY = 39;
const DOWN_KEY  = 40;
const DELETE_KEY=  8;
const ENTER_KEY = 13;
const SPACE_KEY = 32;
const HOME_KEY  = 36;
const END_KEY   = 35;
const ESC_KEY   = 27;
const LEFTBRACE = 219;
const RIGHTBRACE= 221;
const Z_KEY     = 90;

const TOGGLE_SELECTION_KEYPRESS =
  keydown(SPACE_KEY, ISMAC? {altKey: true} : {ctrlKey: true});
const PRESERVE_NEXT_KEYPRESS =
  keydown(DOWN_KEY, ISMAC? {altKey: true} : {ctrlKey: true});
const PRESERVE_PREV_KEYPRESS =
  keydown(UP_KEY, ISMAC? {altKey: true} : {ctrlKey: true});


// ms delay to let the DOM catch up before testing
const DELAY = 750;

describe('The CodeMirrorBlocks Class', function() {
  beforeEach(function() {
    document.body.innerHTML = `
      <textarea id="code"></textarea>
      <div id="toolbar"></div>
    `;
    this.cm = CodeMirror.fromTextArea(document.getElementById("code"));
    this.parser = new ExampleParser();
    this.willInsertNode = (sourceNodeText, sourceNode, destination) => {
      let line = this.cm.getLine(destination.line);
      let prev = line[destination.ch - 1] || '\n';
      let next = line[destination.ch] || '\n';
      sourceNodeText = sourceNodeText.trim();
      if (!/\s|[([{]/.test(prev)) {
        sourceNodeText = ' ' + sourceNodeText;
      }
      if (!/\s|[)]}]/.test(next)) {
        sourceNodeText += ' ';
      }
      return sourceNodeText;
    };

    this.didInsertNode = function() {};
    this.blocks = new CodeMirrorBlocks(
      this.cm,
      this.parser,
      {
        willInsertNode: this.willInsertNode,
        didInsertNode: this.didInsertNode,
        toolbar: document.getElementById('toolbar')
      }
    );
    this.trackQuarantine   = spyOn(this.blocks, 'insertionQuarantine').and.callThrough();
    this.trackHandleChange = spyOn(this.blocks,        'handleChange').and.callThrough();
    this.trackReplaceRange = spyOn(this.cm,            'replaceRange').and.callThrough();
    this.trackEditLiteral  = spyOn(this.blocks,         'editLiteral').and.callThrough();
    this.trackSaveEdit     = spyOn(this.blocks,            'saveEdit').and.callThrough();
    this.trackCommitChange = spyOn(this.blocks,        'commitChange').and.callThrough();
    this.trackWillInsertNode=spyOn(this.blocks,      'willInsertNode').and.callThrough();
  });

  describe('events,', function() {
    beforeEach(function() {
      this.cm.setValue('11');
      this.blocks.setBlockMode(true);
      this.literal = this.blocks.ast.rootNodes[0];
    });

    describe('when dealing with whitespace,', function() {
      beforeEach(function() {
        this.cm.setValue('(+ 1 2) (+)');
        this.firstRoot = this.blocks.ast.rootNodes[0];
        this.firstArg = this.blocks.ast.rootNodes[0].args[0];
        this.whiteSpaceEl = this.firstArg.el.nextElementSibling;
        this.blank = this.blocks.ast.rootNodes[1];
        this.blankWS = this.blank.el.querySelectorAll('.blocks-white-space')[0];
      });

      describe('and specifically when editing it,', function() {
        it('should save whiteSpace on blur', function(done) {
          this.whiteSpaceEl.dispatchEvent(dblclick());
          let enter = keydown(ENTER_KEY);
          setTimeout(() => {
            expect(this.trackQuarantine).toHaveBeenCalledWith("", this.whiteSpaceEl, jasmine.anything());
            let quarantineNode = this.trackQuarantine.calls.mostRecent().returnValue;
            expect(this.trackEditLiteral).toHaveBeenCalledWith(quarantineNode);
            let quarantine = quarantineNode.el;
            //let trackOnBlur = spyOn(quarantine, 'onblur').and.callThrough();
            let trackEditkey = spyOn(this.blocks, 'handleEditKeyDown').and.callThrough();
            quarantine.appendChild(document.createTextNode('4253'));
            quarantine.dispatchEvent(enter);
            expect(trackEditkey).toHaveBeenCalledWith(quarantineNode, quarantine, enter);
            //expect(trackOnBlur).toHaveBeenCalledWith();
            expect(this.trackSaveEdit).toHaveBeenCalledWith(quarantineNode, quarantine, jasmine.anything());
            expect(quarantine.textContent).toBe('4253'); // sets text to 4253 inside saveEdit
            expect(this.trackWillInsertNode).toHaveBeenCalledWith('4253', quarantine, Object({ ch: 4, line: 0 }), Object({ ch: 4, line: 0 }));
            expect(this.trackCommitChange).toHaveBeenCalled();
            expect(this.trackReplaceRange).toHaveBeenCalledWith(' 4253', Object({ ch: 4, line: 0 }), Object({ ch: 4, line: 0 }));
            expect(this.cm.getValue()).toBe('(+ 1 4253 2) (+)');
            expect(this.blocks.hasInvalidEdit).toBe(false);
            expect(this.trackSaveEdit).toHaveBeenCalledTimes(1);
            done();
          }, DELAY);
        });
        
        describe('when "saving" bad whitepspace inputs,', function() {
          beforeEach(function(done) {
            this.whiteSpaceEl.dispatchEvent(dblclick());
            setTimeout(() => {
              this.quarantineNode = this.trackQuarantine.calls.mostRecent().returnValue;
              this.quarantine = this.quarantineNode.el;
              expect(this.trackEditLiteral).toHaveBeenCalledWith(this.quarantineNode);
              this.quarantine.appendChild(document.createTextNode('"moo'));
              this.quarantine.dispatchEvent(blur());
              done();
            }, DELAY);
          });

          it('should not save anything & set all error state', function(done) {
            setTimeout(() => {
              expect(this.trackSaveEdit).toHaveBeenCalledWith(this.quarantineNode, this.quarantine, jasmine.anything());
              expect(this.quarantine.textContent).toBe('"moo');
              expect(this.cm.replaceRange).not.toHaveBeenCalled();
              expect(this.quarantine.classList).toContain('blocks-error');
              expect(this.quarantine.title).toBe('Error: parse error');
              expect(this.blocks.hasInvalidEdit).toBe(true);
              done();
            }, DELAY);
          });
        });
        
      });    
    });
  });
});
