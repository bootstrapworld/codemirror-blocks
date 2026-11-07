import { render } from "@testing-library/react";
import React from "react";
import { AST } from "../../src/ast";
import Args from "../../src/components/Args";
import Context from "../../src/components/Context";
import Node from "../../src/components/Node";
import { Literal, Unknown } from "../../src/nodes";
import { addLanguage } from "../../src/languages";
import { createAppStore } from "../../src/state/store";

const lang = addLanguage({ id: "args-lang", name: "a", parse: jest.fn() });
const at = (ch: number) => ({ line: 0, ch });
const lit = (ch: number) =>
  Literal(at(ch), at(ch + 1), { value: "x", dataType: "symbol" });

/** a node that draws two arguments with `Args`, and `className` if it is given */
const mount = (className?: string) => {
  const ast = AST.from(lang.id, [
    Unknown(at(0), at(5), { elts: [lit(1), lit(3)] }),
  ]);
  const store = createAppStore();
  const [node] = ast.rootNodes;
  const args = node.fields.elts as ReturnType<typeof lit>[];
  return render(
    <Context store={store}>
      <Node node={node}>
        <Args className={className} field="elts">
          {args}
        </Args>
      </Node>
    </Context>
  );
};

describe("Args", () => {
  it("draws a drop target before and after each argument", () => {
    const { container } = mount();
    expect(container.querySelectorAll(".blocks-drop-target")).toHaveLength(3);
    const indexes = [
      ...container.querySelectorAll<HTMLElement>(".blocks-drop-target"),
    ].map((el) => el.dataset.index);
    expect(indexes).toEqual(["0", "1", "2"]);
  });

  it("draws no container of its own without a className", () => {
    const { container } = mount();
    const node = container.querySelector(".blocks-unknown")!;
    // (the arguments and the targets are children of the block itself)
    expect(
      [...node.children].every((el) => !el.matches("span:not([id])"))
    ).toBe(true);
  });

  it("draws them in a span of that class with one", () => {
    const { container } = mount("blocks-args");
    const box = container.querySelector("span.blocks-args")!;
    expect(box).not.toBeNull();
    expect(box.querySelectorAll(".blocks-drop-target")).toHaveLength(3);
    expect(box.querySelectorAll('[role="treeitem"]')).toHaveLength(2);
    // (and nothing else is outside it: the block holds the container)
    expect(box.parentElement?.classList.contains("blocks-unknown")).toBe(true);
  });
});
