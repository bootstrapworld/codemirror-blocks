/** @jest-environment jsdom */
/*
 * Nineteenth round, step 4: the behaviours the old tests of the CodeMirror 5 API object check (api, api-edit-focus,
 * api-selection, entry-point, markText, new-blocks), against this editor's own interface (`createLezerBlockEditor`'s
 * object and its CodeMirror 6 view). One test per behaviour, named after the old test it replaces. The old tests are
 * not ported as API (class N): they point here.
 */
import { undo, redo, indentWithTab } from "@codemirror/commands";
import {
  Compartment,
  EditorSelection,
  EditorState,
  Facet,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  gutter,
  GutterMarker,
  keymap,
  lineNumbers,
  WidgetType,
} from "@codemirror/view";
import {
  checkLezerEditor,
  createLezerBlockEditor,
  LezerBlockEditor,
} from "../src/lezer-view";
import { VIEW_MEMBERS } from "../src/view-surface";
import { make, OPTS } from "./helpers";
import { walk } from "../src/doc";
import type { BNode } from "../src/types";

const text = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const src = (ed: LezerBlockEditor, n: BNode) =>
  ed.view.state.doc.sliceString(n.from, n.to);
const setValue = (ed: LezerBlockEditor, v: string) =>
  ed.view.dispatch({
    changes: { from: 0, to: ed.view.state.doc.length, insert: v },
  });

const SRC = "(a 1)\n(b 2)\n(c 3)\n";

describe("a change from code, while a block has keyboard focus (api-edit-focus-test)", () => {
  // "replaceRange in another root leaves focus on that block"
  test("an edit in another root leaves focus on that block", () => {
    const ed = make("scheme", SRC);
    ed.focusNode(ed.roots()[2]);
    ed.view.dispatch({ changes: { from: 0, to: 5, insert: "(a 1 1 1)" } });
    const f = ed.focusedNode();
    expect(f && src(ed, f)).toBe("(c 3)");
    expect(checkLezerEditor(ed)).toEqual([]);
  });

  // "setValue that keeps the block leaves focus on it"
  test("a new value that keeps the block leaves focus on it", () => {
    const ed = make("scheme", SRC);
    ed.focusNode(ed.roots()[1]);
    setValue(ed, SRC);
    const f = ed.focusedNode();
    expect(f && src(ed, f)).toBe("(b 2)");
  });

  // "setValue that removes the block moves focus to the first root, as before"
  // edited: the focus is looked for in the new tree, and a block that is gone leaves it on the first root or nowhere
  test("a new value that removes the block does not leave focus on a block that is gone", () => {
    const ed = make("scheme", SRC);
    ed.focusNode(ed.roots()[1]);
    setValue(ed, "(x 9)\n");
    const f = ed.focusedNode();
    expect(f === null || src(ed, f) === "(x 9)").toBe(true);
    expect(checkLezerEditor(ed)).toEqual([]);
  });

  // "with no block focused, focus goes to the first root, as before"
  test("with no block focused, a change from code focuses nothing, and focusEditor goes to the first root", () => {
    const ed = make("scheme", SRC);
    expect(ed.focusedNode()).toBeNull();
    setValue(ed, "(x 9)\n(y 8)\n");
    expect(ed.focusedNode()).toBeNull();
    ed.focusEditor();
    const f = ed.focusedNode();
    expect(f && src(ed, f)).toBe("(x 9)");
  });
});

