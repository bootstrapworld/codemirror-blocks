import { addLanguage } from "../../languages/";
import * as Nodes from "../../nodes";
import { BlockError } from "../../utils";
import { PrimitiveGroup } from "../../parsers/primitives";
import type { Primitive } from "../../parsers/primitives";
import PRIMITIVES_CONFIG from "./primitives-config";
import { symbolAria } from "./parseNode";
import { parse } from "./sexpParser";
require("./style.less");

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

function getLiteralNodeForPrimitive(primitive: Primitive) {
  return Nodes.Literal(dummyLoc, dummyLoc, primitive.name, "symbol", {
    ariaLabel: primitive.name,
  });
}

function getExceptionMessage(e: unknown) {
  // try to extract the actual error text from the parse error
  try {
    const msg = JSON.parse(e as string)["dom-message"][2].slice(2);
    const txt = msg.every((element: unknown) => typeof element === "string")
      ? msg
      : msg[0] instanceof Array
        ? msg[0][2].substring(msg[0][2].indexOf("read: ") + 6)
        : "Check your quotation marks, or any other symbols you've used";
    return new BlockError("Your program could not be parsed", symbolAria(txt));
  } catch (clearlyNotAWeSchemeError) {
    return new BlockError("Parser Failure", "Failure", e); // return the original error
  }
}

export default addLanguage({
  id: "wescheme",
  name: "WeScheme",
  description: "The WeScheme language",
  parse,
  getExceptionMessage,
  getASTNodeForPrimitive,
  getLiteralNodeForPrimitive,
  primitivesFn: () => PrimitiveGroup.fromConfig("wescheme", PRIMITIVES_CONFIG),
});
