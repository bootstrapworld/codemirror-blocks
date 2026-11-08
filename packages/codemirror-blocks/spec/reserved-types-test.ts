import { defineNode, field } from "../src/defineNode";
import { Literal } from "../src/nodes";
import routine from "../src/languages/routine";

const warnings = () =>
  (console.warn as jest.Mock).mock.calls.map((c) => String(c[0]));

describe("a kind of node with a reserved type", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  const kind = (type: string) =>
    defineNode({
      type,
      label: "thing",
      fields: { value: field.value<string>() },
      pretty: (node) => node.fields.value,
      render: () => undefined,
    });

  it("is warned about, once, with what to do", () => {
    kind("operator");
    kind("operator");
    expect(warnings().filter((w) => w.includes('"operator"'))).toHaveLength(1);
    expect(warnings()[0]).toMatch(/use another type/);
  });

  it("is not warned about when its type is its own", () => {
    kind("shoutout");
    expect(warnings()).toEqual([]);
  });

  it("is not warned about for the core nodes, or for Routine's", () => {
    expect(Literal.type).toBe("literal");
    expect(routine.id).toBe("routine");
    expect(warnings()).toEqual([]);
  });
});
