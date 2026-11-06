import { addLanguage } from "../../languages/";
import { ROUTINE_BLOCK_COMMENT } from "./ast";
import { parse } from "./parser";

require("./style.less");
export default addLanguage({
  id: "routine",
  name: "Routine",
  description:
    "A small language for plans: lets, shows, repeats and choices. It exists to try the editor's API (state-aware blocks, drop targets anywhere, labels)",
  blockComment: ROUTINE_BLOCK_COMMENT,
  parse,
  getExceptionMessage: (e: unknown) =>
    e instanceof Error ? e.message : String(e),
});
