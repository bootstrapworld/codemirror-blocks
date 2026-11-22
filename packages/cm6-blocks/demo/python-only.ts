// EXPERIMENT: an entry with only the Python table.
import { createLezerBlockEditor } from "../src/lezer-view";
import { pythonParser, pythonTable } from "../src/lang-python";

createLezerBlockEditor(document.body, "def f(x):\n    return x * x\nf(3)\n", {
  parser: pythonParser as never,
  table: pythonTable,
});
