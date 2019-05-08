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
});