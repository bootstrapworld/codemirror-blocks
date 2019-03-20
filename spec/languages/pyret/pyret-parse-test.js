import pyret from 'codemirror-blocks/languages/pyret';

describe('Pyret parser', function() {
  beforeEach(function() {
    this.parser = pyret.getParser();
    this.parse = this.parser.parse;
  });
  
  it('should exist', function() {
    expect(pyret).not.toBe(undefined);
    expect(pyret).not.toBe(null);
    expect(this.parser).not.toBe(undefined);
    expect(this.parser).not.toBe(null);
    expect(this.parse).not.toBe(undefined);
    expect(this.parse).not.toBe(null);
  });

  it('should parse a number', function() {
    expect(this.parse("1")).not.toBe(null);
    expect(this.parse("1 + 2")).not.toBe(null);
  });
});
