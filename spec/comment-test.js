import wescheme from '../src/languages/wescheme';
import {
  click,
  keyDown,
  insertText,
} from './support/simulate';
import { wait, teardown, activationSetup } from './support/test-utils';


// ms delay to let the DOM catch up before testing
const DELAY = 500;

// be sure to call with `apply` or `call`
let setup = function () { activationSetup.call(this, wescheme); };

describe('When editing and moving commented nodes', function() {
  beforeEach(function() {
    setup.call(this);
  });

  afterEach(function () { teardown(); });

  describe('cut and paste', function() {
    beforeEach(async function() {
      this.cmb.setValue(`
(comment free)
1; comment1
#| comment2 |#
2`);
      await wait(DELAY); // wait for rootNodes to incrementally render
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
    /*
    // TODO(Emmanuel): figure out an alternative mechanism for paste operations.
    // maybe simulated drag events?
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
      keyDown("V", { ctrlKey: true }, this.literal1);
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
      keyDown("V", { ctrlKey: true }, this.literal1);
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
    */
  });
});
