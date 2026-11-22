// The sheets: the editor puts the core sheet and the table's own in its root, once.
import { make } from "./helpers";

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
