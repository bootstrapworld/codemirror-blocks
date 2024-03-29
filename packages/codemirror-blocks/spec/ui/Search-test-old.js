import example from "codemirror-blocks/languages/example";
import { click, keydown, pureevent, setNativeValue } from "../support/events";
import { wait, teardown, activationSetup } from "../src/toolkit/test-utils";
import { PGUP, PGDN, F3 } from "codemirror-blocks/keycode";

// ms delay to let the DOM catch up before testing
const DELAY = 500;

// be sure to call with `apply` or `call`
let setup = async function () {
  await activationSetup.call(this, example);
};

describe("Search component", function () {
  beforeEach(async function () {
    await setup.call(this);
    this.cmb.setBlockMode(true);
  });

  afterEach(function () {
    teardown();
  });

  describe("Basic search", function () {
    beforeEach(async function () {
      this.editor.getCodeMirror().setValue("0 1 2 1 (+ 1 2)");

      this.nomatch1 = this.blocks.ast.rootNodes[0];
      this.match1 = this.blocks.ast.rootNodes[1];
      this.nomatch2 = this.blocks.ast.rootNodes[2];
      this.match2 = this.blocks.ast.rootNodes[3];
      this.match3 = this.blocks.ast.rootNodes[4].args[0];

      fireEvent(this.nomatch1.el, click());
      fireEvent(this.nomatch1.el, keydown(F3));

      await wait(DELAY);

      const searchBox = document.querySelector(".search-input");
      setNativeValue(searchBox, "1");
      fireEvent(searchBox, pureevent("input"));
      const close = document.querySelector(".wrapper-modal .close");
      fireEvent(close, click());

      await wait(DELAY);
    });

    it("should stay where it is initially", function () {
      expect(this.blocks.getActiveNode()).toBe(this.nomatch1);
      expect(document.activeElement).toBe(this.nomatch1.el);
    });

    it("should find next match, skipping a non-matching literal", async function () {
      fireEvent(this.match1.el, click());
      fireEvent(this.match1.el, keydown(PGDN));

      await wait(DELAY);

      expect(this.blocks.getActiveNode()).toBe(this.match2);
      expect(document.activeElement).toBe(this.match2.el);
    });

    it("should wrap around to beginning of document for find-next", async function () {
      fireEvent(this.match3.el, click());
      fireEvent(this.match3.el, keydown(PGDN));

      await wait(DELAY);

      expect(this.blocks.getActiveNode()).toBe(this.match1);
      expect(document.activeElement).toBe(this.match1.el);
    });

    it("should wrap around to end of document for find-previous", async function () {
      fireEvent(this.match1.el, click());
      fireEvent(this.match1.el, keydown(PGUP));

      await wait(DELAY);

      expect(this.blocks.getActiveNode()).toBe(this.match3);
      expect(document.activeElement).toBe(this.match3.el);
    });
  });

  describe("when using advanced search mode,", function () {
    beforeEach(async function () {
      this.editor
        .getCodeMirror()
        .setValue("(hello 1 (hell) 2 (Hello) 3 (lll))");

      this.hello = this.blocks.ast.rootNodes[0].func;
      this.hell = this.blocks.ast.rootNodes[0].args[1].func;
      this.Hello = this.blocks.ast.rootNodes[0].args[3].func;
      this.lll = this.blocks.ast.rootNodes[0].args[5].func;

      fireEvent(this.hello.el, click());
    });

    it("should be case insensitive by default", async function () {
      fireEvent(this.hello.el, keydown(F3));

      await wait(DELAY);

      const searchBox = document.querySelector(".search-input");
      setNativeValue(searchBox, "hell");
      fireEvent(searchBox, pureevent("input"));
      const close = document.querySelector(".wrapper-modal .close");
      fireEvent(close, click());

      await wait(DELAY);

      fireEvent(this.hello.el, keydown(PGDN));

      await wait(DELAY);

      expect(this.blocks.getActiveNode()).toBe(this.hell);
      expect(document.activeElement).toBe(this.hell.el);
      fireEvent(this.hell.el, keydown(PGDN));

      await wait(DELAY);

      expect(this.blocks.getActiveNode()).toBe(this.Hello);
      expect(document.activeElement).toBe(this.Hello.el);
      fireEvent(this.Hello.el, keydown(PGDN));

      await wait(DELAY);

      expect(this.blocks.getActiveNode()).toBe(this.hello);
      expect(document.activeElement).toBe(this.hello.el);
    });

    it("should be able to use case sensitive mode", async function () {
      fireEvent(this.hello.el, keydown(F3));

      await wait(DELAY);

      const ignoreCase = document.querySelector('input[name="isIgnoreCase"]');
      fireEvent(ignoreCase, click());

      const searchBox = document.querySelector(".search-input");
      setNativeValue(searchBox, "hell");
      fireEvent(searchBox, pureevent("input"));

      const close = document.querySelector(".wrapper-modal .close");
      fireEvent(close, click());

      await wait(DELAY);

      fireEvent(this.hello.el, keydown(PGDN));

      await wait(DELAY);

      expect(this.blocks.getActiveNode()).toBe(this.hell);
      expect(document.activeElement).toBe(this.hell.el);
      fireEvent(this.hell.el, keydown(PGDN));

      await wait(DELAY);

      expect(this.blocks.getActiveNode()).toBe(this.hello);
      expect(document.activeElement).toBe(this.hello.el);
    });

    it("should be able to use regex mode", async function () {
      fireEvent(this.hello.el, keydown(F3));

      await wait(DELAY);

      const ignoreCase = document.querySelector('input[name="isRegex"]');
      fireEvent(ignoreCase, click());

      const searchBox = document.querySelector(".search-input");
      setNativeValue(searchBox, "ll[ol]");
      fireEvent(searchBox, pureevent("input"));

      const close = document.querySelector(".wrapper-modal .close");
      fireEvent(close, click());

      await wait(DELAY);

      fireEvent(this.hello.el, keydown(PGDN));

      await wait(DELAY);

      expect(this.blocks.getActiveNode()).toBe(this.Hello);
      expect(document.activeElement).toBe(this.Hello.el);
      fireEvent(this.Hello.el, keydown(PGDN));

      await wait(DELAY);

      expect(this.blocks.getActiveNode()).toBe(this.lll);
      expect(document.activeElement).toBe(this.lll.el);
    });
  });

  describe("Block search", function () {
    beforeEach(async function () {
      this.editor.getCodeMirror().setValue("0 (+ (* 1 2) (/ 3 4)) (- 5 6)");

      this.n0 = this.blocks.ast.rootNodes[0];
      this.n1 = this.blocks.ast.rootNodes[1].args[0].args[0];
      this.n2 = this.blocks.ast.rootNodes[1].args[0].args[1];
      this.n3 = this.blocks.ast.rootNodes[1].args[1].args[0];

      this.plus = this.blocks.ast.rootNodes[1].func;
      this.mult = this.blocks.ast.rootNodes[1].args[0].func;
      this.divide = this.blocks.ast.rootNodes[1].args[1].func;
      this.minus = this.blocks.ast.rootNodes[2].func;

      this.ePlus = this.blocks.ast.rootNodes[1];
      this.eMult = this.blocks.ast.rootNodes[1].args[0];
      this.eDivide = this.blocks.ast.rootNodes[1].args[1];
      this.eMinus = this.blocks.ast.rootNodes[2];

      fireEvent(this.n1.el, click());
      fireEvent(this.n1.el, keydown(F3));

      await wait(DELAY);

      const tab = document.querySelectorAll(".react-tabs li")[1]; // second tab
      fireEvent(tab, click());

      await wait(DELAY);

      // There are two types: expression and literal (alphabetically)
      const selector = document.querySelector('select[name="blockType"]');
      selector.value = "expression";
      fireEvent(selector, pureevent("change"));

      const close = document.querySelector(".wrapper-modal .close");
      fireEvent(close, click());

      await wait(DELAY);
    });

    it("should stay where it is initially", function () {
      expect(this.blocks.getActiveNode()).toBe(this.n1);
      expect(document.activeElement).toBe(this.n1.el);
    });

    it("should find expression", async function () {
      fireEvent(this.n1.el, keydown(PGDN));

      await wait(DELAY);

      expect(this.blocks.getActiveNode()).toBe(this.eDivide);
      expect(document.activeElement).toBe(this.eDivide.el);
      fireEvent(this.eDivide.el, keydown(PGDN));

      await wait(DELAY);

      expect(this.blocks.getActiveNode()).toBe(this.eMinus);
      expect(document.activeElement).toBe(this.eMinus.el);
      fireEvent(this.eMinus.el, keydown(PGDN));

      await wait(DELAY);

      expect(this.blocks.getActiveNode()).toBe(this.ePlus);
      expect(document.activeElement).toBe(this.ePlus.el);
      fireEvent(this.ePlus.el, keydown(PGDN));
    });

    it("should find literals", async function () {
      fireEvent(this.n1.el, keydown(F3));

      await wait(DELAY);

      const tab = document.querySelectorAll(".react-tabs li")[1]; // second tab
      fireEvent(tab, click());

      await wait(DELAY);

      // There are two types: expression and literal (alphabetically)
      const selector = document.querySelector('select[name="blockType"]');
      selector.value = "literal";
      fireEvent(selector, pureevent("change"));

      const close = document.querySelector(".wrapper-modal .close");
      fireEvent(close, click());

      await wait(DELAY);

      fireEvent(this.n1.el, keydown(PGDN));

      await wait(DELAY);

      expect(this.blocks.getActiveNode()).toBe(this.n2);
      expect(document.activeElement).toBe(this.n2.el);
      fireEvent(this.n2.el, keydown(PGDN));

      await wait(DELAY);

      expect(this.blocks.getActiveNode()).toBe(this.divide);
      expect(document.activeElement).toBe(this.divide.el);
      fireEvent(this.divide.el, keydown(PGDN));

      await wait(DELAY);

      expect(this.blocks.getActiveNode()).toBe(this.n3);
      expect(document.activeElement).toBe(this.n3.el);
      fireEvent(this.n3.el, keydown(PGDN));
    });
  });
});
