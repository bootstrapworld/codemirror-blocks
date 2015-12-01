/* globals describe it expect beforeEach jasmine */

import Parser from '../../src/parsers/wescheme';
import {Expression} from '../../src/ast';

describe("The WeScheme Parser", function() {
  beforeEach(function() {
    this.parser = new Parser();
  });

  it("should set the appropriate data type for literals", function() {
    expect(this.parser.parse('#t').rootNodes[0].dataType).toBe('boolean');
    expect(this.parser.parse('1').rootNodes[0].dataType).toBe('number');
    expect(this.parser.parse('"hello"').rootNodes[0].dataType).toBe('string');
    expect(this.parser.parse('#\\m').rootNodes[0].dataType).toBe('char');
    expect(this.parser.parse('foo').rootNodes[0].dataType).toBe('symbol');
  });

  it("should treat booleans expression like regular expressions", function() {
    let ast = this.parser.parse('(or #t #f)');
    expect(ast.rootNodes[0].type).toBe('expression');
    ast = this.parser.parse('(and #t #f)');
    expect(ast.rootNodes[0].type).toBe('expression');
  });

  it("should convert callExpresssions to expressions", function() {
    let ast = this.parser.parse('(sum 1 2 3)');
    expect(ast.rootNodes[0].type).toBe('expression');
  });
});
