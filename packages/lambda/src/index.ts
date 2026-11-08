import parseString from "./convert";
import { LAMBDA_BLOCK_COMMENT } from "./ast";
import { Languages } from "@bootstrapworld/codemirror-blocks";

const { addLanguage } = Languages;

export { LambdaAST } from "./ast";
export default addLanguage({
  id: "lambda",
  name: "Lambda",
  description: "A simple language taken from lisperator.net",
  exampleCode: `# Some functions
double = lambda (x) x * 2;
area = lambda (w, h) w * h;

# a conditional, and a call
answer = if double(21) > 40 then area(6, 7) else 0;
let loop (i = 0) if i < 3 then loop(i + 1) else i
`,
  blockComment: LAMBDA_BLOCK_COMMENT,
  parse: parseString,
});
