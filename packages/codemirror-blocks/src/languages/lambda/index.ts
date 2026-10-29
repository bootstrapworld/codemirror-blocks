import { addLanguage } from "../../languages/";
import parseString from "./convert";

require("./style.less");
export default addLanguage({
  id: "lambda",
  name: "Lambda",
  description: "A simple language taken from lisperator.net",
  parse: parseString,
});
