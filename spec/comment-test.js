import wescheme from '../src/languages/wescheme';

/*eslint no-unused-vars: "off"*/
import {
  mac, cmd_ctrl, DELAY, wait, removeEventListeners, teardown, activationSetup,
  click, mouseDown, mouseenter, mouseover, mouseleave, doubleClick, blur, 
  paste, cut, copy, dragstart, dragover, drop, dragenter, dragenterSeq, 
  dragend, dragleave, keyDown, keyPress, insertText
} from '../spec/support/test-utils';

// be sure to call with `apply` or `call`
let setup = function () { activationSetup.call(this, wescheme); };

describe('When editing and moving commented nodes', function() {
  beforeEach(function() {
    setup.call(this);
  });

  afterEach(function () { teardown(); });

  describe('cut and paste', function() {
    beforeEach(async function() {
      await wait(DELAY);
      this.cmb.setValue(`
(comment free)
1; comment1
#| comment2 |#
2`);
      this.cmb.setBlockMode(true);
      await wait(DELAY);
      let ast = this.cmb.getAst();
      this.expr0 = ast.rootNodes[0];
      this.expr1 = ast.rootNodes[1];
      this.expr2 = ast.rootNodes[2];
    });

    it('when the mode is toggled, it should reformat all comments as block comments', async function() {
      this.cmb.setBlockMode(false);
      await wait(DELAY);
      // the opening whitespace should be removed!
      expect(this.cmb.getValue()).toBe(`(comment free)
1 #| comment1 |#
#| comment2 |#
2`);
    });
/*        
    it('you should be able to insert a commented node after a commented node', async function() {
      this.cmb.setQuarantine({line: 3, ch: 1}, {line: 3, ch: 1}, "1 #| comment1 |#");
      await wait(DELAY);
      keyDown("Enter");
      await wait(DELAY);
      expect(this.cmb.getValue()).toBe(`(comment free)
1 #| comment1 |#
#| comment2 |#
2
1 #| comment1 |#`);
    });

    it('you should be able to insert a commented node after an uncommented node', async function() {
      this.cmb.setQuarantine({line: 0, ch: 14}, {line: 0, ch: 14}, "1 #| comment1 |#");
      await wait(DELAY);
      keyDown("Enter");
      await wait(DELAY);
      expect(this.cmb.getValue()).toBe(`(comment free)
1 #| comment1 |#
1 #| comment1 |#
#| comment2 |#
2`);
    });
*/       
  });
});
