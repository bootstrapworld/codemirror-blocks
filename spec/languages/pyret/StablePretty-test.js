import CodeMirrorBlocks from '../../../src/CodeMirrorBlocks';
import pyret from '../../../src/languages/pyret';
import {store} from '../../../src/store';
import 'codemirror/addon/search/searchcursor.js';

import {
  _click,
  _doubleClick,
  _blur,
  keyDown,
  insertText,
} from '../../support/simulate';

import {_wait, cleanupAfterTest} from '../../support/test-utils';

// ms delay to let the DOM catch up before testing
const DELAY = 500;

describe('The CodeMirrorBlocks Class', function() {
  beforeEach(function() {
    const fixture = `
      <div id="root">
        <div id="cmb-editor" class="editor-container"/>
      </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', fixture);
    const container = document.getElementById('cmb-editor');
    this.blocks = new CodeMirrorBlocks(container, {value: ""}, pyret);
    this.blocks.setBlockMode(true);
  });

  afterEach(function() {
    cleanupAfterTest('root', store);
  });

  describe('testing method', function() {
    it("pretty-ify non-pretty text", function() {
      this.blocks.setBlockMode(false);
      this.blocks.setCursor({ line: 0, ch: 0 });
      let insert = "fun f(x):\n  x + 3\nend";
      keyDown("9", {}, this.blocks.getInputField());
      insertText(insert);
      expect(this.blocks.getBlockMode()).toBe(false);
      expect(this.blocks.getValue()).toBe(insert);
      this.blocks.setBlockMode(true);
      // see if pretty-printed now
      expect(this.blocks.getValue()).not.toBe(insert);
      expect(this.blocks.getValue()).toBe("fun f(x): x + 3 end");
    });
  });

  describe('small DS programs', function() {
    beforeEach(async function() {
      this.blocks.setBlockMode(true);
      this.blocks.setValue("");
      await DELAY;
    });

    let testify = function (text, name = text, already_pretty = true) {
      return it(name, async function() {
        this.blocks.setCursor({ line: 0, ch: 0 });
        keyDown("9", {}, this.blocks.getInputField());
        insertText(text);
        await DELAY;

        this.blocks.setBlockMode(false);
        await DELAY;
        // sometimes this is true???
        expect(this.blocks.getBlockMode()).toBe(false);
        if (already_pretty) {
          expect(this.blocks.getValue()).toEqual(text);
        }
        else {
          expect(this.blocks.getValue()).not.toEqual(text);
        }
      });
    };

    let format = function(text, name = text) {
      testify(text, "pretty-print " + name, false);
    };

    testify(`load-spreadsheet("14er5Mh443Lb5SIFxXZHdAnLCuQZaA8O6qtgGlibQuEg")`);
    testify(`load-table: nth, name, home-state, year-started, year-ended, party
  source: presidents-sheet.sheet-by-name("presidents", true)
end`);
    testify(`x = 3`);
    testify(`x = true`);
    testify(`data-type = "string"`);
    testify(`3 + 5`);
    testify(`3 - 5`);
    testify(`"hello" + ", there"`);
    testify("fun f(x): x + 3 end");
    testify(`fun f(x, jake): x + 3 end`);
    testify(`fun f(x, jake): x + jake + 3 end`);
    testify(`fun g(): 2 * 4 end`);
    testify('f(5)');
    testify('f(5, 4)');
    testify('f()');
    testify(`x.len()`);
    testify(`l.len()`);
    testify(`x.len(3)`);
    testify(`x.len(3, 4)`);
    testify(`3 + 4 is 7`);
    testify(`check: 3 + 5 is 8 end`);
    testify(`check: 3 + 4 end`);
    format('{1;2}');
    testify('{1; 2}');
    testify('{1}');
    testify('[list: 1, 2, 3]');
    testify('[list: ]');
    format('[list:]');
    testify('row["field"]');
    testify('row[""]');
    testify('row["three word column"]');
    testify(`fun img(animal):
  ask:
    | (animal["species"] == "dog") then: dog-img
    | (animal["species"] == "cat") then: cat-img
    | (animal["species"] == "rabbit") then: rabbit-img
    | (animal["species"] == "tarantula") then: tarantula-img
    | (animal["species"] == "lizard") then: lizard-img
  end
end`);
  });

  describe("larger pyret programs", function() {
    beforeEach(async function () {
      this.blocks.setBlockMode(true);
      this.blocks.setValue("");
      await DELAY;
    });

    it("blocky function", async function() {
      let text = `fun f(x) block:
  print(x)
  x + 3
end`;
      this.blocks.setValue(text);
      this.blocks.setBlockMode(false);
      await DELAY;
      expect(this.blocks.getValue()).toEqual(text);
    });
  });
});
