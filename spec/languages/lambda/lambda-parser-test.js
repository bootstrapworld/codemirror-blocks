//test suite for the lambda parser

import parseString from 'codemirror-blocks/languages/lambda/parser.js';

var testData = [
  {
    input: '123.5',
    'output': { type: "num", 'value': 123.5 }
  },
  {
    'input': `"Hello World!"`,
    output: { type: "str", value: "Hello World!" }
  },
  {
    'input': 'true',
    output: { type: "bool", value: true }
  },
  {
    'input': 'false',
    output: { type: "bool", value: false }
  },
  {
    'input': 'foo',
    output: { type: "var", value: "foo" }
  },
  {
    'input': 'lambda (x) 10',
    output: { 
      type: "lambda",
      name: null,
      vars: [ "x" ],
      body: { type: "num", value: 10 }
    }
  },
  {
    'input': 'foo(a, 1)',
    output: {
      "type": "call",
      "func": { "type": "var", "value": "foo" },
      "args": [{ "type": "var", "value": "a" }, { "type": "num", "value": 1 }]
    }
  },
  {
    'input': 'if foo then bar else baz',
    output: {
      "type": "if",
      "cond": { "type": "var", "value": "foo" },
      "then": { "type": "var", "value": "bar" },
      "else": { "type": "var", "value": "baz" }
    }
  },
  {
    'input': 'if foo then bar',
    output: {
      "type": "if",
      "cond": { "type": "var", "value": "foo" },
      "then": { "type": "var", "value": "bar" }
    }
  },
  {
    'input': 'a = 10',
    output: {
      "type": "assign",
      "operator": "=",
      "left": { "type": "var", "value": "a" },
      "right": { "type": "num", "value": 10 }
    }
  },
  {
    'input': 'x + y * z',
    output: {
      "type": "binary",
      "operator": "+",
      "left": { "type": "var", "value": "x" },
      "right": {
        "type": "binary",
        "operator": "*",
        "left": { "type": "var", "value": "y" },
        "right": { "type": "var", "value": "z" }
      }
    }
  },
  {
    'input': `a = 5;
            b = a * 2;
            a + b;`,
    output: {
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
    }
  },
  {
    'input': `let (a = 10, b = a * 10) {a + b;}`,
    output: {
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
    }
  }
];

fdescribe("lambda parser test suite", function() {
    
  testData.forEach(function(data) {
    it("testing" + " " + data.input, function() {
      expect(parseString(data.input)).toEqual(data.output);
    });
  });
});