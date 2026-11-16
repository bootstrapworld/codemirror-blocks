// EXPERIMENT: an entry with only the Scheme table, to measure what a Scheme-only build weighs.
import css from "../src/style.css";
import { createLezerBlockEditor } from "../src/lezer-view";
import { schemeParser, schemeTable } from "../src/lang-scheme";

const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);
createLezerBlockEditor(document.body, "(define (f x) (* x x))\n(f 3)\n", { parser: schemeParser as never, table: schemeTable });
