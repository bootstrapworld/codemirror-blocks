// The sheets: the generated modules agree with the .css sources; the editor puts the core sheet and the table's own in its root, once.
import * as fs from "fs";
import * as path from "path";
import { make } from "./helpers";

const dir = path.join(__dirname, "..", "src", "css");
test.each(fs.readdirSync(dir).filter((f) => f.endsWith(".css")))(
  "%s is what its module exports (run `npm run build:css`)",
  (f) => {
    const mod = require(path.join(dir, f.replace(/\.css$/, "-css"))).default;
    expect(mod).toBe(fs.readFileSync(path.join(dir, f), "utf8"));
  }
);
const sheets = () =>
  Array.from(document.querySelectorAll("style[data-cm6-blocks]")).map((s) =>
    s.getAttribute("data-cm6-blocks")
  );
test("core once, and one sheet per language used; a repeat adds nothing", () => {
  document.head
    .querySelectorAll("style[data-cm6-blocks]")
    .forEach((s) => s.remove());
  make("scheme");
  make("scheme");
  expect(sheets().sort()).toEqual(["core", "scheme"]);
  make("python");
  expect(sheets().sort()).toEqual(["core", "python", "scheme"]);
});