describe("what is selected and focused, read from code (api-selection-test, api-test)", () => {
  // "somethingSelected is true once a block is selected", "getSelections reads the text of the selected block"
  test("the selected blocks are read in document order, with their text", () => {
    const ed = make("scheme", SRC);
    expect(ed.selectedBlocks()).toEqual([]);
    expect(ed.toggleSelect(ed.roots()[2])).toBe("selected");
    expect(ed.toggleSelect(ed.roots()[0])).toBe("selected");
    expect(ed.selectedBlocks().map((n) => src(ed, n))).toEqual([
      "(a 1)",
      "(c 3)",
    ]);
    ed.clearSelection();
    expect(ed.selectedBlocks()).toEqual([]);
  });

  // "selecting a block makes the block the only selection, not one of two with the cursor"
  test("selecting a block selects that block, and the text cursor is not a second selection", () => {
    const ed = make("scheme", SRC);
    ed.toggleSelect(ed.roots()[1]);
    expect(ed.selectedBlocks().length).toBe(1);
    expect(ed.view.state.selection.ranges.every((r) => r.empty)).toBe(true);
  });

  // "hasFocus is true while a block has the focus"
  test("focusedNode is the block that has the focus, and null when none has", () => {
    const ed = make("scheme", SRC);
    expect(ed.focusedNode()).toBeNull();
    ed.focusNode(ed.roots()[0]);
    expect(ed.focusedNode()).toBe(ed.roots()[0]);
  });

  // "setCursor should work as-is for text, or activate the containing block" / "getCursor"
  test("focusNode activates a block, and the block's range is where the cursor of the text is read", () => {
    const ed = make("scheme", SRC);
    let inner: BNode | null = null;
    ed.roots().forEach((r) =>
      walk(r, (n) => {
        if (!inner && src(ed, n) === "b") inner = n;
      })
    );
    if (!inner) throw new Error("no b");
    ed.focusNode(inner);
    expect(ed.focusedNode()).toBe(inner);
    expect(src(ed, inner)).toBe("b");
  });
});

describe("changing the selection or the text from code (api-test, api-selection-test)", () => {
  // "replaceSelection replaces the block and inserts nothing at the cursor"
  test("replacing the selected block writes the new text there and nowhere else", () => {
    const ed = make("scheme", SRC);
    const [n] = ed.replaceWithTexts(ed.roots()[1], ["(z 0)"]) ? [1] : [0];
    expect(n).toBe(1);
    expect(text(ed)).toBe("(a 1)\n(z 0)\n(c 3)\n");
    expect(checkLezerEditor(ed)).toEqual([]);
  });

  // "refuses new text that is not whole blocks"
  test("new text that is not whole blocks is refused, and the document stays", () => {
    const ed = make("scheme", SRC);
    expect(ed.refuseReplace(ed.roots()[1], "(z 0")).not.toBeNull();
    expect(text(ed)).toBe(SRC);
  });

  // "replaceRange": a text change from code is one change
  test("a text change from code reaches the blocks, which stay consistent with the text", () => {
    const ed = make("scheme", SRC);
    ed.view.dispatch({ changes: { from: 7, to: 8, insert: "bb" } });
    expect(ed.roots().map((n) => src(ed, n))).toEqual([
      "(a 1)",
      "(bb 2)",
      "(c 3)",
    ]);
    expect(checkLezerEditor(ed)).toEqual([]);
  });
});

describe("undo and redo from code (undo-redo-test, api-test)", () => {
  test("undo and redo of a change go back and forth, and the blocks follow", () => {
    const ed = make("scheme", SRC);
    ed.removeNode(ed.roots()[1]);
    expect(ed.roots().length).toBe(2);
    expect(undo(ed.view)).toBe(true);
    expect(text(ed)).toBe(SRC);
    expect(ed.roots().length).toBe(3);
    expect(checkLezerEditor(ed)).toEqual([]);
    expect(redo(ed.view)).toBe(true);
    expect(ed.roots().length).toBe(2);
    expect(checkLezerEditor(ed)).toEqual([]);
  });
});

describe("block mode on and off (new-blocks-test, entry-point-test)", () => {
  // "should set block mode to false" (a CodeMirror 5 editor starts in text mode; this one starts in block mode)
  // edited: starts in block mode here
  test("the editor starts in block mode, and setBlockMode(false) and (true) switch it", () => {
    const ed = make("scheme", SRC);
    expect(ed.isBlockMode()).toBe(true);
    ed.setBlockMode(false);
    expect(ed.isBlockMode()).toBe(false);
    ed.setBlockMode(true);
    expect(ed.isBlockMode()).toBe(true);
  });

  // "the API ... answers for the mode that shows": in text mode the keys are the text's, not the blocks'
  // edited: Delete in text mode takes one character; in block mode it takes the selected block
  test("in text mode Delete takes a character, in block mode the selected block", () => {
    const ed = make("scheme", SRC);
    ed.setBlockMode(false);
    const el = ed.view.dom.querySelector(".cm-content") as HTMLElement;
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Delete", bubbles: true })
    );
    expect(text(ed)).toBe(SRC.slice(1));
    const ed2 = make("scheme", SRC);
    ed2.focusNode(ed2.roots()[0]);
    ed2.toggleSelect(ed2.roots()[0]);
    ed2.renderer.element(ed2.roots()[0]).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Delete",
        bubbles: true,
        cancelable: true,
      })
    );
    expect(text(ed2)).not.toContain("(a 1)");
    expect(text(ed2)).toContain("(b 2)");
  });
});

