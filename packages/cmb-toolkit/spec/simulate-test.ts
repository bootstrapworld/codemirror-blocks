import {
  blur,
  click,
  cut,
  doubleClick,
  dragend,
  dragenter,
  dragenterSeq,
  dragleave,
  dragover,
  dragstart,
  drop,
  insertText,
  keyDown,
  keyPress,
  mouseDown,
  mouseenter,
  mouseleave,
  mouseover,
  paste,
} from "../src/simulate";

/** Record the types of the events that reach `el` */
const record = (el: Element, types: string[]) => {
  const seen: Event[] = [];
  for (const type of types) {
    el.addEventListener(type, (e) => seen.push(e));
  }
  return seen;
};

let el: HTMLElement;
beforeEach(() => {
  el = document.createElement("div");
  el.tabIndex = 0;
  document.body.appendChild(el);
  el.focus();
});
afterEach(() => {
  el.remove();
  jest.restoreAllMocks();
});

describe("which element an event goes to", () => {
  it("accepts an element, a text node, or anything with an .element", () => {
    const seen = record(el, ["click"]);
    click(el);
    click({ element: el });
    expect(seen).toHaveLength(2);

    const text = document.createTextNode("hi");
    el.appendChild(text);
    click(text); // bubbles up to the div
    expect(seen).toHaveLength(3);
  });

  it("refuses anything else, and says so", () => {
    expect(() => click({ element: null })).toThrow(/Cannot convert/);
    expect(() => click({})).toThrow(/Cannot convert/);
    expect(() => click({ element: "nope" } as never)).toThrow(/Cannot convert/);
  });

  it("defaults to the focused element, and complains when there is none", () => {
    const seen = record(el, ["blur", "cut", "dragover"]);
    blur();
    cut();
    dragover();
    expect(seen.map((e) => e.type)).toEqual(["blur", "cut", "dragover"]);

    jest.spyOn(document, "activeElement", "get").mockReturnValue(null);
    expect(() => blur()).toThrow("No element has focus");
    expect(() => cut()).toThrow("No element has focus");
    expect(() => keyDown("Enter")).toThrow("No element has focus");
    expect(() => insertText("x")).toThrow("No element has focus");
  });
});

describe("mouse and clipboard events", () => {
  it("click, mouseDown and doubleClick fire the matching event", () => {
    const seen = record(el, ["click", "mousedown", "dblclick"]);
    click(el);
    mouseDown(el);
    doubleClick(el);
    expect(seen.map((e) => e.type)).toEqual(["click", "mousedown", "dblclick"]);
  });

  it("paste carries the text as text/plain", () => {
    const pasted: (string | undefined)[] = [];
    el.addEventListener("paste", (e) =>
      pasted.push((e as ClipboardEvent).clipboardData?.getData("text/plain"))
    );
    paste("(f x)", el);
    paste("again"); // to the focused element
    expect(pasted).toEqual(["(f x)", "again"]);
  });
});

it("paste still works when a DataTransfer can't be made", () => {
  // (the first one is the helper's own; testing-library makes others)
  const original = window.DataTransfer;
  let calls = 0;
  Object.defineProperty(window, "DataTransfer", {
    configurable: true,
    value: function () {
      if (calls++ === 0) {
        throw new Error("no DataTransfer here");
      }
      return new original();
    },
  });
  try {
    const pasted: string[] = [];
    el.addEventListener("paste", (e) => {
      const data = (e as ClipboardEvent).clipboardData;
      pasted.push(data?.getData("text/plain") ?? "none");
      expect(data?.getData("text/html")).toBe("");
    });
    paste("(f x)", el);
    expect(pasted).toEqual(["(f x)"]);
  } finally {
    Object.defineProperty(window, "DataTransfer", {
      configurable: true,
      value: original,
    });
  }
});

