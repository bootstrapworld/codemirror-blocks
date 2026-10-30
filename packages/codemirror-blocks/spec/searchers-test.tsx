import { act, fireEvent, render } from "@testing-library/react";
import React from "react";
import wescheme from "../src/languages/wescheme";
import { CodeMirrorFacade } from "../src/editor";
import { collapseNode } from "../src/state/actions";
import ByBlock from "../src/ui/searchers/ByBlock";
import ByString from "../src/ui/searchers/ByString";
import { mountCMB, teardown } from "../src/toolkit/test-utils";

/**
 * The two ways to search: by text and by kind of block. Each is a function from
 * a cursor to the next (or previous) match, which the search dialog uses, and a
 * small form for choosing what to look for.
 */
const pos = (line: number, ch: number) => ({ line, ch });
const base = ByString.setting;

let cmb: ReturnType<typeof mountCMB>["cmb"];
let store: ReturnType<typeof mountCMB>["store"];

/** What a search found, in a form that is short to compare and to print */
type Found = {
  node: { toString(): string; type: string };
  cursor: { line: number; ch: number };
};
const found = (result: Found | null) =>
  result && {
    node: result.node.toString(),
    type: result.node.type,
    cursor: pos(result.cursor.line, result.cursor.ch),
  };
const find = (
  searcher: typeof ByString | typeof ByBlock,
  cur: { line: number; ch: number },
  settings: object,
  forward = true
) =>
  found(
    (searcher as any).search(
      cur,
      settings,
      new CodeMirrorFacade(cmb.getCM()),
      store.getState(),
      forward
    )
  );
const byString = (
  cur: { line: number; ch: number },
  settings: Partial<typeof base>,
  forward = true
) => find(ByString, cur, { ...base, ...settings }, forward);
const byBlock = (
  cur: { line: number; ch: number },
  blockType: string,
  forward = true
) => find(ByBlock, cur, { blockType }, forward);

beforeEach(() => {
  ({ cmb, store } = mountCMB(wescheme));
  cmb.setValue("(f x)\n(g xy x)\nx");
});
afterEach(teardown);

describe("searching by string", () => {
  it("finds the next match after the cursor, as the block that holds it", () => {
    const found = byString(pos(0, 0), { searchString: "x" });
    expect(found?.node).toBe("x");
    expect(found?.cursor).toEqual(pos(0, 3));
  });

  it("goes on to the next match from a match, and stops at the end", () => {
    const at = (cur: { line: number; ch: number }) =>
      byString(cur, { searchString: "x" })?.cursor;
    expect(at(pos(0, 3))).toEqual(pos(1, 3));
    expect(at(pos(1, 3))).toEqual(pos(1, 6));
    expect(at(pos(1, 6))).toEqual(pos(2, 0));
    expect(at(pos(2, 0))).toBeUndefined(); // no wrapping here
  });

  it("searches backwards", () => {
    const back = (cur: { line: number; ch: number }) =>
      byString(cur, { searchString: "x" }, false)?.cursor;
    expect(back(pos(2, 0))).toEqual(pos(1, 6));
    expect(back(pos(1, 6))).toEqual(pos(1, 3));
    expect(back(pos(0, 3))).toBeUndefined();
  });

  it("finds nothing when there is nothing to find", () => {
    expect(byString(pos(0, 0), { searchString: "zzz" })).toBeNull();
  });

  it("matches the case only if told to ignore it", () => {
    expect(byString(pos(0, 0), { searchString: "X" })).toBeNull();
    expect(
      byString(pos(0, 0), { searchString: "X", isIgnoreCase: true })?.cursor
    ).toEqual(pos(0, 3));
  });

  it("matches a whole word if told to be exact", () => {
    // "xy" contains "x", but is not the word x
    const loose = byString(pos(1, 2), { searchString: "x" });
    expect(loose?.cursor).toEqual(pos(1, 3));
    const exact = byString(pos(1, 2), {
      searchString: "x",
      isExactMatch: true,
    });
    expect(exact?.cursor).toEqual(pos(1, 6));
  });

  it("escapes what an exact match was given, so that it is not read as a pattern", () => {
    cmb.setValue("(+ 1 2)\n(f 1)");
    const found = byString(pos(0, 0), {
      searchString: "+",
      isExactMatch: true,
    });
    expect(found).toBeNull(); // \b+\b needs word characters around it
    const f = byString(pos(0, 0), { searchString: "f", isExactMatch: true });
    expect(f?.cursor).toEqual(pos(1, 1));
  });

  it("reads the search as a regular expression if told to, and finds nothing for a pattern that is not finished", () => {
    expect(
      byString(pos(0, 0), { searchString: "g|xy", isRegex: true })?.cursor
    ).toEqual(pos(1, 1));
    expect(
      byString(pos(0, 0), { searchString: "(", isRegex: true })
    ).toBeNull();
    expect(
      byString(pos(0, 0), { searchString: "[", isRegex: true })
    ).toBeNull();
  });

  it("skips matches inside a collapsed block", () => {
    const [, second] = cmb.getAst().rootNodes;
    act(() => {
      store.dispatch(collapseNode(second));
    });
    const found = byString(pos(0, 3), { searchString: "x" });
    expect(found?.cursor).toEqual(pos(2, 0));
  });

  describe("with nothing to search for, it steps through the blocks", () => {
    it("forwards, and backwards", () => {
      const next = (cur: { line: number; ch: number }, forward = true) =>
        byString(cur, { searchString: "" }, forward)?.node;
      expect(next(pos(0, 1))).toBe("x"); // from f, the block after it
      expect(next(pos(0, 3), false)).toBe("f");
      expect(next(pos(0, 3))).toBe("(g xy x)");
    });

    it("from between blocks, the one after or before the cursor", () => {
      cmb.setValue("(f x)\n\n(g y)");
      expect(byString(pos(1, 0), { searchString: "" })?.node).toBe("(g y)");
      expect(byString(pos(1, 0), { searchString: "" }, false)?.node).toBe("x");
    });

    it("finds nothing past the last block, or before the first", () => {
      cmb.setValue("(f x)");
      expect(byString(pos(0, 3), { searchString: "" })).toBeNull();
      expect(byString(pos(0, 5), { searchString: "" })).toBeNull();
      expect(byString(pos(0, 0), { searchString: "" }, false)).toBeNull();
      // the block before f is the call that holds it
      expect(byString(pos(0, 1), { searchString: "" }, false)?.node).toBe(
        "(f x)"
      );
    });

    it("skips what is in a collapsed block", () => {
      const [first] = cmb.getAst().rootNodes;
      act(() => {
        store.dispatch(collapseNode(first));
      });
      // f and x are inside the collapsed call: the next block is the next call
      expect(byString(pos(0, 0), { searchString: "" })?.node).toBe("(g xy x)");
    });
  });
});

