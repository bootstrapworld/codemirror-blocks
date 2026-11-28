/** @jest-environment jsdom */
/* A destroyed editor leaves nothing behind: its document and window listeners are taken off, `destroy` can be called twice, and (when gc
   can be reached) the editor and its view are collected. scripts/leak-check.ts measures the heap over many cycles. */
import * as v8 from "node:v8";
import * as vm from "node:vm";
import { createLezerBlockEditor } from "../src/lezer-view";
import { OPTS, TEXT } from "./helpers";

const LANGS = ["scheme", "javascript", "python"];
const proto = EventTarget.prototype;

describe("destroy", () => {
  test.each(LANGS)(
    "%s: listeners are balanced and destroy is idempotent",
    (l) => {
      // the live registrations on the document and the window: (target, type, listener, capture), as the DOM dedupes them
      const live = new Set<string>();
      const ids = new WeakMap<object, number>();
      let nextId = 0;
      const key = (t: EventTarget, a: unknown[]): string | null => {
        const who = t === document ? "doc" : t === window ? "win" : null;
        const fn = a[1] as object | null;
        if (!who || !fn) return null;
        if (!ids.has(fn)) ids.set(fn, nextId++);
        const o = a[2];
        const cap =
          typeof o === "boolean"
            ? o
            : !!(o as { capture?: boolean } | undefined)?.capture;
        return `${who}:${String(a[0])}:${ids.get(fn)}:${cap}`;
      };
      document.querySelector("body"); // (jsdom adds its own selector listeners on first use)
      const realAdd = proto.addEventListener;
      const realRemove = proto.removeEventListener;
      const parent = document.body.appendChild(document.createElement("div"));
      try {
        proto.addEventListener = function (
          this: EventTarget,
          ...a: Parameters<typeof realAdd>
        ) {
          const k = key(this, a);
          if (k) live.add(k);
          return realAdd.apply(this, a);
        };
        proto.removeEventListener = function (
          this: EventTarget,
          ...a: Parameters<typeof realRemove>
        ) {
          const k = key(this, a);
          if (k) live.delete(k);
          return realRemove.apply(this, a);
        };
        const ed = createLezerBlockEditor(parent, TEXT[l], OPTS[l]);
        ed.destroy();
        ed.destroy();
      } finally {
        proto.addEventListener = realAdd;
        proto.removeEventListener = realRemove;
      }
      parent.remove();
      // only the document and the window outlive the editor: nothing it added may be left on them
      const left = [...live];
      expect(left).toEqual([]);
    }
  );

  const gcFn = (): (() => void) | null => {
    try {
      v8.setFlagsFromString("--expose-gc");
      return vm.runInNewContext("gc") as () => void;
    } catch (_) {
      return null;
    }
  };
  const gc = gcFn();
  (gc ? test : test.skip)(
    "a destroyed editor and its view are collected",
    async () => {
      const canaries: WeakRef<object>[] = [];
      const cycle = (l: string): void => {
        // (a document of its own: jsdom's selector engine caches the last element it was asked about, on its document)
        const doc = document.implementation.createHTMLDocument("");
        const parent = doc.body.appendChild(doc.createElement("div"));
        const ed = createLezerBlockEditor(parent, TEXT[l], OPTS[l]);
        ed.roots();
        canaries.push(new WeakRef(ed), new WeakRef(ed.view));
        ed.destroy();
      };
      for (const l of LANGS) cycle(l);
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 10));
        gc!();
      }
      expect(
        canaries.map((w, i) => (w.deref() ? i : -1)).filter((i) => i >= 0)
      ).toEqual([]);
    }
  );
});