/*
 * Thirty-second round: the editor object stands in for a CodeMirror 6 `EditorView` (decision of 2026-11-23: a CM6 user who embeds this editor
 * instead of plain CM6 changes no supported call). One test per area of the old API that the CM5-shaped tests (class D) covered.
 */
describe("the editor object is an EditorView for the CodeMirror 6 calls (entry-point, api tests; by decision)", () => {
  test("every public member of EditorView is on the editor, and is the view's", () => {
    const ed = make("scheme", SRC);
    const e = ed as unknown as Record<string, unknown>;
    const v = ed.view as unknown as Record<string, unknown>;
    for (const name of VIEW_MEMBERS) {
      expect(name in ed).toBe(true);
      if (typeof v[name] === "function")
        expect(typeof e[name]).toBe("function");
      else expect(e[name]).toEqual(v[name]);
    }
    expect(ed.state).toBe(ed.view.state);
    expect(ed.dom).toBe(ed.view.dom);
    expect(ed.contentDOM).toBe(ed.view.contentDOM);
    expect(ed.scrollDOM).toBe(ed.view.scrollDOM);
  });

  test("dispatch, state, update listeners and commands work on the editor as on a view", () => {
    const ed = make("scheme", SRC);
    const seen: number[] = [];
    ed.dispatch({
      effects: StateEffect.appendConfig.of(
        EditorView.updateListener.of((u) => {
          if (u.docChanged) seen.push(u.state.doc.length);
        })
      ),
    });
    ed.dispatch({ changes: { from: 0, insert: "(z 0)\n" } });
    expect(seen).toEqual([SRC.length + 6]);
    expect(ed.state.doc.sliceString(0, 5)).toBe("(z 0)");
    expect(ed.roots().length).toBe(4);
    expect(undo(ed)).toBe(true);
    expect(ed.state.doc.toString()).toBe(SRC);
    expect(redo(ed)).toBe(true);
    expect(ed.roots().length).toBe(4);
    expect(checkLezerEditor(ed)).toEqual([]);
  });

  test("state methods: selection, sliceDoc, toText, changeByRange, facets, fields", () => {
    const ed = make("scheme", SRC);
    ed.dispatch({ selection: EditorSelection.single(1, 3) });
    expect(ed.state.sliceDoc(1, 3)).toBe("a ");
    expect(ed.state.selection.main.from).toBe(1);
    expect(ed.state.toText("x\ny").lines).toBe(2);
    ed.dispatch(
      ed.state.changeByRange((r) => ({
        changes: { from: r.from, to: r.to, insert: "b" },
        range: EditorSelection.cursor(r.from + 1),
      }))
    );
    expect(ed.state.doc.sliceString(0, 5)).toBe("(b1)\n");
    const f = Facet.define<number, number>({ combine: (x) => x.length });
    ed.dispatch({ effects: StateEffect.appendConfig.of(f.of(1)) });
    expect(ed.state.facet(f)).toBe(1);
  });

  test("measuring and geometry calls answer (jsdom has no layout: the values are empty)", () => {
    const ed = make("scheme", SRC);
    expect(ed.viewport).toEqual({ from: 0, to: SRC.length });
    expect(ed.visibleRanges.length).toBeGreaterThan(0);
    expect(ed.lineBlockAt(7).from).toBe(6);
    expect(ed.hasFocus).toBe(false);
    expect(ed.posAtDOM(ed.contentDOM, 0)).toBe(0);
    expect(() => ed.requestMeasure()).not.toThrow();
    expect(() => ed.coordsAtPos(1)).not.toThrow();
    expect(() => ed.posAtCoords({ x: 1, y: 1 })).not.toThrow();
    expect(() => ed.focus()).not.toThrow();
  });

  test("an unchanged state can be set again (setState); a state made without this editor's extensions is not supported", () => {
    const ed = make("scheme", SRC);
    ed.setState(ed.state);
    expect(ed.roots().length).toBe(3);
  });
});

