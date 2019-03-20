import CodeMirrorBlocks from '../src/CodeMirrorBlocks';
import wescheme from '../src/languages/wescheme';
import {store} from '../src/store';
import {
  click,
  keyDown,
  insertText,
  paste
} from './support/simulate';
import {wait, cleanupAfterTest} from './support/test-utils';
import SHARED from '../src/shared';


/* 
 * # Comment Testing
 *
 * When editing blocks, it is important that after the edit (and thus after the
 * document is re-parsed), all comments are still attached to the same nodes,
 * and all tokens are still distinct (e.g., if you draw `3` after `2`, you
 * should get `2 3` and not `23`). This is achieved by judiciously injecting
 * whitespace in all of the right places. Ideally, whitespace will be inserted
 * _only_ where required, but in practice we are sometimes too conservative and
 * inject uneeded whitespace.
 *
 * The major set of cases to consider when checking if this whitespace
 * injection is being done well have this form:
 *
 *     <action> a <block>, and <action> it to the <side> of a <block>
 *
 * where the two <action>s are one of:
 * 1. DRAG and DROP
 * 2. COPY and PASTE
 * 3. CUT and PASTE
 * 
 * and each <block> is one of:
 * 1. An uncommented node
 * 2. A commented node, with the comment before the node (e.g. `#|c|#\n42`).
 * 3. A commented node, with the comment after the node (e.g. `42 #|c|#`).
 *
 * and <side> is one of:
 * 1. Left
 * 2. Right
 *
 * This gives a total of 3*3*3*2 = 54 cases to consider.
 *
 * In addition, multiple blocks can be cut, copied, or dragged at once, and it
 * is important that _their_ comments do not move _among each other_. For this,
 * it should be sufficient to consider the 3*3=9 ways to copy two blocks of any
 * of the 3 kinds.
 * 
 * Ultimately, these cases (or a representative subset of them) should be tested
 * in this file. Currently, the testing infrastructure doesn't work around this
 * and needs to be debugged. In the meantime, I have manually checked the 54+9
 * cases listed here, and found that:
 * 
 * [FILL] [FILL ME WITH HOW IT WENT] [DONT COMMIT THIS AS IT IS JUSTIN]
 */


// ms delay to let the DOM catch up before testing
const DELAY = 500;

describe('When editing and moving commented nodes', function() {
  beforeEach(function() {
    const fixture = `
      <div id="root">
        <div id="cmb-editor" class="editor-container"/>
      </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', fixture);
    const container = document.getElementById('cmb-editor');
    this.cmb = new CodeMirrorBlocks(container, wescheme, "");
    this.cmb.setBlockMode(true);
  });

  afterEach(function() {
    cleanupAfterTest('root', store);
  });

  describe('cut and paste', function() {
    beforeEach(async function() {
      this.cmb.setValue(`
(comment free)
1; comment1
#| comment2 |#
2`);
      await wait(DELAY);
      this.expr0 = this.cmb.getAst().rootNodes[0];
      this.expr1 = this.cmb.getAst().rootNodes[1];
      this.expr2 = this.cmb.getAst().rootNodes[2];
    });

    it('when the mode is toggled, it should reformat all comments as block comments', async function() {
      this.cmb.setBlockMode(false);
      await wait(DELAY);
      // Why the lack of newline?
      expect(this.cmb.getValue()).toBe(`(comment free)
1 #| comment1 |#
#| comment2 |#
2`);
    });

    it('you should be able to paste a commented node after a commented node', async function() {
      click(this.expr1);
      keyDown(" ", {}, this.expr1);
      await wait(DELAY);
      keyDown("X", {ctrlKey: true}, this.expr1);
      await wait(DELAY);
      expect(this.cmb.getValue()).toBe(`
(comment free)

#| comment2 |#
2`);
      this.cmb.setCursor({line: 4, ch: 1});
      await wait(DELAY);
      paste();
      await wait(DELAY);
      keyDown("Enter");
      await wait(DELAY);
      // It would be nice to eliminate the extra newline about the 1.
      // It's there due to an abundance of caution, but isn't needed.
      expect(this.cmb.getValue()).toBe(`
(comment free)

#| comment2 |#
2

1 #| comment1 |#`);
    });

    it('you should be able to paste a commented node after an uncommented node', async function() {
      click(this.expr2);
      keyDown(" ", {}, this.expr2);
      await wait(DELAY);
      keyDown("X", {ctrlKey: true}, this.expr2);
      await wait(DELAY);
      this.cmb.setCursor({line: 1, ch: 14});
      await wait(DELAY);
      paste();
      await wait(DELAY);
      keyDown("Enter");
      await wait(DELAY);
      expect(this.cmb.getValue()).toBe(`
(comment free) 
#| comment2 |#
2
1; comment1
`);
    });
  });
});
