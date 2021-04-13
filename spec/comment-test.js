import wescheme from '../src/languages/wescheme';
import { wait, teardown, activationSetup } from './support/test-utils';
import { mouseDown, click, keyDown, insertText, paste, cut } from './support/simulate';
// figure out what platform we're running on
const userAgent = navigator.userAgent;
const platform = navigator.platform;
const edge = /Edge\/(\d+)/.exec(userAgent);
const ios = !edge && /AppleWebKit/.test(userAgent) && /Mobile\/\w+/.test(userAgent);
const mac = ios || /Mac/.test(platform);
// set key options appropriately for the platform
const cmd = { metaKey: true };
const ctrl = { ctrlKey: true };

const DELAY = 250;

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
      await wait(DELAY);
      let ast = this.cmb.getAst();
      this.expr0 = ast.rootNodes[0];
      this.expr1 = ast.rootNodes[1];
      this.expr2 = ast.rootNodes[2];
      this.cmb.setBlockMode(true);
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

    // TODO(Emmanuel): figure out an alternative mechanism for paste operations.
    // maybe simulated drag events?
    fit('you should be able to paste a commented node after a commented node', async function() {
      await wait(DELAY);
      mouseDown(this.expr1);
      keyDown(" ", {}, this.expr1);
      await wait(DELAY);
      keyDown("X", mac? cmd : ctrl, this.literal1);
      await wait(DELAY);
      expect(this.cmb.getValue()).toBe(`(comment free)

#| comment2 |#
2`);
      this.cmb.setCursor({line: 10, ch: 0}); // click way down below the code
      await wait(DELAY);
      const {line, ch} = this.cmb.getCursor();
      expect({line, ch}).toEqual({line: 3, ch: 1}); // cursor should be at the end
      paste('1 #| comment1 |#');
      await wait(DELAY);
      expect(this.cmb.getValue()).toBe(`(comment free)

#| comment2 |#
2
1 #| comment1 |#`);
    });
/*
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