describe("CodeMirror 6's own configuration: {parent, doc, extensions} (entry-point tests; by decision)", () => {
  const cfg = (extra: object) => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const ed = createLezerBlockEditor({
      ...OPTS.scheme,
      parent,
      ...extra,
    });
    return { ed, parent };
  };

  test("parent and doc replace the host and the text", () => {
    const { ed, parent } = cfg({ doc: SRC });
    expect(parent.contains(ed.dom)).toBe(true);
    expect(ed.state.doc.toString()).toBe(SRC);
    expect(ed.roots().length).toBe(3);
    ed.destroy();
  });

  test("value is an alias of doc, and no doc is an empty program", () => {
    const a = cfg({ value: SRC }).ed;
    expect(a.state.doc.toString()).toBe(SRC);
    const b = cfg({}).ed;
    expect(b.state.doc.toString()).toBe("");
    a.destroy();
    b.destroy();
  });

  test("a CodeMirror 6 Text works as doc", () => {
    const { ed } = cfg({ doc: EditorState.create({ doc: SRC }).doc });
    expect(ed.state.doc.toString()).toBe(SRC);
    ed.destroy();
  });

  test("extensions: line numbers, a theme, read-only, an update listener and a key binding all take effect", () => {
    const changed: boolean[] = [];
    let hit = 0;
    const { ed } = cfg({
      doc: SRC,
      extensions: [
        lineNumbers(),
        EditorView.theme({ ".cm-content": { color: "red" } }),
        EditorView.updateListener.of((u) => changed.push(u.docChanged)),
        keymap.of([{ key: "Ctrl-j", run: () => (hit++, true) }, indentWithTab]),
      ],
    });
    expect(ed.dom.querySelector(".cm-gutters")).not.toBeNull();
    expect(ed.dom.classList.length).toBeGreaterThan(
      make("scheme", SRC).dom.classList.length
    );
    ed.contentDOM.dispatchEvent(
      new KeyboardEvent("keydown", { key: "j", keyCode: 74, ctrlKey: true })
    );
    expect(hit).toBe(1);
    ed.dispatch({ changes: { from: 0, insert: "1 " } });
    expect(changed).toContain(true);
    ed.destroy();
  });

  test("EditorState.readOnly from the extensions is in the state, as in CodeMirror 6", () => {
    const { ed } = cfg({ doc: SRC, extensions: EditorState.readOnly.of(true) });
    expect(ed.state.readOnly).toBe(true);
    ed.destroy();
  });

  test("reconfigure replaces the extensions the page gave, and a Compartment of the page reconfigures too (setOption; by decision: reconfigure)", () => {
    const f = Facet.define<number, number>({ combine: (x) => x.length });
    const comp = new Compartment();
    const { ed } = cfg({ doc: SRC, extensions: [f.of(1), comp.of(f.of(1))] });
    expect(ed.state.facet(f)).toBe(2);
    ed.dispatch({ effects: comp.reconfigure([]) });
    expect(ed.state.facet(f)).toBe(1);
    ed.reconfigure([f.of(1), f.of(2), f.of(3)]);
    expect(ed.state.facet(f)).toBe(3);
    expect(ed.roots().length).toBe(3);
    ed.destroy();
  });

  test("collapseAll starts every block collapsed", () => {
    const { ed } = cfg({ doc: SRC, collapseAll: true });
    expect(ed.roots().every((r) => ed.renderer.isCollapsed(r))).toBe(true);
    ed.destroy();
  });

  test("the old arguments (host, text, options) still work, with extensions too", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const ed = createLezerBlockEditor(parent, SRC, {
      ...OPTS.scheme,
      extensions: lineNumbers(),
    });
    expect(ed.dom.querySelector(".cm-gutters")).not.toBeNull();
    ed.destroy();
  });
});

