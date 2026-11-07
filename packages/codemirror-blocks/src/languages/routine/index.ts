import { addLanguage } from "../../languages/";
import { ROUTINE_BLOCK_COMMENT } from "./ast";
import { parse } from "./parser";

export default addLanguage({
  id: "routine",
  name: "Routine",
  description:
    "A small language for plans: lets, shows, repeats and choices. It exists to try the editor's API (state-aware blocks, drop targets anywhere, labels)",
  exampleCode: `; Start the day
(let minutes 10)
(let spare)
(show "Good morning")

#| steps that repeat |#
(repeat 3
  ; the longer the later
  (show (+ minutes 1))
  (let minutes (+ minutes 5))
  (if (> minutes 20)
    (show "late")))

(if (< minutes 30)
  (show "on time")
  (show "late"))
`,
  blockComment: ROUTINE_BLOCK_COMMENT,
  parse,
  getExceptionMessage: (e: unknown) =>
    e instanceof Error ? e.message : String(e),
});
