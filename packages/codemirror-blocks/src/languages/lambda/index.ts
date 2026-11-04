import { addLanguage } from "../../languages/";
import parseString from "./convert";
import { LAMBDA_BLOCK_COMMENT } from "./ast";

require("./style.less");
export default addLanguage({
  id: "lambda",
  name: "Lambda",
  description: "A simple language taken from lisperator.net",
  blockComment: LAMBDA_BLOCK_COMMENT,
  parse: parseString,
});