describe("decorations of the page (markText, setBookmark, addLineWidget, gutters; by decision: the CodeMirror 6 way)", () => {
  class Tag extends WidgetType {
    toDOM(): HTMLElement {
      const s = document.createElement("span");
      s.className = "page-widget";
      return s;
    }
  }
  class Star extends GutterMarker {
    toDOM(): Node {
      return document.createTextNode("*");
    }
  }
  const add = StateEffect.define<{ from: number; to: number; cls: string }>();
  const marksField = StateField.define({
    create: () => Decoration.none,
    update(d, tr) {
      d = d.map(tr.changes);
      for (const e of tr.effects)
        if (e.is(add))
          d = d.update({
            add: [
              Decoration.mark({
                class: e.value.cls,
                attributes: { title: "t", style: "color: red" },
              }).range(e.value.from, e.value.to),
            ],
          });
      return d;
    },
    provide: (f) => EditorView.decorations.from(f),
  });
  const mk = () => make("scheme", SRC, { extensions: [marksField] });

  test("a mark on exactly one block's range styles that block: class, style, title (markText)", () => {
    const ed = mk();
    ed.dispatch({ effects: add.of({ from: 6, to: 11, cls: "hot" }) });
    const el = ed.renderer.element(ed.roots()[1]);
    expect(el.classList.contains("hot")).toBe(true);
    expect(el.style.color).toBe("red");
    expect(el.getAttribute("title")).toBe("t");
    expect(ed.dom.querySelectorAll(".hot").length).toBe(1);
  });

  test("a mark on a block inside a root styles that block", () => {
    const ed = mk();
    const inner = ed.roots()[0].slots[1].nodes[0];
    ed.dispatch({
      effects: add.of({ from: inner.from, to: inner.to, cls: "in" }),
    });
    expect(ed.renderer.element(inner).classList.contains("in")).toBe(true);
  });

  test("the mark moves with the text, and is forgotten with the block that is deleted", () => {
    const ed = mk();
    ed.dispatch({ effects: add.of({ from: 6, to: 11, cls: "hot" }) });
    ed.dispatch({ changes: { from: 0, insert: "(z 0)\n" } });
    const el = ed.dom.querySelector(".hot") as HTMLElement;
    expect(ed.state.sliceDoc(12, 17)).toBe("(b 2)");
    expect(ed.renderer.element(ed.roots()[2])).toBe(el);
    ed.removeNode(ed.roots()[2]);
    expect(ed.dom.querySelector(".hot")).toBeNull();
  });

  test("a mark is taken off when the extension is gone, and a mark that is not one whole block styles nothing", () => {
    const ed = mk();
    ed.dispatch({ effects: add.of({ from: 7, to: 9, cls: "part" }) });
    expect(ed.dom.querySelector(".part")).toBeNull();
    ed.dispatch({ effects: add.of({ from: 0, to: 5, cls: "hot" }) });
    expect(ed.dom.querySelector(".hot")).not.toBeNull();
    ed.reconfigure([]);
    expect(ed.dom.querySelector(".hot")).toBeNull();
  });

  test("the mark shows in text mode as CodeMirror draws it, and in block mode on the block, after a switch back and forth", () => {
    const ed = mk();
    ed.dispatch({ effects: add.of({ from: 0, to: 5, cls: "hot" }) });
    ed.setMode("text");
    expect(ed.dom.querySelector(".blocks-node")).toBeNull();
    expect(ed.dom.querySelector(".hot")).not.toBeNull();
    ed.setMode("blocks");
    const hot = ed.dom.querySelectorAll(".hot");
    expect(hot.length).toBe(1);
    expect(hot[0].classList.contains("blocks-node")).toBe(true);
  });

  test("widgets, line decorations and gutters of the page work as in CodeMirror 6", () => {
    const f = StateField.define({
      create: () =>
        Decoration.set(
          [
            Decoration.widget({ widget: new Tag(), side: 1 }).range(5),
            Decoration.line({ class: "page-line" }).range(6),
          ],
          true
        ),
      update: (d, tr) => d.map(tr.changes),
      provide: (x) => EditorView.decorations.from(x),
    });
    const ed = make("scheme", SRC, {
      extensions: [f, gutter({ lineMarker: () => new Star() })],
    });
    expect(ed.dom.querySelectorAll(".page-widget").length).toBe(1);
    expect(ed.dom.querySelector(".cm-line.page-line")).not.toBeNull();
    expect(ed.dom.querySelector(".cm-gutters")?.textContent).toContain("*");
  });
});