describe("drag events", () => {
  it("the bare creators return bubbling events of the right type", () => {
    const creators = {
      drop,
      dragstart,
      mouseenter,
      dragenter,
      mouseover,
      dragleave,
      mouseleave,
      dragend,
    };
    for (const [type, create] of Object.entries(creators)) {
      const event = create();
      expect(event.type).toBe(type);
      expect(event.bubbles).toBe(true);
    }
  });

  it("dragover is dispatched to the node", () => {
    const seen = record(el, ["dragover"]);
    dragover(el);
    expect(seen).toHaveLength(1);
    expect(seen[0].bubbles).toBe(true);
  });

  it("dragenterSeq sends dragenter and then mouseover", () => {
    const seen = record(el, ["dragenter", "mouseover"]);
    dragenterSeq(el);
    expect(seen.map((e) => e.type)).toEqual(["dragenter", "mouseover"]);
  });
});

describe("keyboard events", () => {
  const keyCodes: [string, number][] = [
    ["Enter", 13],
    ["Tab", 9],
    [" ", 32],
    ["ArrowLeft", 37],
    ["ArrowUp", 38],
    ["ArrowRight", 39],
    ["ArrowDown", 40],
    ["Home", 36],
    ["End", 35],
    ["PageUp", 33],
    ["PageDown", 34],
    ["Backspace", 8],
    ["Delete", 46],
    ["Escape", 27],
    ["F3", 114],
    ["[", 219],
    ["]", 221],
    ["/", 191],
    ["\\", 220],
    ["<", 188],
    // letters and digits are their ascii codes
    ["A", 65],
    ["z", 122],
    ["7", 55],
  ];

  it.each(keyCodes)("%s has key code %i", (key, code) => {
    const seen = record(el, ["keydown"]);
    keyDown(key, {}, el);
    const event = seen[0] as KeyboardEvent;
    expect(event.key).toBe(key);
    expect(event.keyCode).toBe(code);
    expect(event.which).toBe(code);
  });

  it("refuses a key it does not know", () => {
    expect(() => keyDown("F12", {}, el)).toThrow("Unknown key: F12");
    expect(() => keyPress("Shift", {}, el)).toThrow("Unknown key: Shift");
  });

  it("passes extra properties on to the event, which can override", () => {
    const seen = record(el, ["keydown"]);
    keyDown("Z", { ctrlKey: true, key: "z" }, el);
    const event = seen[0] as KeyboardEvent;
    expect(event.ctrlKey).toBe(true);
    expect(event.key).toBe("z");
    expect(event.keyCode).toBe(90);
  });

  it("goes to the focused element by default", () => {
    const seen = record(el, ["keydown", "keypress"]);
    keyDown("Enter");
    keyPress("a");
    expect(seen.map((e) => e.type)).toEqual(["keydown", "keypress"]);
  });

  it("uses a custom event on a textarea, which carries the key code", () => {
    const area = document.createElement("textarea");
    document.body.appendChild(area);
    const seen = record(area, ["keydown"]);
    keyDown("Enter", { ctrlKey: true }, area);
    area.remove();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeInstanceOf(CustomEvent);
    const event = seen[0] as unknown as KeyboardEvent;
    expect(event.keyCode).toBe(13);
    expect(event.which).toBe(13);
    expect(event.ctrlKey).toBe(true);
    expect(seen[0].bubbles).toBe(true);
  });

  it("keyPress fires keypress", () => {
    const seen = record(el, ["keypress"]);
    keyPress("a", {}, el);
    expect((seen[0] as KeyboardEvent).key).toBe("a");
  });
});

describe("insertText", () => {
  it("adds to the value of a text input", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    insertText("a");
    insertText("b");
    expect(input.value).toBe("ab");
    input.remove();
  });

  it("adds to the value of a textarea", () => {
    const area = document.createElement("textarea");
    document.body.appendChild(area);
    area.focus();
    insertText("a");
    insertText("b");
    expect(area.value).toBe("ab");
    area.remove();
  });

  it("adds to the content of a contenteditable element", () => {
    const editable = document.createElement("span");
    editable.contentEditable = "true";
    editable.tabIndex = 0;
    editable.textContent = "ab";
    document.body.appendChild(editable);
    editable.focus();
    insertText("c");
    expect(editable.innerHTML).toBe("abc");
    editable.remove();
  });
});
