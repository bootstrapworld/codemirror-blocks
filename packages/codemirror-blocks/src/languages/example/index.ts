import ExampleParser from "./ExampleParser";
import { addLanguage } from "../../languages/";

const parser = new ExampleParser();

require("./style.less");
export default addLanguage({
  id: "example",
  name: "Example",
  description:
    "An example language that illustrates how to add support for new languages",
  // (call them through the parser: they use `this`)
  parse: (code: string) => parser.parse(code),
  getExceptionMessage: (e: unknown) => parser.getExceptionMessage(e),
});
