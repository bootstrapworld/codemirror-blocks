import PyretParser from 'codemirror-blocks/languages/pyret/PyretParser';
import _wescheme from '../../../src/languages/wescheme';

describe("The Pyret Parser,", function() {
  beforeEach(function() {
    this.parser = new PyretParser();
  });

  it("should set the appropriate data type for literals", function() {
    let test = (str, dt) => {
      expect(this.parser.parse(str).rootNodes[0].dataType).toBe(dt);
    };
    test('true', 'boolean');
    test('1', 'number');
    test('"true"', 'string');
    test('x', 'symbol');
  });

  it("should have some label for literals", function () {
    let test = (str) => expect(this.parser.parse(str).rootNodes[0].options["aria-label"]).not.toBe(undefined);
    test('true');
    test('1');
    test('"hello"');
    test('x');
  });

  it("should have some label for Bootstrap constructs", function() {
    let test = (str) => expect(this.parser.parse(str).rootNodes[0].options["aria-label"]).not.toBe(undefined);
    /**
     * From Justin and Emmanuel
     * import
     * load-spreadhseet
	   * load-table
	   * simple let bindings -> improve stylings and rendering
	   * funciton definition -> works
	   * func app -> similar as simple let (s-app NYI)
	   * method invocation -> same
	   * binop -> works
	   * check-expects -> hash error
	   * is -> not recognized as an operator
	   * tuples -> NYI
	   * constructor ([list: 1, 2, 3]) -> all except styling
	   * dot accessor
	   * if would be nice to have
     */
    // includes aren't part of the parse tree for now
    // test('include gdrive-sheets');
    // ends up just being fun app
    test('load-spreadsheet("14er5Mh443Lb5SIFxXZHdAnLCuQZaA8O6qtgGlibQuEg")');
    test(`load-table: nth, name, home-state, year-started, year-ended, party
  source: presidents-sheet.sheet-by-name("presidents", true)
end`);
    test(`x = 3`);
    test(`x = true`);
    test(`data-type = "string"`);
    test(`3 + 5`);
    test(`3 - 5`);
    test(`"hello" + ", there"`);
    test(`fun f(x): x + 3 end`);
    test(`fun f(x, jake): x + 3 end`);
    test(`fun f(x, jake): x + jake + 3 end`);
    test(`fun g(): 2 * 4 end`);
    // don't need blocks for BS:DS
    /*test(`fun g() block: 2 * 4 end`)
    test(`fun g():
  block:
    x = 2 * 4
    x
  end
end`)
    test(`fun g() block:
  x = 2 * 4
  x
end`)*/
    test('f(5)');
    test('f(5, 4)');
    test('f()');
    test(`x.len()`); // actually not the right test since shows up as funapp
    test(`l.len()`);
    test(`x.len(3)`);
    test(`x.len(3, 4)`);
    test(`3 + 4 is 7`);
    test(`check: 3 + 5 is 8 end`);
    test(`check "arithmetic": 3 + 5 is 8 end`);
    test(`check: 3 + 4 end`);
    test('{1;2}');
    test('{1; 2}');
    test('{1}');
    test(`tupple.{0}`);
    // test('{}');
    test('[list: 1, 2, 3]');
    test('[list: 1]');
    test('[list: ]');
    test('[list:]');
    test('row["field"]');
    test('row[""]');
    test('row["three word column"]');
    test('row[0]');
  });

  it("should render the sample ds pyret program", function() {
    let text = `# include gdrive-sheets

load-spreadsheet("14er5Mh443Lb5SIFxXZHdAnLCuQZaA8O6qtgGlibQuEg")

load-table: nth, name, home-state, year-started, year-ended, party
  source: presidents-sheet.sheet-by-name("presidents", true)
end

x = 3

3 + 5

fun f(x): x + 3 end

f(5)

l = [list: 1, 2, 3]

l.len()

check:
  3 + 5 is 8
end

{1; 2}

row["field"]`;

    expect(this.parser.parse(text).rootNodes[0].options["aria-label"]).not.toBe(undefined);
  });

  it("should render Emmanuel's demo ds program", function() {
    let text = `# include the DataScience Library
include shared-gdrive("Bootstrap-DataScience-v1.4.arr", "189UgLQQ3Eag5JtrxpBjFzLMS3BO9rA21")
# include Google Sheets and Tables library
include gdrive-sheets
include tables
include image

# load the file
shelter-sheet = load-spreadsheet("19m1bUCQo3fCzmSEmWMjTfnmsNIMqiByLytHE0JYtnQM")

# load the ‘animals’ sheet as a table
animals-table = load-table: name, species, gender, age, fixed, legs, pounds, weeks
 source: shelter-sheet.sheet-by-name("pets", true)
end

fun is-cat(r): r["species"] == "cat" end
fun is-dog(r): r["species"] == "dog" end
fun is-fixed(r): r["fixed"] end

cats = animals-table.filter(is-cat)
dogs = animals-table.filter(is-dog)

dog-img = bitmap-url("http://icons.iconarchive.com/icons/shrikant-rawa/animals/64/dog-icon.png")
cat-img = bitmap-url("http://icons.iconarchive.com/icons/iconka/saint-whiskers/64/cat-food-hearts-icon.png")
rabbit-img = bitmap-url("http://icons.iconarchive.com/icons/yellowicon/easter/64/rabbit-icon.png")
tarantula-img = bitmap-url("http://icons.iconarchive.com/icons/kearone/helloween/64/spider-icon.png")
lizard-img = bitmap-url("http://icons.iconarchive.com/icons/google/noto-emoji-animals-nature/64/22284-lizard-icon.png")

fun img(animal):
 ask:
   | (animal["species"] == "dog") then: dog-img
   | (animal["species"] == "cat") then: cat-img
   | (animal["species"] == "rabbit") then: rabbit-img
   | (animal["species"] == "tarantula") then: tarantula-img
   | (animal["species"] == "lizard") then: lizard-img
 end
end`;
    let parsed = this.parser.parse(text);
    for (let i = 0; i < parsed.rootNodes.length; i++) {
      expect(parsed.rootNodes[i].options["aria-label"]).not.toBe(undefined);
    }
  })
});
