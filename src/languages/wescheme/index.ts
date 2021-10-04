import WeschemeParser from "./WeschemeParser";
import { addLanguage } from "../../languages/";
require("./style.less");

let parser = new WeschemeParser();

export default addLanguage({
  id: "wescheme",
  name: "WeScheme",
  description: "The WeScheme language",
  parse: parser.parse,
  getExceptionMessage: parser.getExceptionMessage,
  getASTNodeForPrimitive: parser.getASTNodeForPrimitive,
  getLiteralNodeForPrimitive: parser.getLiteralNodeForPrimitive,
  primitivesFn() {
    let x = parser.primitivesFn();
    return x;
  },
});