//test suite for the lambda parser

import main from 'codemirror-blocks/languages/lambda/main';

var codeUnits = [
  '123.5',
  `"Hello World!"`,
  'true',
  'false',
  'foo',
  'lambda (x) 10',
  'foo(a, 1)',
  'if foo then bar else baz',
  'if foo then bar',
  'a = 10',
  'x + y * z',
  `a = 5;
  b = a * 2;
  a + b;`,
  `let (a = 10, b = a * 10) {
  	a + b;}`];

var astUnits = [
{ type: "num", value: 123.5 },
{ type: "str", value: "Hello World!" },
{ type: "bool", value: true },
{ type: "bool", value: false },
{ type: "var", value: "foo" }, 
{  type: "lambda",
  vars: [ "x" ],
  body: { type: "num", value: 10 }
},
  {
    "type": "call",
    "func": { "type": "var", "value": "foo" },
    "args": [
    { "type": "var", "value": "a" },
    { "type": "num", "value": 1 }
    ]
  },
  {
    "type": "if",
    "cond": { "type": "var", "value": "foo" },
    "then": { "type": "var", "value": "bar" },
    "else": { "type": "var", "value": "baz" }
  },
  {
    "type": "if",
    "cond": { "type": "var", "value": "foo" },
    "then": { "type": "var", "value": "bar" }
  },
  {
    "type": "assign",
    "operator": "=",
    "left": { "type": "var", "value": "a" },
    "right": { "type": "num", "value": 10 }
  },
  {
    "type": "binary",
    "operator": "+",
    "left": { "type": "var", "value": "x" },
    "right": {
      "type": "binary",
      "operator": "*",
      "left": { "type": "var", "value": "y" },
      "right": { "type": "var", "value": "z" }
    }
  },
  {
    "type": "prog",
    "prog": [
      {
        "type": "assign",
        "operator": "=",
        "left": { "type": "var", "value": "a" },
        "right": { "type": "num", "value": 5 }
      },
      {
        "type": "assign",
        "operator": "=",
        "left": { "type": "var", "value": "b" },
        "right": {
          "type": "binary",
          "operator": "*",
          "left": { "type": "var", "value": "a" },
          "right": { "type": "num", "value": 2 }
        }
      },
      {
        "type": "binary",
        "operator": "+",
        "left": { "type": "var", "value": "a" },
        "right": { "type": "var", "value": "b" }
      }
    ]
  },
  {
    "type": "let",
    "vars": [
      {
        "name": "a",
        "def": { "type": "num", "value": 10 }
      },
      {
        "name": "b",
        "def": {
          "type": "binary",
          "operator": "*",
          "left": { "type": "var", "value": "a" },
          "right": { "type": "num", "value": 10 }
        }
      }
    ],
    "body": {
      "type": "binary",
      "operator": "+",
      "left": { "type": "var", "value": "a" },
      "right": { "type": "var", "value": "b" }
    }
  }];

fdescribe("test suite", function() {

  var parserAst;
  var correctAst;

  for (var i = 0; i < codeUnits.length; i++) {

    parserAst = main(codeUnits[i]);
    correctAst = astUnits[i];

    console.log(parserAst); //test
    console.log(correctAst);

    it("tests" + " " + codeUnits[i], function() {
      expect(parserAst).toEqual(correctAst);
    });
  }
});

xdescribe("single test", function() {
  it("123.5 num test", function() {
    expect(main(codeUnits[0])).toBe(astUnits[0]);
  });
});

xdescribe("testing tests", function(){
  xit("for true equals true", function() {
    expect(true).toBe(true);
  });
  xit("for false equals true", function() {
    expect(false).toBe(true);
  });
});