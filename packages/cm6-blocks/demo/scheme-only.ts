// EXPERIMENT: an entry with only the Scheme table, to measure what a Scheme-only build weighs (the editor injects the core sheet and the table's own).
import { createLezerBlockEditor } from "../src/lezer-view";
import { schemeParser, schemeTable } from "../src/lang-scheme";

createLezerBlockEditor(document.body, "(define (f x) (* x x))\n(f 3)\n", {
  parser: schemeParser as never,
  table: schemeTable,
});
