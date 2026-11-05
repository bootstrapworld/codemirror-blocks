import type { AST, ASTNode } from "../src/ast";
import lambda from "../src/languages/lambda";
import wescheme from "../src/languages/wescheme";
import { select } from "./helpers/gestures";
import { scanSchemeComments } from "../src/orphans";
import { summarizeProgram } from "../src/summary";
import {
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";

afterEach(teardown);

const languages = { lambda, wescheme };
type Name = keyof typeof languages;

/** What kind of node each node is, `*` for an orphan comment, `+` for one with a comment */
const shape = (ast: AST) =>
  [...ast.getAllNodes()]
    .map(
      (n) =>
        n.type + (n.options.orphan ? "*" : "") + (n.options.comment ? "+" : "")
    )
    .join(" ");
const orphans = (ast: AST) =>
  [...ast.getAllNodes()].filter((n) => n.options.orphan);

/** Printing and reading what was printed gives the same program again */
function roundTrips(name: Name, code: string) {
  const lang = languages[name];
  const ast = lang.buildAST(code);
  const once = ast.toString();
  const again = lang.buildAST(once);
  expect(again.toString()).toBe(once);
  expect(shape(again)).toBe(shape(ast));
  return { ast, once };
}

describe("which comments go with a node, and which are orphans", () => {
  describe("in lambda", () => {
    const shapeOf = (code: string) => shape(lambda.buildAST(code));
    it("a comment on the line above goes with the node", () => {
      expect(shapeOf("# c\nx = 1")).toBe("prog assignment+ literal literal");
    });
    it("a comment with a blank line between it and the node is an orphan", () => {
      expect(shapeOf("# c\n\nx = 1")).toBe(
        "prog comment* assignment literal literal"
      );
    });
    it("a comment after code, on its line, goes with that code", () => {
      expect(shapeOf("x = 1 # c\n;y = 2")).toBe(
        "prog assignment+ literal literal assignment literal literal"
      );
    });
    it("a comment at the end goes with the last node, unless a blank line is between", () => {
      expect(shapeOf("x = 1\n# c")).toBe("prog assignment+ literal literal");
      expect(shapeOf("x = 1\n\n# c")).toBe(
        "prog assignment literal literal comment*"
      );
    });
    it("a program of only a comment is a program of an orphan", () => {
      expect(shapeOf("# only")).toBe("prog comment*");
    });
    it("an orphan can be in a block and in an argument list", () => {
      expect(shapeOf("{ a;\n\n# c\n\nb }")).toBe(
        "prog prog literal comment* literal"
      );
      expect(shapeOf("f(a,\n\n# c\n\nb)")).toBe(
        "prog call literal literal comment* literal"
      );
    });
    it("goes with the next node where the list cannot hold one", () => {
      expect(shapeOf("let (a = 1,\n\n# c\n\nb = 2) a")).toBe(
        "prog letExpr vardef literal literal vardef+ literal literal literal"
      );
    });
  });

  describe("in WeScheme", () => {
    const shapeOf = (code: string) => shape(wescheme.buildAST(code));
    it("a comment on the line above goes with the node", () => {
      expect(shapeOf("; c\n(f x)")).toBe("functionApp+ literal literal");
    });
    it("a comment with a blank line between it and the node is an orphan", () => {
      expect(shapeOf("; c\n\n(f x)")).toBe(
        "comment* functionApp literal literal"
      );
    });
    it("a comment after code, on its line, goes with that code", () => {
      expect(shapeOf("(f x) ; c")).toBe("functionApp+ literal literal");
    });
    it("a comment at the end goes with the last node, unless a blank line is between", () => {
      expect(shapeOf("(f x)\n; c")).toBe("functionApp+ literal literal");
      expect(shapeOf("(f x)\n\n; c")).toBe(
        "functionApp literal literal comment*"
      );
    });
    it("a comment above a node goes with it, after a form as short as a quote mark", () => {
      // (two forms in a program, the first one or two characters long, are not
      // a quote mark and the form it quotes)
      expect(shapeOf("b\n#| note |#\nc")).toBe("literal literal+");
      expect(shapeOf("7\n; note\nzzz")).toBe("literal literal+");
      expect(shapeOf("#| c |#\n'x")).toBe("literal+");
    });
    it("a blank (...) keeps the comment that goes with it", () => {
      expect(shapeOf("(f a ... #| c |#)")).toBe(
        "functionApp literal literal blank+"
      );
      expect(shapeOf("(f 1)\n#| c |#\n...")).toBe(
        "functionApp literal literal blank+"
      );
    });
    it("a comment before a form on its line is not in a row with the comment on the next line", () => {
      expect(shapeOf("#| c |# z\n#| d |# y")).toBe("literal+ literal+");
      expect(shapeOf("#| c |# z\n#| c |# z\n(f x)")).toBe(
        "literal+ literal+ functionApp literal literal"
      );
    });
    it("a program of only a comment is a program of an orphan", () => {
      expect(shapeOf("#| only |#")).toBe("comment*");
    });
    it("an orphan can be among the arguments and the expressions of a begin", () => {
      expect(shapeOf("(f a\n\n; c\n\nb)")).toBe(
        "functionApp literal literal comment* literal"
      );
      expect(shapeOf("(begin a\n\n; c\n\nb)")).toBe(
        "sequence literal literal comment* literal"
      );
    });
    it("goes with the next node where the list cannot hold one", () => {
      expect(shapeOf("(let ((a 1)\n\n; c\n\n(b 2)) a)")).toBe(
        "letLikeExpr sequence literal variableDefinition literal literal variableDefinition+ literal literal literal"
      );
    });
  });
});

describe("printing and reading back", () => {
  const programs: [Name, string][] = [
    ["lambda", "# only"],
    ["lambda", "# a\n\nx = 1;\n\n# b\n\ny = 2\n\n# end"],
    ["lambda", "x = 1\n\n# end"],
    ["lambda", "f(a,\n\n# c\n\nb)"],
    ["lambda", "f(a,\n\n# first\n\n# second\n\nb)"],
    ["lambda", "{ a;\n\n# c\n\nb }"],
    ["lambda", "f(a\n\n# last\n\n)"],
    ["lambda", "f(# c\n a)"],
    ["wescheme", "; only"],
    ["wescheme", "; a\n\n(define x 1)\n\n; b\n\n(define y 2)\n\n; end"],
    ["wescheme", "(f a\n\n; c\n\nb)"],
    ["wescheme", "(begin\n\n; first\n\n; second\n\na)"],
    ["wescheme", "(f a\n\n; last\n\n)"],
    ["wescheme", "(cond\n[a b\n\n; c\n\nd])"],
    // (found by random runs)
    ["wescheme", "#| c |# z\n'sym"],
    ["wescheme", "(let (#| c |# [a 1]) a)"],
    ["lambda", "x = (#| true |#\n 1)"],
  ];
  it.each(programs)("%s: %j keeps its orphans", (name, code) => {
    const { ast } = roundTrips(name, code);
    const comments =
      languages[name].buildAST(code).toString().match(/#\|/g) ?? [];
    expect(comments.length).toBeGreaterThan(0);
    expect(
      orphans(ast).length +
        [...ast.getAllNodes()].filter((n) => n.options.comment).length
    ).toBe(comments.length);
  });

  it("comments between the parts of a structure definition read back as they were", () => {
    roundTrips(
      "wescheme",
      '(define-struct posn\n  (#| note |#\n   #| "hi" |#\n   g\n   w))'
    );
  });

  it("a comment with the marks of a block comment in it is printed so that it reads back", () => {
    // (a line comment may hold them: `; a #| b |# c`)
    const ast = wescheme.buildAST("a\n; note #| b |# c\nd");
    const text = ast.toString();
    const again = wescheme.buildAST(text);
    expect(again.toString()).toBe(text);
    expect(shape(again)).toBe(shape(ast));
  });

  it("lambda: a call of a call is an operand, and prints so that it reads back", () => {
    // (found by random runs: `f()() + 1` was not read)
    for (const code of ["f()() + 1", "(f())() + 1", '1 + "hi"()()']) {
      const once = lambda.buildAST(code).toString();
      expect(lambda.buildAST(once).toString()).toBe(once);
    }
  });

  it("an orphan is printed with a blank line after it", () => {
    expect(wescheme.buildAST("(f a\n\n; c\n\nb)").toString()).toBe(
      "(f\n a\n #| c |#\n \n b)"
    );
  });

  it("an orphan in an argument list does not become an argument", () => {
    const ast = lambda.buildAST("f(a,\n\n# c\n\nb)");
    const [prog] = ast.rootNodes;
    const call = [...prog.children()][0];
    expect(call.describe(call.level)).toBe(
      "a call to literal with 2 arguments"
    );
    expect(prog.describe(prog.level)).toBe("a program with 1 expressions");
  });
});

describe("a comment and the node it goes with", () => {
  it("is data on the node, not a node of the tree", () => {
    const ast = wescheme.buildAST("; c\n(f x)");
    expect(orphans(ast)).toHaveLength(0);
    expect(
      ast.getAllNodes().next().value?.options.comment?.fields.comment
    ).toBe("c");
    expect([...ast.getAllNodes()].map((n) => n.type)).toEqual([
      "functionApp",
      "literal",
      "literal",
    ]);
  });
});

describe("orphans in the tree", () => {
  const ast = () => wescheme.buildAST("(f a\n\n; c\n\nb)\n\n; d\n\n(g)");
  const nodes = (a: AST) => [...a.getAllNodes()];

  it("are siblings: they have places among the nodes beside them", () => {
    const a = ast();
    const [f, fn, x, c, b, d] = nodes(a);
    expect([f.type, c.type, d.type]).toEqual([
      "functionApp",
      "comment",
      "comment",
    ]);
    expect(c.ariaSetSize).toBe(4); // (the function, a, the comment, b)
    expect(c.ariaPosInset).toBe(3);
    expect(a.getNodeParent(c)).toBe(f);
    expect(a.getNodeAfter(x)).toBe(c);
    expect(a.getNodeAfter(c)).toBe(b);
    expect(a.getNodeBefore(b)).toBe(c);
    expect(a.rootNodes[1]).toBe(d);
    expect(fn.type).toBe("literal");
  });

  it("read as their text", () => {
    const a = ast();
    expect(nodes(a)[3].shortDescription()).toBe("comment: c");
  });

  it("are counted in a summary of the program, as comments", () => {
    expect(summarizeProgram(ast().rootNodes)).toBe(
      "At the top level, this program contains 2 function applications and 1 comment."
    );
  });

  it("are not counted as arguments", () => {
    const f = ast().rootNodes[0];
    expect(f.describe(f.level)).toBe(
      "applying the function f to 2 arguments 1: a, 2: b"
    );
  });
});

describe("deleting", () => {
  /** the text after pressing Delete on the nth node (counting all of them) */
  const afterDeleting = (name: Name, code: string, n: number) => {
    const { cmb } = mountCMB(languages[name]);
    cmb.setValue(code);
    const node: ASTNode = [...cmb.getAst().getAllNodes()][n];
    select(node);
    keyDown("Delete", {}, node);
    return cmb.getValue();
  };

  it("an orphan deletes it", () => {
    expect(afterDeleting("wescheme", "(f a\n\n; c\n\nb)", 3)).toBe("(f a b)");
  });

  it("an owner with a comment leaves the comment, as an orphan", () => {
    const text = afterDeleting("wescheme", "(f\n; c\na b)", 2);
    expect(text).not.toContain("a");
    const ast = wescheme.buildAST(text);
    expect(orphans(ast).map((o) => o.fields.comment)).toEqual(["c"]);
  });

  it("a root owner with a comment leaves the comment, as an orphan", () => {
    const text = afterDeleting("lambda", "# c\nx = 1;\ny = 2", 1);
    const ast = lambda.buildAST(text);
    expect(orphans(ast).map((o) => o.fields.comment)).toEqual(["c"]);
    expect(text).not.toContain("x");
  });
});

describe("Edit Comment on an orphan", () => {
  it("does nothing: a comment block is edited with Enter", () => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue("; c\n\n(f x)");
    const orphan = cmb.getAst().rootNodes[0];
    expect(orphan.options.orphan).toBe(true);
    mouseDown(orphan);
    keyDown("]", { ctrlKey: true, shiftKey: true }, orphan);
    expect(document.activeElement?.getAttribute("contenteditable")).not.toBe(
      "true"
    );
  });

  it("is edited with Enter, like any block", () => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue("; c\n\n(f x)");
    const orphan = cmb.getAst().rootNodes[0];
    mouseDown(orphan);
    keyDown("Enter", {}, orphan);
    expect(document.activeElement?.getAttribute("contenteditable")).toBe(
      "true"
    );
  });
});

