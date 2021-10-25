import { addLanguage, removeLanguage } from "../../src/languages";

describe("addLanguage function,", () => {
  beforeEach(() => {
    removeLanguage("foo");
    addLanguage({
      id: "foo",
      name: "foo",
      parse(_code: string) {
        return [];
      },
    });
  });
  afterEach(() => {
    removeLanguage("foo");
    removeLanguage("bar");
  });
  it("should throw an error if the language has already been defined", () => {
    expect(() => addLanguage({ id: "foo" } as any)).toThrowError(
      "language foo has already been added."
    );
  });
  it("should throw an error if the language is missing a name", () => {
    expect(() => addLanguage({ id: "bar" } as any)).toThrowError(
      "language definition for bar is missing a 'name' attribute."
    );
  });
  it("should throw an error if the language is missing a parse function", () => {
    expect(() =>
      addLanguage({ id: "bar", name: "Bar Language" } as any)
    ).toThrowError(
      "language definition for bar is missing a 'parse' function."
    );
  });
  it("not an error if no getExceptionMessage function provided", () => {
    expect(() =>
      addLanguage({ id: "bar", name: "Bar Language", parse() {} } as any)
    ).not.toThrow();
  });
});