describe("block-only methods in text mode (entry-point tests; by decision: they throw)", () => {
  test("roots, focusedNode, selection and selectedBlocks throw in text mode and answer again in block mode", () => {
    const ed = make("scheme", SRC);
    ed.setMode("text");
    for (const f of [
      () => ed.roots(),
      () => ed.focusedNode(),
      () => ed.selection(),
      () => ed.selectedBlocks(),
    ])
      expect(f).toThrow(/only available in block mode/);
    expect(ed.state.doc.toString()).toBe(SRC);
    expect(() =>
      ed.dispatch({ changes: { from: 0, insert: " " } })
    ).not.toThrow();
    ed.setMode("blocks");
    expect(ed.roots().length).toBe(3);
    expect(ed.focusedNode()).toBeNull();
  });

  test("the editor object is the same object in both modes, with every method", () => {
    const ed = make("scheme", SRC);
    const names = Object.keys(ed).concat(VIEW_MEMBERS as unknown as string[]);
    ed.setMode("text");
    ed.setMode("blocks");
    for (const n of names) expect(n in ed).toBe(true);
    expect(ed.view.dom).toBe(ed.dom);
  });
});

describe("lines and positions are CodeMirror 6's (getLineHandle, getLine, lineCount, getCursor; by decision: offsets)", () => {
  test("lines are read with doc.line: a value, with its text and offsets", () => {
    const ed = make("scheme", SRC);
    const doc = ed.state.doc;
    expect(doc.lines).toBe(4);
    const l = doc.line(2);
    expect(l.text).toBe("(b 2)");
    expect(doc.sliceString(l.from, l.to)).toBe("(b 2)");
    expect(doc.line(2)).toEqual(l);
  });

  test("the cursor is an offset; the line and column come from doc.lineAt", () => {
    const ed = make("scheme", SRC);
    ed.dispatch({ selection: { anchor: 9 } });
    const head = ed.state.selection.main.head;
    const line = ed.state.doc.lineAt(head);
    expect([line.number - 1, head - line.from]).toEqual([1, 3]);
    expect(checkLezerEditor(ed)).toEqual([]);
  });
});

describe("the selection is offsets: extending, replacing and reading it (extendSelection, replaceRange, replaceSelection, somethingSelected; by decision)", () => {
  test("somethingSelected is a range that is not empty, and the selected text is sliceDoc", () => {
    const ed = make("scheme", SRC);
    expect(ed.state.selection.main.empty).toBe(true);
    ed.dispatch({ selection: EditorSelection.range(6, 11) });
    const r = ed.state.selection.main;
    expect(r.empty).toBe(false);
    expect(ed.state.sliceDoc(r.from, r.to)).toBe("(b 2)");
  });

  test("extending moves the head and keeps the anchor, anywhere in the text (a head in the middle of a block is the text's own selection)", () => {
    const ed = make("scheme", SRC);
    ed.dispatch({ selection: EditorSelection.range(6, 11) });
    const { anchor } = ed.state.selection.main;
    ed.dispatch({ selection: EditorSelection.range(anchor, 8) });
    expect(ed.state.selection.main.anchor).toBe(6);
    expect(ed.state.selection.main.head).toBe(8);
    expect(checkLezerEditor(ed)).toEqual([]);
  });

  test("replaceSelection is state.replaceSelection, and the blocks follow", () => {
    const ed = make("scheme", SRC);
    ed.dispatch({ selection: EditorSelection.range(6, 11) });
    ed.dispatch(ed.state.replaceSelection("(z 0)"));
    expect(text(ed)).toBe("(a 1)\n(z 0)\n(c 3)\n");
    expect(ed.roots().map((n) => src(ed, n))).toEqual([
      "(a 1)",
      "(z 0)",
      "(c 3)",
    ]);
    expect(checkLezerEditor(ed)).toEqual([]);
  });

  test("replaceRange is a change; one that cuts a block in half is the text's, and the blocks stay consistent with the text", () => {
    const ed = make("scheme", SRC);
    ed.dispatch({ changes: { from: 8, to: 11, insert: "" } });
    expect(text(ed)).toBe("(a 1)\n(b\n(c 3)\n");
    expect(checkLezerEditor(ed)).toEqual([]);
    expect(undo(ed)).toBe(true);
    expect(text(ed)).toBe(SRC);
  });
});
