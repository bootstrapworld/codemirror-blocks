import {Primitive, PrimitiveGroup} from 'codemirror-blocks/parsers/primitives';

describe("The Primitive Class's", function() {
  describe("constructor,", function() {
    beforeEach(function() {
      this.parser = {};
    });

    it("should take a parser instance and a name", function() {
      let primitive = new Primitive(this.parser, 'add');
      expect(primitive.parser).toBe(this.parser);
      expect(primitive.name).toBe('add');

      expect(primitive.argumentTypes).toEqual([]);
      expect(primitive.returnType).toBeUndefined();
    });

    it("should optionally take a config object with argumentTypes and returnType", function() {
      let primitive = new Primitive(
        this.parser,
        'add',
        {
          argumentTypes:['int','int'],
          returnType:'int',
        }
      );
      expect(primitive.argumentTypes).toEqual(['int','int']);
      expect(primitive.returnType).toEqual('int');
    });

    it("should also have a fromConfig static method for construction", function() {
      let primitive = Primitive.fromConfig(
        this.parser,
        {
          name: 'add',
          argumentTypes:['int','int'],
          returnType:'int',
        }
      );
      expect(primitive.parser).toBe(this.parser);
      expect(primitive.name).toBe('add');
      expect(primitive.argumentTypes).toEqual(['int','int']);
      expect(primitive.returnType).toEqual('int');
    });

  });

  describe("getASTNode and getLiteralNode method", function() {
    beforeEach(function() {
      this.parser = {};
      this.primitive = new Primitive(this.parser, 'add');
    });

    it("should delegate to the parsers getASTNodeForPrimitive method if available", function() {
      expect(this.primitive.getASTNode()).toBeUndefined();
      this.parser.getASTNodeForPrimitive = () => 'foo';
      expect(this.primitive.getASTNode()).toBe('foo');
    });

    it("should delegate to the parsers getLiteralNodeForPrimitive method if available", function() {
      expect(this.primitive.getLiteralNode()).toBeUndefined();
      this.parser.getLiteralNodeForPrimitive = () => 'foo';
      expect(this.primitive.getLiteralNode()).toBe('foo');
    });
  });

});


describe("The PrimitiveGroup Class's", function() {
  beforeEach(function() {
    this.parser = {};
    this.group = PrimitiveGroup.fromConfig(
      this.parser,
      {
        name: 'root',
        primitives: [
          'add',
          'subtract',
          'multiply',
          'divide',
          {
            name: 'sqrt',
            argumentTypes: ['float'],
            returnType: 'float'
          },
          {
            name: 'String Manipulation',
            primitives: [
              'concat',
              'join'
            ]
          }
        ]
      }
    );
  });

  describe("fromConfig static method", function() {
    it("should take a parser and a group config object", function() {
      expect(this.group.name).toBe('root');
      expect(this.group.parser).toBe(this.parser);
      expect(this.group.primitives.length).toBe(6);
      expect(this.group.primitives[0]).toEqual(jasmine.any(Primitive));
      expect(this.group.primitives[5]).toEqual(jasmine.any(PrimitiveGroup));
      expect(this.group.primitives[0].name).toBe('add');
      expect(this.group.primitives[5].name).toBe('String Manipulation');
      expect(this.group.primitives[5].primitives.length).toBe(2);
    });

    it("should throw an error if a name isn't provided", function() {
      expect(() => PrimitiveGroup.fromConfig({}, {})).toThrow();
    });

    it("should still work if no primitives are given", function() {
      expect(() => PrimitiveGroup.fromConfig({}, {name:'foo'})).not.toThrow();
    });

    it("should throw an error if a config isn't understood", function() {
      expect(() => PrimitiveGroup.fromConfig({}, {name:'foo', primitives:[1]})).toThrow();
    });

  });

  describe("filter method", function() {
    it("should filter out the primitives that do not match the search string", function() {
      let filteredGroup = this.group.filter('add');
      expect(filteredGroup.parser).toEqual(this.group.parser);
      expect(filteredGroup.name).toEqual(this.group.name);
      expect(filteredGroup.primitives.length).toEqual(1);
      expect(filteredGroup.primitives[0].name).toBe('add');
    });

    it("should include groups whose primitives matches the search string", function() {
      let filteredGroup = this.group.filter('con');
      expect(filteredGroup.primitives.length).toEqual(1);
      expect(filteredGroup.primitives[0].name).toBe('String Manipulation');
      expect(filteredGroup.primitives[0].primitives.length).toBe(1);
      expect(filteredGroup.primitives[0].primitives[0].name).toBe('concat');
    });

    it("should include groups whose name matches the search string", function() {
      let filteredGroup = this.group.filter('str');
      expect(filteredGroup.primitives.length).toEqual(1);
      expect(filteredGroup.primitives[0].name).toBe('String Manipulation');
      expect(filteredGroup.primitives[0].primitives.length).toBe(2);
    });

    it("should return itself when given an empty search string", function() {
      expect(this.group.filter('')).toBe(this.group);
    });
  });

});
