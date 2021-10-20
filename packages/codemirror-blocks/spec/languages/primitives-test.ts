import { addLanguage, removeLanguage } from "../../src/languages";
import { Primitive, PrimitiveGroup } from "../../src/parsers/primitives";

describe("The primitives module", () => {
  const parse = (_code: string) => [];
  beforeEach(() => {
    addLanguage({
      id: "my-lang",
      name: "My Lang",
      parse,
    });
  });
  afterEach(() => {
    removeLanguage("my-lang");
  });

  describe("The Primitive Class's", () => {
    describe("constructor,", () => {
      it("should take a language id and a name", () => {
        const primitive = new Primitive("my-lang", "add");
        expect(primitive.languageId).toBe("my-lang");
        expect(primitive.name).toBe("add");

        expect(primitive.argumentTypes).toEqual([]);
        expect(primitive.returnType).toBeUndefined();
      });

      it("should optionally take a config object with argumentTypes and returnType", () => {
        const primitive = new Primitive("my-lang", "add", {
          argumentTypes: ["int", "int"],
          returnType: "int",
        });
        expect(primitive.argumentTypes).toEqual(["int", "int"]);
        expect(primitive.returnType).toEqual("int");
      });

      it("should also have a fromConfig static method for construction", () => {
        const primitive = Primitive.fromConfig("my-lang", {
          name: "add",
          argumentTypes: ["int", "int"],
          returnType: "int",
        });
        expect(primitive.languageId).toBe("my-lang");
        expect(primitive.name).toBe("add");
        expect(primitive.argumentTypes).toEqual(["int", "int"]);
        expect(primitive.returnType).toEqual("int");
      });
    });

    describe("getASTNode and getLiteralNode method", () => {
      let primitive!: Primitive;
      beforeEach(() => {
        primitive = new Primitive("my-lang", "add");
      });

      it("should delegate to the parsers getASTNodeForPrimitive", () => {
        expect(() => primitive.getASTNode()).toThrowError(
          "getASTNodeForPrimitive() must be implemented if primitives are used."
        );
      });

      it("should delegate to the parsers getLiteralNodeForPrimitive", () => {
        expect(() => primitive.getLiteralNode()).toThrowError(
          "getLiteralNodeForPrimitive() must be implemented if primitives are used."
        );
      });
    });
  });

  describe("The PrimitiveGroup Class's", () => {
    let group!: PrimitiveGroup;
    beforeEach(() => {
      group = PrimitiveGroup.fromConfig("my-lang", {
        name: "root",
        primitives: [
          "add",
          "subtract",
          "multiply",
          "divide",
          {
            name: "sqrt",
            argumentTypes: ["float"],
            returnType: "float",
          },
          {
            name: "String Manipulation",
            primitives: ["concat", "join"],
          },
        ],
      });
    });

    describe("fromConfig static method", () => {
      it("should take a parser and a group config object", () => {
        expect(group.name).toBe("root");
        expect(group.languageId).toBe("my-lang");
        expect(group.primitives.length).toBe(6);
        const subGroup = group.primitives[5] as PrimitiveGroup;
        expect(group.primitives[0] instanceof Primitive).toBe(true);
        expect(subGroup instanceof PrimitiveGroup).toBe(true);
        expect(group.primitives[0].name).toBe("add");
        expect(subGroup.name).toBe("String Manipulation");
        expect(subGroup.primitives.length).toBe(2);
      });

      it("should throw an error if a name isn't provided", () => {
        expect(() => PrimitiveGroup.fromConfig("lang", {} as any)).toThrow();
      });

      it("should still work if no primitives are given", () => {
        expect(() =>
          PrimitiveGroup.fromConfig("lang", { name: "foo" } as any)
        ).not.toThrow();
      });

      it("should throw an error if a config isn't understood", () => {
        expect(() =>
          PrimitiveGroup.fromConfig("lang", {
            name: "foo",
            primitives: [1],
          } as any)
        ).toThrow();
      });
    });

    describe("filter method", () => {
      it("should filter out the primitives that do not match the search string", () => {
        const filteredGroup = group.filter("add");
        expect(filteredGroup.name).toEqual(group.name);
        expect(filteredGroup.primitives.length).toEqual(1);
        expect(filteredGroup.primitives[0].name).toBe("add");
      });

      it("should include groups whose primitives matches the search string", () => {
        const filteredGroup = group.filter("con");
        expect(filteredGroup.primitives.length).toEqual(1);
        const subGroup = filteredGroup.primitives[0] as PrimitiveGroup;
        expect(subGroup.name).toBe("String Manipulation");
        expect(subGroup.primitives.length).toBe(1);
        expect(subGroup.primitives[0].name).toBe("concat");
      });

      it("should include groups whose name matches the search string", () => {
        const filteredGroup = group.filter("str");
        expect(filteredGroup.primitives.length).toEqual(1);
        const subGroup = filteredGroup.primitives[0] as PrimitiveGroup;
        expect(subGroup.name).toBe("String Manipulation");
        expect(subGroup.primitives.length).toBe(2);
      });

      it("should return itself when given an empty search string", () => {
        expect(group.filter("")).toBe(group);
      });
    });

    describe("flatPrimitivesIter", () => {
      it("should return a left recursive iterator over the Primitive instances in the group", () => {
        const onlyPrimitives = [...group.flatPrimitivesIter()];
        expect(onlyPrimitives.map((p) => p.name)).toEqual([
          "add",
          "subtract",
          "multiply",
          "divide",
          "sqrt",
          "concat",
          "join",
        ]);
      });
    });
  });
});
