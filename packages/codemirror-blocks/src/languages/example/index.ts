import ExampleParser, { EXAMPLE_BLOCK_COMMENT } from "./ExampleParser";
import { addLanguage } from "../../languages/";

const parser = new ExampleParser();

export default addLanguage({
  id: "example",
  name: "Example",
  description:
    "An example language that illustrates how to add support for new languages",
  blockComment: EXAMPLE_BLOCK_COMMENT,
  // (call them through the parser: they use `this`)
  parse: (code: string) => parser.parse(code),
  getExceptionMessage: (e: unknown) => parser.getExceptionMessage(e),
});
