import CodeMirrorBlocks from '../../../src/CodeMirrorBlocks';
import pyret from '../../../src/languages/pyret';
import 'codemirror/addon/search/searchcursor.js';
import { store } from '../../../src/store';
import { wait, cleanupAfterTest } from '../../support/test-utils';
import {
  click,
  keyDown,
  keyPress,
  insertText,
} from '../../support/simulate';

const DELAY = 250;

describe('The CodeMirrorBlocks Class', function () {
  beforeEach(function () {
    const fixture = `
      <div id="root">
        <div id="cmb-editor" class="editor-container"/>
      </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', fixture);
    const container = document.getElementById('cmb-editor');
    this.cmb = new CodeMirrorBlocks(container, { collapseAll: false, value: "" }, pyret);
    this.cmb.setBlockMode(true);

    this.activeNode = () => this.cmb.getFocusedNode();
    this.activeAriaId = () =>
      this.cmb.getScrollerElement().getAttribute('aria-activedescendent');
    this.selectedNodes = () => this.cmb.getSelectedNodes();
  });

  afterEach(function () {
    cleanupAfterTest('root', store);
  });

  /** //////////////////////////////////////////////////////////
   * Specific navigation tests for programs that use BSDS constructs below
   */
  describe("load-spreadsheet", function () {
    beforeEach(function () {
      this.cmb.setValue('load-spreadsheet("14er5Mh443Lb5SIFxXZHdAnLCuQZaA8O6qtgGlibQuEg")');
      let ast = this.cmb.getAst();
      this.literal1 = ast.rootNodes[0];
    });

    it('should activate load-spreadsheet and then url when down is pressed', async function () {
      click(this.literal1);
      await wait(DELAY);
      keyDown("ArrowDown");
      await wait(DELAY);
      expect(this.activeNode()).not.toBe(this.literal1);
      expect(this.activeNode()).toBe(this.literal1.func);
      expect(this.activeNode()).not.toBe(this.literal1.args);

      keyDown("ArrowDown");
      await wait(DELAY);
      expect(this.activeNode()).not.toBe(this.literal1);
      expect(this.activeNode()).not.toBe(this.literal1.func);
      expect(this.activeNode()).toBe(this.literal1.args[0]);
    });
  });

  describe("load-table", function () {
    beforeEach(function () {
      this.cmb.setValue(`load-table: nth, name, home-state
  source: presidents-sheet.sheet-by-name("presidents", true)
end`);
      let ast = this.cmb.getAst();
      this.literal1 = ast.rootNodes[0];
    });

    it('should activate the column names and then sources when down is pressed', async function () {
      click(this.literal1);
      await wait(DELAY);

      keyDown("ArrowDown");
      await wait(DELAY);
      expect(this.activeNode()).not.toBe(this.literal1);
      expect(this.activeNode()).toBe(this.literal1.rows[0]);
      expect(this.activeNode()).not.toBe(this.literal1.rhs);

      keyDown("ArrowDown");
      await wait(DELAY);
      expect(this.activeNode()).not.toBe(this.literal1);
      expect(this.activeNode()).toBe(this.literal1.rows[1]);
      expect(this.activeNode()).not.toBe(this.literal1.rhs);

      keyDown("ArrowDown");
      await wait(DELAY);
      expect(this.activeNode()).not.toBe(this.literal1);
      expect(this.activeNode()).toBe(this.literal1.rows[2]);
      expect(this.activeNode()).not.toBe(this.literal1.rhs);

      keyDown("ArrowDown");
      await wait(DELAY);
      expect(this.activeNode()).not.toBe(this.literal1);
      expect(this.activeNode()).toBe(this.literal1.sources[0]);
    });
  });

  describe("lets", function () {
    let test_let = function (text) {
      describe(text, function () {
        beforeEach(function () {
          this.cmb.setValue(text);
          let ast = this.cmb.getAst();
          this.literal1 = ast.rootNodes[0];
        });

        it('should activate the binding and then the rhs when down is pressed', async function () {
          click(this.literal1);
          await wait(DELAY);
          keyDown("ArrowDown");
          await wait(DELAY);
          expect(this.activeNode()).not.toBe(this.literal1);
          expect(this.activeNode()).toBe(this.literal1.ident);
          expect(this.activeNode()).not.toBe(this.literal1.rhs);

          keyDown("ArrowDown");
          await wait(DELAY);
          expect(this.activeNode()).not.toBe(this.literal1);
          expect(this.activeNode()).not.toBe(this.literal1.ident);
          expect(this.activeNode()).toBe(this.literal1.rhs);
        });
        });
    };
    test_let("x = 3");
    test_let("x = true");
    test_let(`data-type = "string"`);
  });

  describe("binops", function () {
    let test_binop = function (text) {
      describe(text, function () {
        beforeEach(function () {
          this.cmb.setValue(text);
          let ast = this.cmb.getAst();
          this.literal1 = ast.rootNodes[0];
          this.op = this.literal1.op;
          this.left = this.literal1.left;
          this.right = this.literal1.right;
        });

        it('should activate the operator, lhs, and rhs when down is pressed', async function () {
          click(this.literal1);
          await wait(DELAY);
          keyDown("ArrowDown");
          await wait(DELAY);
          expect(this.activeNode()).not.toBe(this.literal1);
          expect(this.activeNode()).toBe(this.op);
          expect(this.activeNode()).not.toBe(this.left);
          expect(this.activeNode()).not.toBe(this.right);

          keyDown("ArrowDown");
          await wait(DELAY);
          expect(this.activeNode()).not.toBe(this.literal1);
          expect(this.activeNode()).not.toBe(this.op);
          expect(this.activeNode()).toBe(this.left);
          expect(this.activeNode()).not.toBe(this.right);

          keyDown("ArrowDown");
          await wait(DELAY);
          expect(this.activeNode()).not.toBe(this.literal1);
          expect(this.activeNode()).not.toBe(this.op);
          expect(this.activeNode()).not.toBe(this.left);
          expect(this.activeNode()).toBe(this.right);
        });
      });
    };
    test_binop("3 + 5");
    test_binop("3 - 5");
    test_binop("3 * 5");
    test_binop("3 / 5");
    test_binop(`"hello" + ", there"`);
  });

  describe("functions", function () {
    let test = function (text) {
      it(text, async function () {
        this.cmb.setValue(text);
        let ast = this.cmb.getAst();
        this.literal1 = ast.rootNodes[0];
        this.fun_name = this.literal1.name;
        this.args = this.literal1.args;
        this.body = this.literal1.body;

        click(this.literal1);
        await wait(DELAY);

        keyDown("ArrowDown");
        await wait(DELAY);
        expect(this.activeNode()).not.toBe(this.literal1);
        expect(this.activeNode()).toBe(this.fun_name);
        expect(this.activeNode()).not.toBe(this.body);

        for (let i = 0; i < this.args.length; i++) {
          keyDown("ArrowDown");
          await wait(DELAY);
          expect(this.activeNode()).not.toBe(this.literal1);
          expect(this.activeNode()).not.toBe(this.fun_name);
          expect(this.activeNode()).toBe(this.args[i]);
          expect(this.activeNode()).not.toBe(this.body);
        }

        keyDown("ArrowDown");
        await wait(DELAY);
        expect(this.activeNode()).not.toBe(this.literal1);
        expect(this.activeNode()).not.toBe(this.fun_name);
        expect(this.activeNode()).toBe(this.body);
      });
    };
    test("fun f(x): x + 3 end");
    test("fun f(x, jake): x + jake end");
    test("fun g(): 2 * 4 end");
  });

  describe("method and function applications", function () {
    let test = function (text) {
      describe(text, function () {
        beforeEach(function () {
          this.cmb.setValue(text);
          let ast = this.cmb.getAst();
          this.literal1 = ast.rootNodes[0];
          this.func = this.literal1.func;
          this.args = this.literal1.args;
        });

        it('should activate the function and arguments when down is pressed', async function () {
          click(this.literal1);
          await wait(DELAY);
          keyDown("ArrowDown");
          await wait(DELAY);
          expect(this.activeNode()).not.toBe(this.literal1);
          expect(this.activeNode()).toBe(this.func);
          expect(this.activeNode()).not.toBe(this.args);

          for (let i = 0; i < this.args.length; i++) {
            keyDown("ArrowDown");
            await wait(DELAY);
            expect(this.activeNode()).not.toBe(this.literal1);
            expect(this.activeNode()).not.toBe(this.func);
            expect(this.activeNode()).toBe(this.args[i]);
          }
        });
      });
    };
    test('f(5)');
    test('f(5, 4)');
    test('f()');
    test(`x.len()`);
    test(`l.len()`);
    test(`x.len(3)`);
    test(`x.len(3, 4)`);
  });

  describe("checks and testing", function () {
    let test_binop = function (text) {
      describe(text, function () {
        beforeEach(function () {
          this.cmb.setValue(text);
          let ast = this.cmb.getAst();
          this.literal1 = ast.rootNodes[0];
          this.op = this.literal1.op;
          this.left = this.literal1.lhs;
          this.right = this.literal1.rhs;
        });

        it('should activate the operator, lhs, and rhs when down is pressed', async function () {
          click(this.literal1);
          await wait(DELAY);
          keyDown("ArrowDown");
          await wait(DELAY);
          expect(this.activeNode()).not.toBe(this.literal1);
          expect(this.activeNode()).toBe(this.op);
          expect(this.activeNode()).not.toBe(this.left);
          expect(this.activeNode()).not.toBe(this.right);

          keyDown("ArrowDown");
          await wait(DELAY);
          expect(this.activeNode()).not.toBe(this.literal1);
          expect(this.activeNode()).not.toBe(this.op);
          expect(this.activeNode()).toBe(this.left);
          expect(this.activeNode()).not.toBe(this.right);

          keyDown("ArrowDown");
          await wait(DELAY);
          expect(this.activeNode()).not.toBe(this.literal1);
          expect(this.activeNode()).not.toBe(this.op);
          expect(this.activeNode()).not.toBe(this.left);
          expect(this.activeNode()).toBe(this.right);
        });
      });
    };
    test_binop("7 is 7");

    let test = function (text) {
      describe(text, function () {
        beforeEach(function () {
          this.cmb.setValue(text);
          let ast = this.cmb.getAst();
          this.literal1 = ast.rootNodes[0];
          this.body = this.literal1.body;
        });

        it("should move to body", async function () {
          click(this.literal1);
          await wait(DELAY);
          keyDown("ArrowDown");
          await wait(DELAY);
          expect(this.activeNode()).not.toBe(this.literal1);
          expect(this.activeNode()).toBe(this.body);
        });
      })
    };

    test(`check: 3 + 5 is 8 end`);
    test(`check "arithmetic": 3 + 5 is 8 end`);
    test(`check: 3 + 4 end`);
  });

  describe("tuples", function () {
    let test = function (text) {
      describe(text, function () {
        beforeEach(function () {
          this.cmb.setValue(text);
          let ast = this.cmb.getAst();
          this.literal1 = ast.rootNodes[0];
          this.fields = this.literal1.fields;
        });

        it('should activate the arguments on each press', async function () {
          click(this.literal1);
          await wait(DELAY);
          expect(this.activeNode()).toBe(this.literal1);

          for (let i = 0; i < this.fields.length; i++) {
            keyDown("ArrowDown");
            await wait(DELAY);
            expect(this.activeNode()).not.toBe(this.literal1);
            expect(this.activeNode()).toBe(this.fields[i]);
          }
        });
      });
    };
    test('{1;2}');
    test('{1; 2}');
    test('{1; 2; 3}');
    test('{1}');

    describe("tuple-get", function () {
      beforeEach(function () {
        this.cmb.setValue("tupple.{0}");
        let ast = this.cmb.getAst();
        this.literal1 = ast.rootNodes[0];
        this.base = this.literal1.base;
        this.index = this.literal1.index;
      })

      it('should activate the index', async function () {
        click(this.literal1);
        await wait(DELAY);
        keyDown("ArrowDown");
        await wait(DELAY);
        expect(this.activeNode()).toBe(this.base);
        keyDown("ArrowDown");
        await wait(DELAY);
        expect(this.activeNode()).toBe(this.index);
      })
    })
  });

  describe("lists", function () {
    let test = function (text) {
      describe(text, function () {
        beforeEach(function () {
          this.cmb.setValue(text);
          let ast = this.cmb.getAst();
          this.literal1 = ast.rootNodes[0];
          this.construct = this.literal1.construktor;
          this.fields = this.literal1.values;
        });

        it('should activate the arguments on each press', async function () {
          click(this.literal1);
          await wait(DELAY);
          expect(this.activeNode()).toBe(this.literal1);

          keyDown("ArrowDown");
          await wait(DELAY);
          expect(this.activeNode()).toBe(this.construct);

          for (let i = 0; i < this.fields.length; i++) {
            keyDown("ArrowDown");
            await wait(DELAY);
            expect(this.activeNode()).not.toBe(this.literal1);
            expect(this.activeNode()).not.toBe(this.construct);
            expect(this.activeNode()).toBe(this.fields[i]);
          }
        });
      });
    };
    test('[list: 1, 2, 3]');
    test('[list: 1]');
    test('[list: ]');
    test('[list:]');

    let test_get = function (text) {
      describe(text, function () {
        beforeEach(function () {
          this.cmb.setValue(text);
          let ast = this.cmb.getAst();
          this.literal1 = ast.rootNodes[0];
          this.base = this.literal1.base;
          this.index = this.literal1.index;
        })

        it('should activate the index', async function () {
          click(this.literal1);
          await wait(DELAY);
          keyDown("ArrowDown");
          await wait(DELAY);
          expect(this.activeNode()).toBe(this.base);
          keyDown("ArrowDown");
          await wait(DELAY);
          expect(this.activeNode()).toBe(this.index);
        })
      })
    };
    test_get('row["field"]');
    test_get('row[""]');
    test_get('row["three word column"]');
    test_get('row[0]');
  });
});
