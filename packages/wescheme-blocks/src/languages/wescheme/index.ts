import * as parser from "./WeschemeParser";
import { Languages } from "codemirror-blocks";
require("./style.less");

export const WeScheme = Languages.addLanguage({
  id: "wescheme",
  name: "WeScheme",
  description: "The WeScheme language",
  parse: parser.parse,
  getExceptionMessage: parser.getExceptionMessage,
  getASTNodeForPrimitive: parser.getASTNodeForPrimitive,
  getLiteralNodeForPrimitive: parser.getLiteralNodeForPrimitive,
  primitivesFn: parser.primitivesFn,
});
