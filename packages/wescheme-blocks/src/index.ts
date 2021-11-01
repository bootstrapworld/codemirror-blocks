import * as parser from "./WeschemeParser";
import { Languages, Nodes, PrimitiveGroup } from "codemirror-blocks";
import PRIMITIVES_CONFIG from "./primitives-config";
import type { Primitive } from "codemirror-blocks/lib/parsers/primitives";
import { symbolAria } from "./parseNode";
import "./style.less";

const dummyLoc = { line: -1, ch: 0 };

function getASTNodeForPrimitive(primitive: Primitive) {
  return Nodes.FunctionApp(
    dummyLoc,
    dummyLoc,
    Nodes.Literal(dummyLoc, dummyLoc, primitive.name, "symbol"),
    primitive.argumentTypes.map(() => Nodes.Blank(dummyLoc, dummyLoc, "")),
    { ariaLabel: primitive.name + " expression" }
  );
}

function getLiteralNodeForPrimitive(primitive) {
  return Nodes.Literal(dummyLoc, dummyLoc, primitive.name, "symbol", {
    ariaLabel: primitive.name,
  });
}

function getExceptionMessage(e) {
  // TODO: Using JSON.parse is not safe. Sometimes it could result in a parsing error.
  console.error(e);
  const msg = JSON.parse(e)["dom-message"][2].slice(2);
  const txt = msg.every((element) => typeof element === "string")
    ? msg
    : msg[0] instanceof Array
    ? msg[0][2].substring(msg[0][2].indexOf("read: ") + 6)
    : "Check your quotation marks, or any other symbols you've used";
  return symbolAria(txt);
}

export const WeScheme = Languages.addLanguage({
  id: "wescheme",
  name: "WeScheme",
  description: "The WeScheme language",
  parse: parser.parse,
  getExceptionMessage: getExceptionMessage,
  getASTNodeForPrimitive,
  getLiteralNodeForPrimitive,
  primitivesFn: () => PrimitiveGroup.fromConfig("wescheme", PRIMITIVES_CONFIG),
});
