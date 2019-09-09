import CodeMirrorBlocks from '../../../src/CodeMirrorBlocks';
import pyret from '../../../src/languages/pyret';
import 'codemirror/addon/search/searchcursor.js';
import { wait, teardown, activationSetup } from '../../support/test-utils';
import {
  _keyPress,
  _insertText,
} from '../../support/simulate';

const DELAY = 250;

// be sure to call with `apply` or `call`
let setup = function () { activationSetup.call(this, pyret); };


/** //////////////////////////////////////////////////////////
 * Specific navigation tests for programs that use BSDS constructs below
 */

describe("functions", function () {
  let test = function (text) {
    describe(text, function () {
      beforeEach(function () {
        setup.call(this);
        this.cmb.setValue(text);
        let ast = this.cmb.getAst();
        this.literal1 = ast.rootNodes[0];
        this.fun_name = this.literal1.name;
        this.args = this.literal1.args;
        this.body = this.literal1.body;
      });

      afterEach(function () { teardown(); });

      it("should have a white background for fun name", function () {
        // console.log("FUNNAME", this.fun_name);
        // expect(this.fun_name.style.background).toEqual('white');
      });
    });
  };
  test("fun f(x): x + 3 end");
  test("fun f(x, jake): x + jake end");
  test("fun g(): 2 * 4 end");
});