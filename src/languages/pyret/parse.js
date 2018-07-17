const R = require("requirejs");

R.config({
  paths: {
    'jglr': "pyret-lang/lib/jglr/",
    'pyret-base': "pyret-lang/build/phase0",
    'src-base/js': "pyret-lang/src/js/base"
  }
});

R(["pyret-base/js/pyret-tokenizer", "pyret-base/js/pyret-parser", "fs"], function(T, G, fs) {

  function toTime(hrtime) {
    const NS_PER_MS = 1e6;
    return (hrtime[0] * NS_PER_MS + hrtime[1]) / NS_PER_MS;
  }

  console.log(process.argv[2]);
  // Read file
  var start = process.hrtime();
  const data = fs.readFileSync(process.argv[2], {encoding: "utf-8"});
  var readingTime = process.hrtime(start);
  // Tokenize and parse
  const toks = T.Tokenizer;
  toks.tokenizeFrom(data);
  start = process.hrtime();
  var parsed = G.PyretGrammar.parse(toks);
  var parsedTime = process.hrtime(start);
  if (parsed) {
    // Count ASTs
    start = process.hrtime();
    var countParses = G.PyretGrammar.countAllParses(parsed);
    var countTime = process.hrtime(start);
    console.log("There are " + countParses + " potential parses");
    if (countParses === 1) {
      // Construct AST
      start = process.hrtime();
      var ast = G.PyretGrammar.constructUniqueParse(parsed);
      var astTime = process.hrtime(start);
      console.log("AST constructed");
      // Print AST
      start = process.hrtime()
      var astStr = ast.toString(true);
      var tostrTime = process.hrtime(start);

      console.log("Times are in ms:");
      [ {"reading  ": toTime(readingTime).toFixed(10)},
        {"parsing  ": toTime(parsedTime).toFixed(10)},
        {"counting ": toTime(countTime).toFixed(10)},
        {"ast      ": toTime(astTime).toFixed(10)},
        {"toString ": toTime(tostrTime).toFixed(10)}
      ].forEach((e) => console.log(e));

      console.log("ast.toString().length = " + astStr.length)
      console.log(astStr);
      console.log(ast);
      return ast;
    } else {
      throw "Multiple parses";
    }
  } else {
    console.log("Invalid parse");
    console.log("Next token is " + toks.curTok.toRepr(true) + " at " + toks.curTok.pos.toString(true));
  }
});
