import PyretParser from 'codemirror-blocks/languages/pyret/PyretParser';

let ariaLabel = "aria-label";

describe("Pyret node aria-labels", function() {
  beforeEach(function() {
    this.parser = new PyretParser();
  });

  let simple_test = function(text, label) {
    it(`${text} should have label ${label}`, function() {
      let parsed = this.parser.parse(text);
      expect(parsed.rootNodes[0].options[ariaLabel]).toBe(label);
    });
  };

  let closure_test = function(text, c, label, piece_label = label) {
    it(`${text}'s ${piece_label} should have label ${label}`, function() {
      let parsed = this.parser.parse(text);
      let ast = parsed.rootNodes[0];
      let to_test = c(ast);
      expect(to_test.options[ariaLabel]).toBe(label);
    });
  };

  it("should have a label for identifiers", function () {
    let text = "x = 3";
    expect(this.parser.parse(text).rootNodes[0].ident.options[ariaLabel]).not.toBe(undefined);
  });

  it("should say only identifier name", function() {
    let text = "x = 3";
    expect(this.parser.parse(text).rootNodes[0].options[ariaLabel]).toBe("x, a value definition");
  });

  it("should have a label for shared-gdrive in include", function() {
    let text = `include shared-gdrive("string", "xxxx")`;
    expect(this.parser.parse(text).rootNodes[0].mod.func.options[ariaLabel]).not.toBe(undefined);
  });

  it("should name the binary operator", function() {
    let text = "x + 3";
    let parsed = this.parser.parse(text);
    expect(parsed.rootNodes[0].options[ariaLabel]).not.toBe("x  3");
  });

  let table_text = `load-table: name, species, gender, age, fixed, legs, pounds, weeks
  source: shelter-sheet.sheet-by-name("pets", true)
end`;

  simple_test(table_text, "load table with 8 columns");

  it("table fields should be columns", function() {
    let parsed = this.parser.parse(table_text);
    expect(parsed.rootNodes[0].columns[0].option[ariaLabel]).toBe("name, a column");
  });

  simple_test("fun f(x): x + 3 end", "f, a function definition with 1 input x");
  simple_test("fun g(): 5 + 3 end", "g, a function definition with no inputs");
  simple_test("fun h(a, b):  a * b end", "h, a function definition with 2 inputs: a, b");
  simple_test(`row["name"]`, `"name" of row, a lookup expression`);

  simple_test(`reactor:
  init: 10,
  on-tick: increase
end`, "reactor");

  it("branches of ask should be labeled with number", function() {
    let text = `ask:
  | (animal["species"] == "dog") then: dog-img
  | (animal["species"] == "cat") then: cat-img
  | (animal["species"] == "rabbit") then: rabbit-img
  | (animal["species"] == "tarantula") then: tarantula-img
  | (animal["species"] == "lizard") then: lizard-img
end`;
    let parsed = this.parser.parse(text);
    let ask_node = parsed.rootNodes[0];

    for (let i = 0; i < ask_node.branches.length; i++) {
      expect(ask_node.branches[i].option[ariaLabel]).toBe(`branch ${i + 1}`);
    }
  });

  closure_test(`include shared-gdrive("Bootstrap-DataScience-v1.4.arr", "189UgLQQ3Eag5JtrxpBjFzLMS3BO9rA21")`,
    e => e.args[0], "resource name", "resource name");

  closure_test(`include shared-gdrive("Bootstrap-DataScience-v1.4.arr", "189UgLQQ3Eag5JtrxpBjFzLMS3BO9rA21")`,
    e => e.args[1], "resource url", "resource extension");
});