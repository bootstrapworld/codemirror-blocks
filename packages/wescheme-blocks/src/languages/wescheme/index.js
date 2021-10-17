import WeschemeParser from "./WeschemeParser";
import { CodeMirrorBlocks, Languages } from "codemirror-blocks";
require("./style.less");

let parser = new WeschemeParser();

export const WeScheme = Languages.addLanguage({
  id: "wescheme",
  name: "WeScheme",
  description: "The WeScheme language",
  parse: parser.parse,
  getExceptionMessage: parser.getExceptionMessage,
  getASTNodeForPrimitive: parser.getASTNodeForPrimitive,
  getLiteralNodeForPrimitive: parser.getLiteralNodeForPrimitive,
  primitives: [],
  primitivesFn() {
    let x = parser.primitivesFn();
    this.primitives = x;
    return x;
  },
  getRenderOptions() {
    return {
      // TODO: perhaps also ['functionDefinition', 'variableDefinition', 'structDefinition']?
      lockNodesOfType: ["comment"],
    };
  },
});

const constructor = (container, options) =>
  new CodeMirrorBlocks(container, options, WeScheme);
export default constructor;
