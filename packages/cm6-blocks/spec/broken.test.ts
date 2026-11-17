/** @jest-environment jsdom */
// Step 5d: what Lezer's tree gives for an unbalanced bracket in the middle of a program.
import { schemeParser, schemeTable } from "../src/lang-scheme";
import { javascriptParser, javascriptTable } from "../src/lang-javascript";
import { pythonParser, pythonTable } from "../src/lang-python";
import { lezerLanguage } from "../src/lezer";
import { hasError } from "../src/lezer";

const cases: [string, any, any, string, string][] = [
  [
    "scheme",
    schemeParser,
    schemeTable,
    "(a 1)\n(b 2)\n(c 3)\n(d 4)\n(e 5)",
    "(a 1)\n(b 2\n(c 3)\n(d 4)\n(e 5)",
  ],
  [
    "javascript",
    javascriptParser,
    javascriptTable,
    "a(1);\nb(2);\nc(3);\nd(4);\ne(5);",
    "a(1);\nb(2;\nc(3);\nd(4);\ne(5);",
  ],
  [
    "python",
    pythonParser,
    pythonTable,
    "a(1)\nb(2)\nc(3)\nd(4)\ne(5)",
    "a(1)\nb(2\nc(3)\nd(4)\ne(5)",
  ],
];
test.each(cases)("%s", (name, parser, table, good, bad) => {
  const L = lezerLanguage(parser, table);
  const g = L.parse(good);
  const b = L.parse(bad);
  const kinds = b.map((r) =>
    r.kind === "error" ? "ERR" : hasError(r) ? r.kind + "(has error)" : r.kind
  );
  const after = b
    .filter(
      (r) => r.from >= bad.indexOf("c(3)") || r.from >= bad.indexOf("(c 3)")
    )
    .filter((r) => !hasError(r) && r.kind !== "error").length;
  // eslint-disable-next-line no-console
  console.log(
    `${name}: good ${g.length} roots; broken ${b.length} roots: ${kinds.join(", ")}; clean roots after the break: ${after}`
  );
});
