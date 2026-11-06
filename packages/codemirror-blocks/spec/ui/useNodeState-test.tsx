import { act, render } from "@testing-library/react";
import React from "react";
import { AST } from "../../src/ast";
import Context from "../../src/components/Context";
import Node, { useNodeState } from "../../src/components/Node";
import { addLanguage } from "../../src/languages";
import { Literal } from "../../src/nodes";
import * as actions from "../../src/state/actions";
import { AppStore, createAppStore } from "../../src/state/store";

let store!: AppStore;
beforeEach(() => {
  store = createAppStore();
});

const lang = addLanguage({
  id: "node-state-lang",
  name: "n",
  parse: jest.fn(),
});

/** what a language module's own component would show, from the block's state */
const States = () => {
  const state = useNodeState();
  return (
    <b data-testid="state">
      {Object.entries(state)
        .filter(([, on]) => on)
        .map(([name]) => name)
        .join(" ")}
    </b>
  );
};

const lit = (ch: number) =>
  Literal({ line: 0, ch }, { line: 0, ch: ch + 1 }, "x", "symbol");

const mount = (inToolbar = false) => {
  const ast = AST.from(lang.id, [lit(0), lit(2)]);
  store.dispatch(actions.setAST(ast));
  const result = render(
    <Context store={store}>
      {ast.rootNodes.map((node) => (
        <Node key={node.id} node={node} inToolbar={inToolbar}>
          <States />
        </Node>
      ))}
    </Context>
  );
  const states = () =>
    result.getAllByTestId("state").map((el) => el.textContent);
  return { ast, states };
};

it("says nothing outside a block", () => {
  const Lone = () => <i data-testid="lone">{JSON.stringify(useNodeState())}</i>;
  const result = render(<Lone />);
  expect(JSON.parse(result.getByTestId("lone").textContent ?? "")).toEqual({
    focused: false,
    selected: false,
    collapsed: false,
    dragging: false,
    over: false,
    errored: false,
    inToolbar: false,
  });
});

it("starts with nothing on", () => {
  expect(mount().states()).toEqual(["", ""]);
});

it("follows focus from block to block", () => {
  const { ast, states } = mount();
  act(() => {
    store.dispatch(actions.setFocusedNode(ast.rootNodes[1]));
  });
  expect(states()).toEqual(["", "focused"]);
  act(() => {
    store.dispatch(actions.setFocusedNode(ast.rootNodes[0]));
  });
  expect(states()).toEqual(["focused", ""]);
});

it("follows the selection", () => {
  const { ast, states } = mount();
  act(() => {
    store.dispatch(actions.setSelectedNodeIds([ast.rootNodes[0].id]));
  });
  expect(states()).toEqual(["selected", ""]);
  act(() => {
    store.dispatch(actions.setSelectedNodeIds([]));
  });
  expect(states()).toEqual(["", ""]);
});

it("follows a block being collapsed and expanded", () => {
  const { ast, states } = mount();
  act(() => {
    store.dispatch(actions.collapseNode(ast.rootNodes[1]));
  });
  expect(states()).toEqual(["", "collapsed"]);
  act(() => {
    store.dispatch(actions.uncollapseNode(ast.rootNodes[1]));
  });
  expect(states()).toEqual(["", ""]);
});

it("marks the block whose edit was refused, and moves it with the error", () => {
  const { ast, states } = mount();
  act(() => {
    store.dispatch(actions.setErrorId(ast.rootNodes[0].id));
  });
  expect(states()).toEqual(["errored", ""]);
  // (from one block straight to the other)
  act(() => {
    store.dispatch(actions.setErrorId(ast.rootNodes[1].id));
  });
  expect(states()).toEqual(["", "errored"]);
  act(() => {
    store.dispatch(actions.clearError());
  });
  expect(states()).toEqual(["", ""]);
});

it("says when the block is in the toolbar", () => {
  expect(mount(true).states()).toEqual(["inToolbar", "inToolbar"]);
});

it("does not draw a block again when another one's state changes", () => {
  const counts = [0, 0];
  const Counting = ({ index }: { index: number }) => {
    useNodeState();
    counts[index]++;
    return null;
  };
  const ast = AST.from(lang.id, [lit(0), lit(2)]);
  store.dispatch(actions.setAST(ast));
  render(
    <Context store={store}>
      {ast.rootNodes.map((node, i) => (
        <Node key={node.id} node={node}>
          <Counting index={i} />
        </Node>
      ))}
    </Context>
  );
  const before = [...counts];
  act(() => {
    store.dispatch(actions.setFocusedNode(ast.rootNodes[0]));
  });
  expect(counts[0]).toBeGreaterThan(before[0]);
  expect(counts[1]).toBe(before[1]);
});
