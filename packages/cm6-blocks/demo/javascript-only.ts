// EXPERIMENT: an entry with only the JavaScript table.
import { createLezerBlockEditor } from "../src/lezer-view";
import { javascriptParser, javascriptTable } from "../src/lang-javascript";

createLezerBlockEditor(
  document.body,
  "function f(x) {\n  return x * x;\n}\nf(3);\n",
  {
    parser: javascriptParser as never,
    table: javascriptTable,
  }
);
