import fs from "fs";
import path from "path";
import wescheme from "../src/languages/wescheme";
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { CodeMirrorBlocksComponent, API } from "../src/CodeMirrorBlocks";
import {
  cmd_ctrl,
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";
import { createAppStore } from "../src/state/store";

const roots = (cmb: API) => cmb.getAst().rootNodes.map((n) => n.toString());

describe("switching between text and block mode", () => {
  let cmb: API;
  beforeEach(() => {
    cmb = mountCMB(wescheme).cmb;
  });
  afterEach(teardown);

  it("keeps the program (and canonicalises its layout) in both directions", () => {
    cmb.setValue("(f   x\n   y)   42");
    const blockRoots = roots(cmb);
    cmb.setBlockMode(false);
    expect(cmb.getBlockMode()).toBe(false);
    const text = cmb.getValue();
    expect(wescheme.buildAST(text).rootNodes.map((n) => n.toString())).toEqual(
      blockRoots
    );
    cmb.setBlockMode(true);
    expect(cmb.getBlockMode()).toBe(true);
    expect(roots(cmb)).toEqual(blockRoots);
  });

  it("only shows blocks, the toolbar and the trash can in block mode", () => {
    cmb.setValue("(f x)");
    expect(document.querySelector(".TrashCan")).not.toBeNull();
    expect(document.querySelectorAll(".blocks-node").length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText("Search functions")).toBeEnabled();

    cmb.setBlockMode(false);
    expect(document.querySelector(".TrashCan")).toBeNull();
    expect(
      cmb.getWrapperElement().querySelectorAll('[id^="block-node-"]')
    ).toHaveLength(0);
    expect(screen.getByPlaceholderText("Search functions")).toBeDisabled();
  });

  it("lets text-mode edits through, and shows them as blocks afterwards", () => {
    cmb.setBlockMode(false);
    cmb.setValue("(f x)");
    cmb.replaceRange(" (g y)", { line: 0, ch: 5 });
    cmb.setBlockMode(true);
    expect(roots(cmb)).toEqual(["(f x)", "(g y)"]);
  });

  it("can be switched back and forth many times without drifting", () => {
    cmb.setValue("(f x y)\n\n42");
    const text = cmb.getValue();
    const before = roots(cmb);
    for (let i = 0; i < 5; i++) {
      cmb.setBlockMode(false);
      cmb.setBlockMode(true);
    }
    expect(cmb.getValue()).toBe(text);
    expect(roots(cmb)).toEqual(before);
  });

  it("keeps working after a round trip: edit, undo and delete", () => {
    cmb.setValue("(f x y)");
    cmb.setBlockMode(false);
    cmb.setBlockMode(true);
    const x = [...cmb.getAst().rootNodes[0].children()][1];
    mouseDown(x);
    keyDown(" ", {}, x);
    keyDown("Delete", {}, x);
    expect(cmb.getValue()).toBe("(f y)");
    keyDown("Z", cmd_ctrl);
    expect(cmb.getValue()).toBe("(f x y)");
  });
});

describe("pretty-printing real programs", () => {
  const examples = fs
    .readdirSync(path.join(__dirname, "../example"))
    .filter((f) => f.endsWith(".rkt"))
    .map((f) => [
      f,
      fs.readFileSync(path.join(__dirname, "../example", f), "utf8"),
    ]);

  // big-expression.rkt is 537 bytes of deeply nested code. The printer asks a
  // node for its layout more than once, so printing used to take 2^depth steps
  // (about 4 seconds for this file); a node's layout is now made once per print.
  it("pretty-prints big-expression.rkt in well under a second", () => {
    const code = fs.readFileSync(
      path.join(__dirname, "../example/big-expression.rkt"),
      "utf8"
    );
    const ast = wescheme.buildAST(code);
    const start = Date.now();
    ast.toString();
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it.each(examples)(
    "%s survives text -> blocks -> text -> blocks",
    (_, code) => {
      // printing then parsing again must be stable, or toggling modes would
      // keep changing the program
      const once = wescheme.buildAST(code).toString();
      const twice = wescheme.buildAST(once).toString();
      expect(twice).toBe(once);
    }
  );

  // the biggest file takes ~3s to render, which is too slow to repeat
  const renderable = examples.filter(([f]) => f !== "huge-code.rkt");
  it.each(renderable)("%s can be loaded in the editor", (_, code) => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue(code);
    expect(cmb.getAst().rootNodes.length).toBeGreaterThan(0);
    teardown();
  });
});

describe("two editors on the same page", () => {
  const mountTwo = () => {
    const apis = [{} as API, {} as API];
    for (const id of ["editor-a", "editor-b"]) {
      const container = document.createElement("div");
      container.id = id;
      document.body.appendChild(container);
      render(
        React.createElement(CodeMirrorBlocksComponent, {
          language: wescheme,
          store: createAppStore(),
          options: {
            collapseAll: false,
            value: "",
            incrementalRendering: false,
          },
          codemirrorOptions: { historyEventDelay: 50 },
          onMount: (api: API) => {
            const wrapper = api.getCM().getWrapperElement();
            for (const prop of [
              "offsetHeight",
              "offsetWidth",
              "clientHeight",
              "clientWidth",
            ] as const) {
              jest.spyOn(wrapper, prop, "get").mockReturnValue(1000);
            }
            // the API is rebuilt on every mode switch, so keep the newest one
            Object.assign(apis[id === "editor-a" ? 0 : 1], api);
          },
        }),
        { container }
      );
    }
    return apis;
  };

  afterEach(() => {
    cleanup();
    document.getElementById("editor-a")?.remove();
    document.getElementById("editor-b")?.remove();
    jest.restoreAllMocks();
  });

  it("don't share nodes, and never duplicate ids", () => {
    const [a, b] = mountTwo();
    act(() => a.setBlockMode(true));
    act(() => b.setBlockMode(true));
    act(() => a.setValue("(f x y)"));
    act(() => b.setValue("(g z)"));
    const ids = [...document.querySelectorAll('[id^="block-node-"]')].map(
      (el) => el.id
    );
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(roots(a)).toEqual(["(f x y)"]);
    expect(roots(b)).toEqual(["(g z)"]);
  });

  it("edit independently", () => {
    const [a, b] = mountTwo();
    act(() => a.setBlockMode(true));
    act(() => b.setBlockMode(true));
    act(() => a.setValue("a b c"));
    act(() => b.setValue("(g z)"));
    const first = a.getAst().rootNodes[0];
    mouseDown(first);
    keyDown(" ", {}, first);
    keyDown("Delete", {}, first);
    expect(a.getValue()).toBe("b c");
    expect(b.getValue()).toBe("(g z)");
    expect(roots(b)).toEqual(["(g z)"]);
  });
});

describe("unmounting", () => {
  it("removes the editor from the page", () => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue("(f x y)");
    expect(document.querySelector(".CodeMirror")).not.toBeNull();
    teardown();
    expect(document.querySelector(".CodeMirror")).toBeNull();
    expect(document.querySelectorAll('[id^="block-node-"]')).toHaveLength(0);
  });
});

describe("mount options", () => {
  const mountWith = (options: object) => {
    const container = document.createElement("div");
    container.id = "options-editor";
    document.body.appendChild(container);
    const api = {} as API;
    render(
      React.createElement(CodeMirrorBlocksComponent, {
        language: wescheme,
        store: createAppStore(),
        options: { value: "", ...options },
        codemirrorOptions: { historyEventDelay: 50 },
        onMount: (newAPI: API) => {
          const wrapper = newAPI.getCM().getWrapperElement();
          for (const prop of [
            "offsetHeight",
            "offsetWidth",
            "clientHeight",
            "clientWidth",
          ] as const) {
            jest.spyOn(wrapper, prop, "get").mockReturnValue(1000);
          }
          Object.assign(api, newAPI);
        },
      }),
      { container }
    );
    // like real usage: the program is there before blocks mode starts
    act(() => api.setValue("(f x)\n(g y)"));
    act(() => api.setBlockMode(true));
    return api;
  };

  afterEach(() => {
    cleanup();
    document.getElementById("options-editor")?.remove();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  const expandedStates = (api: API) =>
    api
      .getAst()
      .rootNodes.map((n) =>
        document
          .getElementById(`block-node-${n.id}`)
          ?.getAttribute("aria-expanded")
      );

  it("by default, blocks start collapsed and fill in after a moment", () => {
    jest.useFakeTimers();
    const api = mountWith({});
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(expandedStates(api)).toEqual(["false", "false"]);
  });

  it("collapseAll: false starts every block expanded", () => {
    const api = mountWith({ collapseAll: false, incrementalRendering: false });
    expect(expandedStates(api)).toEqual(["true", "true"]);
  });

  it("incrementalRendering: false draws the blocks straight away", () => {
    const api = mountWith({ collapseAll: false, incrementalRendering: false });
    const first = api.getAst().rootNodes[0];
    expect(document.getElementById(`block-node-${first.id}`)).not.toBeNull();
  });

  it("incrementalRendering shows a cheap placeholder first, then the full block", () => {
    jest.useFakeTimers();
    const api = mountWith({ collapseAll: false, incrementalRendering: true });
    const first = api.getAst().rootNodes[0];
    expect(document.getElementById(`block-node-${first.id}`)).toBeNull();
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(document.getElementById(`block-node-${first.id}`)).not.toBeNull();
  });
});
