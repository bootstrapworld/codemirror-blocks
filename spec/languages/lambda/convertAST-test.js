import convertAST from 'codemirror-blocks/languages/lambda/convertAST';

fdescribe('the convertAST function for lambda to codemirror-blocks', function() {

  it("should convert number to literal", function(){
    this.AST = { type: "num", value: 123.5 };
    this.cAST = convertAST(this.AST);
    expect(this.cAST.rootNodes[0].dataType).toBe("number");
    expect(this.cAST.rootNodes[0].value).toBe(123.5);    
  });

  it("should convert string to literal", function(){
    this.AST = { type: "str", value: "Hello World!" };
    this.cAST = convertAST(this.AST);
    expect(this.cAST.rootNodes[0].dataType).toBe("string");
    expect(this.cAST.rootNodes[0].value).toBe("Hello World!");
  });

  it("should convert bool to literal", function(){
    this.AST = { type: "bool", value: true };
    this.cAST = convertAST(this.AST);
    expect(this.cAST.rootNodes[0].dataType).toBe("bool");
  });


  it("should convert identifiers to symbol", function() {
    this.AST = { type: "var", value: "foo" };
    this.cAST = convertAST(this.AST);
    expect(this.cAST.rootNodes[0].dataType).toBe('symbol');
    expect(this.cAST.rootNodes[0].value).toBe('foo');
  });

  describe("when parsing function definitions,", function() {

    it("should convert lambda to function definitions", function() {
      this.AST = { type: "lambda", vars: [ "x" ], body: { type: "num", value: 1 } };
      this.cAST = convertAST(this.AST);
      expect(this.cAST.rootNodes[0].type).toBe('functionDef');
      expect(this.cAST.rootNodes[0].name.value).toBe('add2');
      expect(this.cAST.rootNodes[0].args.length).toBe(1);
      expect(this.cAST.rootNodes[0].args[0].value).toBe('x');
      expect(this.cAST.rootNodes[0].body.type).toBe('expression');
    });
  });
});
