import ExampleParser, { EXAMPLE_BLOCK_COMMENT } from "./ExampleParser";
import { Languages } from "@bootstrapworld/codemirror-blocks";

const { addLanguage } = Languages;

const parser = new ExampleParser();

export default addLanguage({
  id: "example",
  name: "Example",
  description:
    "An example language that illustrates how to add support for new languages",
  exampleCode: `; numbers and calls
(+ 1 2)
(* (+ 3 4) (- 10 5))
`,
  blockComment: EXAMPLE_BLOCK_COMMENT,
  // (call them through the parser: they use `this`)
  parse: (code: string) => parser.parse(code),
  getExceptionMessage: (e: unknown) => parser.getExceptionMessage(e),
});