describe("a comment after an opening bracket", () => {
  it("does not join the row of comments above its line", () => {
    const code = "#| a |#\n#| b |#\n(#| c |#\n w)";
    const found = scanSchemeComments(code);
    expect(found.map((c) => c.text)).toEqual(["a b", "c"]);
    expect(found[0].to.line).toBe(1);
    roundTrips("wescheme", code);
  });
});

describe("printing what was found in the soak", () => {
  it("a comment alone between the brackets of a function header is printed as it was", () => {
    // (there is no function in `()`: printing `...` there made the header
    // another form, which read the comment back as one on the body)
    const { ast, once } = roundTrips(
      "wescheme",
      "(define (#| note |# )\n  (...\n   #| 7 |#\n   ))"
    );
    expect(orphans(ast).map((o) => o.fields.comment)).toEqual(["note", "7"]);
    expect(once).not.toMatch(/\(\.\.\.\s+#\| note/);
  });

  it("a string keeps its escapes", () => {
    const { once } = roundTrips("wescheme", '(f "say \\"hi\\" now" "a\\tb")');
    expect(once).toBe('(f "say \\"hi\\" now" "a\\tb")');
  });

  it("a symbol with bars in it is printed as it was written", () => {
    const { once } = roundTrips("wescheme", "rotate| note |#\n7");
    expect(once).toContain("rotate| note |#");
  });

  it("a call of a parenthesised operand starts where the operand does", () => {
    const ast = lambda.buildAST("(!x)(y);\n(a)(b)");
    const calls = [...ast.getAllNodes()].filter((n) => n.type === "call");
    expect(calls.map((c) => c.srcRange().from)).toEqual([
      { line: 0, ch: 0 },
      { line: 1, ch: 0 },
    ]);
  });

  it("a comment above a list of names is one on its first name, and prints once", () => {
    // (the list has no brackets of its own: printed above it, it was inside
    // them, and read back a third time)
    const code = "(define-struct\n posn\n #| note |#\n (#| note |#\n w))";
    const { ast, once } = roundTrips("wescheme", code);
    expect(once.match(/note/g)).toHaveLength(2);
    expect(
      [...ast.getAllNodes()].filter((n) => n.type === "identifierList")[0]
        .options.comment
    ).toBeUndefined();
  });
});