describe("searching by block type", () => {
  it("finds the next block of that type, forwards and backwards", () => {
    expect(byBlock(pos(0, 1), "functionApp")).toEqual({
      node: "(g xy x)",
      type: "functionApp",
      cursor: pos(1, 0),
    });
    // going back from the start of the second call, the first call is next
    expect(byBlock(pos(1, 0), "functionApp", false)?.node).toBe("(f x)");
    // a literal: from f, the next is x
    expect(byBlock(pos(0, 1), "literal")?.cursor).toEqual(pos(0, 3));
    expect(byBlock(pos(0, 3), "literal", false)?.cursor).toEqual(pos(0, 1));
  });

  it("finds nothing when no later block has the type", () => {
    expect(byBlock(pos(1, 1), "functionApp")).toBeNull();
    expect(byBlock(pos(0, 0), "lambdaExpression")).toBeNull();
  });

  it("from between blocks, looks at the block after the cursor first", () => {
    // (the block after the cursor used to be skipped, so this found nothing)
    cmb.setValue("(f x)\n\n(g y)");
    expect(byBlock(pos(1, 0), "functionApp")?.node).toBe("(g y)");
    expect(byBlock(pos(1, 0), "functionApp", false)?.node).toBe("(f x)");
    // and with nothing after it, nothing is found
    expect(byBlock(pos(1, 0), "lambdaExpression")).toBeNull();
  });

  it("skips blocks in a collapsed block", () => {
    const [, second] = cmb.getAst().rootNodes;
    act(() => {
      store.dispatch(collapseNode(second));
    });
    // x on the first line, then past the collapsed call to the x on the last
    expect(byBlock(pos(0, 3), "literal")?.cursor).toEqual(pos(2, 0));
  });
});

describe("the search by string form", () => {
  const setting = { ...base, searchString: "abc" };

  it("shows the text and the three options", () => {
    const { getByLabelText, getByText } = render(
      <ByString.component setting={setting} onChange={jest.fn()} />
    );
    expect((getByLabelText("Search String") as HTMLInputElement).value).toBe(
      "abc"
    );
    for (const label of ["Ignore case", "Exact match", "Regex"]) {
      expect(getByText(label)).toBeTruthy();
    }
  });

  it("reports a changed text, with the other settings kept", () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <ByString.component
        setting={{ ...setting, isRegex: true }}
        onChange={onChange}
      />
    );
    fireEvent.change(getByLabelText("Search String"), {
      target: { value: "xyz" },
    });
    expect(onChange).toHaveBeenCalledWith({
      ...setting,
      isRegex: true,
      searchString: "xyz",
    });
  });

  it("reports a ticked option", () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <ByString.component setting={setting} onChange={onChange} />
    );
    fireEvent.click(getByLabelText("Ignore case"));
    expect(onChange).toHaveBeenCalledWith({ ...setting, isIgnoreCase: true });
    fireEvent.click(getByLabelText("Regex"));
    expect(onChange).toHaveBeenLastCalledWith({ ...setting, isRegex: true });
  });

  it("selects the text the first time it is shown, so typing replaces it", () => {
    const { getByLabelText } = render(
      <ByString.component setting={setting} onChange={jest.fn()} firstTime />
    );
    const input = getByLabelText("Search String") as HTMLInputElement;
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(3);
  });
});

describe("the search by block form", () => {
  it("lists the types of block in the document, in order, and reports a choice", () => {
    const onChange = jest.fn();
    const { container } = render(
      <ByBlock.component
        setting={{ blockType: "literal" }}
        onChange={onChange}
        cmbState={{ ast: cmb.getAst() }}
      />
    );
    const select = container.querySelector("select") as HTMLSelectElement;
    const options = [...select.options].map((o) => o.value);
    expect(options).toEqual(["functionApp", "literal"]);
    expect(select.value).toBe("literal");
    fireEvent.change(select, {
      target: { name: "blockType", value: "functionApp" },
    });
    expect(onChange).toHaveBeenCalledWith({ blockType: "functionApp" });
  });
});
