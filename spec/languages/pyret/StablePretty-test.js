import PyretParser from 'codemirror-blocks/languages/pyret/PyretParser';

describe('The CodeMirrorBlocks Class', function() {
  beforeEach(function() {
    this.parser = new PyretParser();
  });

  describe('testing method', function() {
    it("pretty-ify non-pretty text", function() {
      let insert = "fun f(x):\n  x + 3\nend";
      
      // see if pretty-printed now
      expect(this.parser.parse(insert).toString()).not.toBe(insert);
      expect(this.parser.parse(insert).toString()).toBe("fun f(x): x + 3 end");
    });
  });

  describe('small DS programs', function() {
    let testify = function (text, name = text, already_pretty = true) {
      return it(name, async function() {
        let result = this.parser.parse(text).toString();
        if (already_pretty) {
          expect(result).toEqual(text);
        }
        else {
          expect(result).not.toEqual(text);
        }
      });
    };

    let format = function(text, name = text) {
      testify(text, "pretty-print " + name, false);
    };

    testify(`load-spreadsheet("14er5Mh443Lb5SIFxXZHdAnLCuQZaA8O6qtgGlibQuEg")`);
    testify(`load-table: nth, name, home-state, year-started, year-ended, party
  source: presidents-sheet.sheet-by-name("presidents", true)
end`);
    testify(`x = 3`);
    testify(`x = true`);
    testify(`data-type = "string"`);
    testify(`3 + 5`);
    testify(`3 - 5`);
    testify(`"hello" + ", there"`);
    testify("fun f(x): x + 3 end");
    testify(`fun f(x, jake): x + 3 end`);
    testify(`fun f(x, jake): x + jake + 3 end`);
    testify(`fun g(): 2 * 4 end`);
    testify('f(5)');
    testify('f(5, 4)');
    testify('f()');
    testify(`x.len()`);
    testify(`l.len()`);
    testify(`x.len(3)`);
    testify(`x.len(3, 4)`);
    testify(`3 + 4 is 7`);
    testify(`check: 3 + 5 is 8 end`);
    testify(`check: 3 + 4 end`);
    format('{1;2}');
    testify('{1; 2}');
    testify('{1}');
    testify('[list: 1, 2, 3]');
    testify('[list: ]');
    format('[list:]');
    testify('row["field"]');
    testify('row[""]');
    testify('row["three word column"]');
    testify(`fun img(animal):
  ask:
    | (animal["species"] == "dog") then: dog-img
    | (animal["species"] == "cat") then: cat-img
    | (animal["species"] == "rabbit") then: rabbit-img
    | (animal["species"] == "tarantula") then: tarantula-img
    | (animal["species"] == "lizard") then: lizard-img
  end
end`);
    testify(`is-fixed :: (animal :: Row) -> Boolean`);
    testify(`include world
big-bang("inert", [list: ])

fun increment(x): x + 1 end

big-bang(10, [list: on-tick(increment)])
big-bang(10, [list: on-tick-n(increment, 3)])`);
  testify(`include reactors

fun tencrement(x): x + 10 end

reactor:
  seconds-per-tick: 0.1, title: "Count by 10", on-tick: tencrement, init: 10
end`);
  });

  describe("other pyret programs", function() {
    let testify = function(name, text) {
      it(name, async function () {
        expect(this.parser.parse(text).toString()).toEqual(text);
      })
    };

    testify("blocky function", `fun f(x) block:
  print(x)
  x + 3
end`);

    testify("ret ann function", `fun f(x) -> Number: x + 3 end`);

    testify("blocky and ret ann function", `fun f(x) -> Number block:
  print(x)
  x + 3
end`);

    testify("default lambda", `lam(x): x + 3 end`);

    testify("lambda with ret ann", `lam(x) -> Number: x + 3 end`);

    testify("lambda with block", `lam(x) block: x + 3 end`);

    testify("lambda with ret ann and block", `lam(x) -> Number block: x + 3 end`);

    testify("simple if", `if x == 4:
  4
end`);

    testify("simple if and else", `if x == 3:
  2
else:
  3
end`);

    testify("if with else if's", `if x == 5:
  5
else if x >= 5:
  7
else if x < 3:
  2
end`);

    testify("if with else if's and else", `if x == 5:
  5
else if x >= 5:
  7
else if x < 3:
  2
else:
  0
end`);

    testify('if inside of a function', `fun f(x):
  if x > 3:
    "hello"
  else:
    "goodbye"
  end
end`);

    testify('for each', `for each(n from non-nums): a1.get-now(n) raises "Number" end`);
    testify('for build-array', `for build-array(i from 7): (i * i) - i end`);
    testify('for each check', `for each(i from range(1, 4)): raw-array-get(a1, i) is "init" end`);
    testify('multiple fors', `for raw-array-fold(acc from 0, elt from bigarr, ix from 0):
  for raw-array-fold(acc2 from acc, elt2 from bigarr, ix2 from 0):
    acc2 + elt2
  end
end`);
    testify('should display parens', `(i * i) - i`);
    testify('when', `when not(is-array(v)):
  raise("not an Array")
end`);
    testify('a-app', `fun f(v :: Array<Number>) block:
  when not(is-array(v)):
    raise("not an Array")
  end
  v
end`);
  });
});
