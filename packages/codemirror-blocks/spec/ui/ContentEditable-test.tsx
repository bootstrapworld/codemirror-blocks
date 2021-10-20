import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import ContentEditable from "../../src/components/ContentEditable";

function paste(text: string) {
  const dt = new DataTransfer();
  dt.setData("text", text);
  fireEvent.paste(document.getSelection()!.anchorNode!, { clipboardData: dt });
}

function select(range: Range) {
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

function selectNodeContents(node: Node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  return select(range);
}

function selectNodeRange(node: Node, start: number, end: number) {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  return select(range);
}

describe("ContentEditable", () => {
  const ref: React.Ref<HTMLElement> = React.createRef();

  it("renders a contentEditable span", () => {
    render(<ContentEditable role="textbox" ref={ref} />);
  });

  it("forwards the ref to the underlying element", () => {
    render(<ContentEditable role="textbox" ref={ref} />);
    expect(ref.current).toBe(screen.getByRole("textbox"));
  });

  it("renders the text provided in the value prop", () => {
    render(<ContentEditable value="some text" ref={ref} />);
    expect(ref.current).toHaveTextContent("some text");
  });

  it("calls onChange with the current innerHTML for input events", () => {
    const onChange = jest.fn();
    render(<ContentEditable onChange={onChange} ref={ref} />);
    ref.current!.innerHTML = "new content";
    fireEvent.input(ref.current!);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("new content");
  });

  describe("pasting text", () => {
    beforeEach(() => {
      render(<ContentEditable role="textbox" value="some text" ref={ref} />);
    });

    it("replaces all the selected text with the pasted text", () => {
      const selection = selectNodeContents(ref.current!);
      expect(selection.toString()).toEqual("some text");

      paste("pasted content");
      expect(ref.current).toHaveTextContent("pasted content");

      selectNodeRange(ref.current!.firstChild!, 0, 6);
      paste("new");
      expect(ref.current).toHaveTextContent("new content");
    });

    it("inserts pasted text at the carat position", () => {
      selectNodeRange(ref.current!.firstChild!, 4, 4);
      paste(" new");
      expect(ref.current).toHaveTextContent("some new text");
    });
  });

  describe("keydown event", () => {
    let keyDownEvent: React.KeyboardEvent;
    const onKeyDown = (e: React.KeyboardEvent) => (keyDownEvent = e);

    beforeEach(() => {
      render(<ContentEditable onKeyDown={onKeyDown} ref={ref} />);
    });

    it("prevents the default behavior (adding a newline) when enter is pressed", () => {
      fireEvent.keyDown(ref.current!, { keyCode: 13 });
      expect(keyDownEvent.defaultPrevented).toBe(true);
    });

    it("does not prevent default behavior (adding a newline) when shift-enter is pressed", () => {
      fireEvent.keyDown(ref.current!, { keyCode: 13, shiftKey: true });
      expect(keyDownEvent.defaultPrevented).toBe(false);
    });
  });
});
